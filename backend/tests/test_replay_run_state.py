import os
import subprocess
import sys
from dataclasses import FrozenInstanceError, replace
from datetime import UTC, datetime, timedelta, timezone
from uuid import UUID

import pytest

from app.services import replay_run_state as state
from app.services.replay_regression_proof import CORRECTED, WEAKENED

NOW = datetime(2026, 11, 22, tzinfo=UTC)
OWNER, RUN, TOKEN, NEXT = (UUID(int=i) for i in range(1, 5))
TICK = timedelta(microseconds=1)
S = state.Status
F = state.Failure


def request(version=CORRECTED, **changes):
    return replace(
        state.RunRequest(
            OWNER,
            "test-key",
            version.version_id,
            version.definition.compatibility.evaluator_contract,
        ),
        **changes
    )


def evidence(**changes):
    return replace(
        state.Evidence(CORRECTED.version_id, "1" * 64, "2" * 64, False), **changes
    )


@pytest.fixture
def queued():
    return state.admit(RUN, request(), NOW)


@pytest.fixture
def running(queued):
    return state.claim(queued, TOKEN, NOW)


@pytest.fixture
def snapshots(queued, running):
    lease = running.attempts[-1].lease
    return {
        S.QUEUED: queued,
        S.RUNNING: running,
        S.COMPLETED: state.complete(running, lease, evidence(), NOW),
        S.FAILED: state.fail(running, lease, F.INVALID_INPUT, NOW, owner_active=True),
        S.CANCELLED: state.cancel(queued, NOW),
        S.EXPIRED: state.expire(queued, queued.queue_deadline),
    }


@pytest.mark.parametrize("source", list(S))
@pytest.mark.parametrize("target", list(S))
def test_transition_matrix(snapshots, source, target):
    run = snapshots[source]
    lease = state.Lease(RUN, 1, TOKEN)
    operations = {
        S.QUEUED: lambda: state.recover(
            run, NOW + timedelta(seconds=30), owner_active=True
        ),
        S.RUNNING: lambda: state.claim(run, TOKEN, NOW),
        S.COMPLETED: lambda: state.complete(run, lease, evidence(), NOW),
        S.FAILED: lambda: state.fail(
            run, lease, F.INVALID_INPUT, NOW, owner_active=True
        ),
        S.CANCELLED: lambda: (
            state.acknowledge_cancel(state.cancel(run, NOW), lease, NOW)
            if source is S.RUNNING
            else state.cancel(run, run.finished_at or NOW)
        ),
        S.EXPIRED: lambda: state.expire(
            run, run.retention_deadline or run.queue_deadline
        ),
    }
    permitted = {
        S.QUEUED: {S.RUNNING, S.CANCELLED, S.EXPIRED},
        S.RUNNING: {S.QUEUED, S.COMPLETED, S.FAILED, S.CANCELLED},
        S.COMPLETED: {S.EXPIRED},
        S.FAILED: {S.EXPIRED},
        S.CANCELLED: {S.EXPIRED},
        S.EXPIRED: set(),
    }
    if target in permitted[source]:
        result = operations[target]()
        assert result.status is target
        assert result.request is run.request
        assert result.run_id == run.run_id
    elif target is S.CANCELLED and source in {S.COMPLETED, S.FAILED, S.CANCELLED}:
        assert (
            operations[target]() is run
        )  # A terminal cancel request makes no transition.
    else:
        with pytest.raises(state.StateError):
            operations[target]()


def test_cancellation_wins_over_unpublished_result_failure_or_retry(running):
    pending = state.cancel(running, NOW + TICK)
    assert pending.status is S.RUNNING
    assert pending.attempts is running.attempts
    assert state.cancel(pending, NOW + 2 * TICK) is pending
    lease = pending.attempts[0].lease
    with pytest.raises(state.StateError, match="No cancellation"):
        state.acknowledge_cancel(running, lease, NOW)
    for cancelled in (
        state.complete(pending, lease, evidence(), NOW + TICK),
        state.fail(
            pending, lease, F.TRANSIENT_INFRASTRUCTURE, NOW + TICK, owner_active=True
        ),
        state.recover(pending, pending.attempts[0].deadline, owner_active=True),
    ):
        assert cancelled.status is S.CANCELLED
        assert cancelled.failure is F.CANCEL_REQUESTED
        assert cancelled.evidence is None
        assert cancelled.attempts[0].lease is lease


def test_completed_execution_may_fail_grade_and_cannot_be_cancelled(running):
    completed = state.complete(running, running.attempts[0].lease, evidence(), NOW)
    assert completed.status is S.COMPLETED and completed.evidence.passed is False
    assert completed.failure is None
    assert state.cancel(completed, NOW + TICK) is completed


def test_lease_deadline_recovery_and_stale_attempts(running):
    original = running.attempts[0]
    with pytest.raises(state.StateError, match="expired running lease"):
        state.recover(running, original.deadline - TICK, owner_active=True)
    assert (
        state.complete(
            running, original.lease, evidence(), original.deadline - TICK
        ).status
        is S.COMPLETED
    )
    with pytest.raises(state.StateError, match="lease expired"):
        state.complete(running, original.lease, evidence(), original.deadline)
    retry = state.recover(running, original.deadline, owner_active=True)
    assert retry.status is S.QUEUED and retry.attempt_number == 1
    assert retry.attempts[0] == replace(
        original, ended_at=original.deadline, failure=F.LEASE_LOST
    )
    assert original.ended_at is None
    with pytest.raises(state.StateError, match="Inconsistent attempt identity"):
        state.claim(retry, TOKEN, original.deadline)
    second = state.claim(retry, NEXT, original.deadline)
    assert second.attempt_number == 2
    assert second.attempts[0] is retry.attempts[0]
    for stale in (
        original.lease,
        state.Lease(UUID(int=99), 2, NEXT),
        state.Lease(RUN, 2, TOKEN),
    ):
        with pytest.raises(state.StateError, match="Stale"):
            state.complete(second, stale, evidence(), original.deadline)
    failed = state.recover(second, second.attempts[-1].deadline, owner_active=True)
    assert failed.status is S.FAILED and failed.failure is F.RETRY_EXHAUSTED
    assert failed.attempts[-1].failure is F.LEASE_LOST


@pytest.mark.parametrize(
    "reason",
    [F.INVALID_INPUT, F.UNSUPPORTED_EXECUTION, F.EXECUTION_TIMEOUT, F.EVALUATION_ERROR],
)
def test_terminal_failures_never_retry(running, reason):
    failed = state.fail(
        running, running.attempts[0].lease, reason, NOW, owner_active=True
    )
    assert failed.status is S.FAILED and failed.failure is reason
    assert failed.attempt_number == 1 and failed.evidence is None


def test_transient_retry_requires_owner_and_attempt_budget(running):
    lease = running.attempts[0].lease
    inactive = state.fail(
        running, lease, F.TRANSIENT_INFRASTRUCTURE, NOW, owner_active=False
    )
    assert inactive.status is S.CANCELLED and inactive.failure is F.OWNER_INACTIVE
    assert (
        state.recover(running, running.attempts[0].deadline, owner_active=False).failure
        is F.OWNER_INACTIVE
    )
    retry = state.fail(
        running, lease, F.TRANSIENT_INFRASTRUCTURE, NOW, owner_active=True
    )
    assert retry.attempts[0].failure is F.TRANSIENT_INFRASTRUCTURE
    second = state.claim(retry, NEXT, NOW)
    failed = state.fail(
        second,
        second.attempts[-1].lease,
        F.TRANSIENT_INFRASTRUCTURE,
        NOW,
        owner_active=True,
    )
    assert failed.status is S.FAILED and failed.failure is F.RETRY_EXHAUSTED
    assert failed.attempt_number == 2


def test_queue_and_retention_boundaries(queued):
    assert queued.queue_deadline == NOW + timedelta(minutes=10)
    cutoff = queued.queue_deadline
    with pytest.raises(state.StateError, match="expiry"):
        state.expire(queued, cutoff - TICK)
    running = state.claim(queued, TOKEN, cutoff - TICK)
    assert state.expire(queued, cutoff).purge_at == cutoff + timedelta(days=7)
    with pytest.raises(state.StateError, match="claimable"):
        state.claim(queued, TOKEN, cutoff)
    lease = running.attempts[-1].lease
    failed = state.fail(
        running, lease, F.TRANSIENT_INFRASTRUCTURE, cutoff, owner_active=True
    )
    assert failed.status is S.FAILED and failed.failure is F.QUEUE_DEADLINE
    assert (
        state.recover(running, running.attempts[-1].deadline, owner_active=True).failure
        is F.QUEUE_DEADLINE
    )
    completed = state.complete(running, lease, evidence(), cutoff)
    assert completed.retention_deadline == cutoff + timedelta(days=7)
    with pytest.raises(state.StateError, match="expiry"):
        state.expire(completed, completed.retention_deadline - TICK)
    expired = state.expire(completed, completed.retention_deadline)
    assert expired.status is S.EXPIRED and expired.evidence is None
    assert expired.purge_at == cutoff + timedelta(days=14)


def test_cancel_and_expire_queued_retry(queued, running):
    inactive = state.cancel_inactive_owner(queued, NOW)
    assert inactive.failure is F.OWNER_INACTIVE and not inactive.attempts
    retry = state.fail(
        running,
        running.attempts[0].lease,
        F.TRANSIENT_INFRASTRUCTURE,
        NOW,
        owner_active=True,
    )
    assert state.expire(retry, retry.queue_deadline).attempt_number == 1
    for cancel in (state.cancel, state.cancel_inactive_owner):
        cancelled = cancel(retry, NOW + TICK)
        expired = state.expire(cancelled, cancelled.retention_deadline)
        assert expired.status is S.EXPIRED and expired.evidence is None


@pytest.mark.parametrize(
    "key", ["", " ", "x" * 65, "line\nbreak", "unsafe/path", "é", None]
)
def test_bad_idempotency_keys_are_rejected_without_echoing_input(key):
    with pytest.raises(state.StateError, match="^Invalid idempotency key\\.$"):
        request(idempotency_key=key)


def test_idempotency_scope_fingerprint_and_limits():
    original = request()
    D = state.AdmissionDecision
    assert state.decide_admission(original, None) is D.CREATE
    assert state.decide_admission(original, request()) is D.EXISTING
    assert state.decide_admission(original, request(WEAKENED)) is D.CONFLICT
    assert original.fingerprint != request(WEAKENED).fingerprint
    other_key = request(idempotency_key="new-key")
    assert original.fingerprint == other_key.fingerprint
    assert "test-key" not in repr(original)
    for mismatched in (other_key, request(owner_id=UUID(int=8))):
        with pytest.raises(state.StateError, match="idempotency scope"):
            state.decide_admission(original, mismatched)
    assert original.profile.max_attempts == 2
    assert original.profile.execution_target == timedelta(seconds=10)
    assert original.profile.lease_duration == timedelta(seconds=30)


@pytest.mark.parametrize(
    "changes",
    [
        {"fixture_sha256": "bad"},
        {"fixture_sha256": "f" * 64},
        {"expectations_sha256": "0" * 64},
        {"fixture_id": "other"},
        {"evaluator_contract": "arbitrary"},
        {"fixture_schema_version": True},
        {"schema_version": 2},
        {"requested_version_id": ("encoded-powershell", "f" * 64)},
        {"requested_version_id": list(CORRECTED.version_id)},
        {"authoring_version_id": WEAKENED.version_id},
        {"profile": "local/v1"},
        {"owner_id": UUID(int=0)},
    ],
)
def test_invalid_admission_metadata(changes):
    with pytest.raises(state.StateError):
        request(**changes)


@pytest.mark.parametrize(
    "value",
    [NOW.replace(tzinfo=None), NOW.astimezone(timezone(timedelta(hours=1))), "UTC"],
)
def test_invalid_time_input(queued, value):
    with pytest.raises(state.StateError, match="UTC"):
        state.admit(RUN, request(), value)
    with pytest.raises(state.StateError, match="UTC"):
        state.claim(queued, TOKEN, value)
    with pytest.raises(state.StateError, match="precedes"):
        state.claim(queued, TOKEN, NOW - TICK)


def test_rejects_invalid_snapshots_and_result_metadata(queued, running):
    lease = running.attempts[0].lease
    for bad in ("QUEUED", "unknown", None):
        with pytest.raises(state.StateError, match="status"):
            replace(queued, status=bad)
    for changes in (
        {"status": S.RUNNING},
        {"attempts": []},
        {"evidence": evidence()},
        {"failure": "BAD"},
    ):
        with pytest.raises(state.StateError):
            replace(queued, **changes)
    with pytest.raises(state.StateError, match="Inconsistent attempt identity"):
        replace(
            running,
            attempts=(
                replace(running.attempts[0], lease=replace(lease, attempt_number=2)),
            ),
        )
    with pytest.raises(state.StateError, match="Inconsistent attempt time bounds"):
        replace(
            running,
            attempts=(
                replace(
                    running.attempts[0], deadline=running.attempts[0].deadline + TICK
                ),
            ),
        )
    for value in ("bad", F.LEASE_LOST, F.CANCEL_REQUESTED, F.RETRY_EXHAUSTED):
        with pytest.raises(state.StateError, match="execution failure"):
            state.fail(running, lease, value, NOW, owner_active=True)
    for changes in (
        {"grade_sha256": "BAD"},
        {"evidence_sha256": "x"},
        {"passed": 0},
        {"grade_schema_version": True},
    ):
        with pytest.raises(state.StateError):
            evidence(**changes)
    for invalid in (None, evidence(executed_version_id=WEAKENED.version_id)):
        with pytest.raises(state.StateError, match="evidence|Evidence"):
            state.complete(running, lease, invalid, NOW)


def test_snapshot_and_nested_records_are_frozen(running):
    lease = running.attempts[0].lease
    result = state.complete(running, lease, evidence(), NOW)
    for instance, name in (
        (result, "status"),
        (result.request, "owner_id"),
        (result.evidence, "passed"),
        (result.attempts[0], "ended_at"),
        (lease, "token"),
    ):
        with pytest.raises(FrozenInstanceError):
            setattr(instance, name, None)
    assert str(TOKEN) not in repr(result)
    assert result == state.complete(running, lease, evidence(), NOW)


def test_fresh_process_fingerprint_and_no_operational_side_effects():
    program = """
import sys
from datetime import UTC, datetime
from uuid import UUID
from app.services import replay_run_state as s
for module in ('sqlalchemy', 'app.database', 'fastapi', 'socket', 'subprocess'):
    assert module not in sys.modules
def audit(event, args):
    blocked = {'open', 'compile', 'exec'}
    if event in blocked or event.startswith(('socket.', 'subprocess.', 'os.')):
        raise AssertionError(event)
sys.addaudithook(audit)
now = datetime(2026, 11, 22, tzinfo=UTC)
req = s.RunRequest(UUID(int=1), 'test-key', s.AUTHORING_VERSION_ID, 'encoded-powershell/v1')
run = s.claim(s.admit(UUID(int=2), req, now), UUID(int=3), now)
print(req.fingerprint, run.status.value, run.attempts[0].deadline.isoformat())
"""
    outputs = [
        subprocess.check_output(
            [sys.executable, "-c", program],
            env={**os.environ, "PYTHONHASHSEED": str(seed)},
            timeout=10,
        )
        for seed in (1, 2)
    ]
    assert outputs[0] == outputs[1]
    assert outputs[0].decode().split()[0] == request().fingerprint
