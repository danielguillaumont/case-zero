"""Pure ADR 006 replay run transitions over a caller-supplied current snapshot."""

import hashlib
import json
import re
from dataclasses import dataclass, field, replace
from datetime import datetime, timedelta, timezone
from enum import Enum
from uuid import UUID

from app.services.rule_versions import (
    WEAKENED_EVALUATOR_CONTRACT,
    WEAKENED_PREDICATE_ID,
    RuleCompatibility,
    RuleDefinition,
    RuleVersion,
)

SCHEMA_VERSION = 1
FIXTURE_ID = "synthetic-encoded-powershell"
FIXTURE_SHA256 = "025c8bb93536b73227406c8c74e2f64d8592350b328792147a77f628357beb6d"
EXPECTATIONS_SHA256 = "2b566489fdd31209b056c21a657749cef15467aaab61dff96261ff407ec42220"
_CORRECTED = RuleVersion(RuleDefinition())
_WEAKENED = RuleVersion(
    RuleDefinition(
        predicate_id=WEAKENED_PREDICATE_ID,
        compatibility=RuleCompatibility(evaluator_contract=WEAKENED_EVALUATOR_CONTRACT),
    )
)
AUTHORING_VERSION_ID = _CORRECTED.version_id
_CONTRACTS = {
    version.version_id: version.definition.compatibility.evaluator_contract
    for version in (_CORRECTED, _WEAKENED)
}
_DIGEST = re.compile(r"[0-9a-f]{64}")
_KEY = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,63}")


class StateError(ValueError):
    """A snapshot, identity, or transition violates the run contract."""


class Status(Enum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"


class Failure(Enum):
    TRANSIENT_INFRASTRUCTURE = "TRANSIENT_INFRASTRUCTURE"
    LEASE_LOST = "LEASE_LOST"
    RETRY_EXHAUSTED = "RETRY_EXHAUSTED"
    QUEUE_DEADLINE = "QUEUE_DEADLINE"
    EXECUTION_TIMEOUT = "EXECUTION_TIMEOUT"
    INVALID_INPUT = "INVALID_INPUT"
    UNSUPPORTED_EXECUTION = "UNSUPPORTED_EXECUTION"
    EVALUATION_ERROR = "EVALUATION_ERROR"
    CANCEL_REQUESTED = "CANCEL_REQUESTED"
    OWNER_INACTIVE = "OWNER_INACTIVE"


class AdmissionDecision(Enum):
    CREATE = "CREATE"
    EXISTING = "EXISTING"
    CONFLICT = "CONFLICT"


class LimitProfile(Enum):
    LOCAL_V1 = "local/v1"

    @property
    def max_attempts(self) -> int:
        return 2

    @property
    def execution_target(self) -> timedelta:
        return timedelta(seconds=10)

    @property
    def lease_duration(self) -> timedelta:
        return timedelta(seconds=30)

    @property
    def queue_duration(self) -> timedelta:
        return timedelta(minutes=10)

    @property
    def retention(self) -> timedelta:
        return timedelta(days=7)

    @property
    def tombstone_retention(self) -> timedelta:
        return timedelta(days=7)


_TERMINAL = frozenset({Status.COMPLETED, Status.FAILED, Status.CANCELLED})
_EXECUTION_FAILURES = frozenset(
    {
        Failure.TRANSIENT_INFRASTRUCTURE,
        Failure.EXECUTION_TIMEOUT,
        Failure.INVALID_INPUT,
        Failure.UNSUPPORTED_EXECUTION,
        Failure.EVALUATION_ERROR,
    }
)
_RETRYABLE = frozenset({Failure.TRANSIENT_INFRASTRUCTURE, Failure.LEASE_LOST})
_CANCELLATIONS = frozenset({Failure.CANCEL_REQUESTED, Failure.OWNER_INACTIVE})
_ATTEMPT_FAILURES = _EXECUTION_FAILURES | _RETRYABLE | _CANCELLATIONS
_RUN_FAILURES = (_EXECUTION_FAILURES - {Failure.TRANSIENT_INFRASTRUCTURE}) | {
    Failure.RETRY_EXHAUSTED,
    Failure.QUEUE_DEADLINE,
}


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise StateError(message)


def _utc(value: datetime) -> None:
    _require(
        type(value) is datetime
        and type(value.tzinfo) is timezone
        and value.utcoffset() == timedelta(0),
        "Expected a timezone-aware fixed UTC timestamp.",
    )


def _uuid(value: UUID) -> None:
    _require(type(value) is UUID and value.int != 0, "Expected a non-nil UUID.")


def _digest(value: str) -> None:
    _require(
        type(value) is str and bool(_DIGEST.fullmatch(value)),
        "Invalid SHA-256 identity.",
    )


def _version(value: tuple[str, str]) -> None:
    _require(
        type(value) is tuple
        and len(value) == 2
        and all(type(part) is str for part in value)
        and value in _CONTRACTS,
        "Unsupported rule-version identity.",
    )


@dataclass(frozen=True, slots=True)
class RunRequest:
    owner_id: UUID
    idempotency_key: str = field(repr=False)
    requested_version_id: tuple[str, str]
    evaluator_contract: str
    fixture_id: str = FIXTURE_ID
    fixture_sha256: str = FIXTURE_SHA256
    expectations_sha256: str = EXPECTATIONS_SHA256
    authoring_version_id: tuple[str, str] = AUTHORING_VERSION_ID
    fixture_schema_version: int = 1
    schema_version: int = SCHEMA_VERSION
    profile: LimitProfile = LimitProfile.LOCAL_V1

    def __post_init__(self) -> None:
        _uuid(self.owner_id)
        _require(
            type(self.idempotency_key) is str
            and bool(_KEY.fullmatch(self.idempotency_key)),
            "Invalid idempotency key.",
        )
        _version(self.requested_version_id)
        _version(self.authoring_version_id)
        _digest(self.fixture_sha256)
        _digest(self.expectations_sha256)
        _require(
            type(self.fixture_id) is str
            and self.fixture_id == FIXTURE_ID
            and self.fixture_sha256 == FIXTURE_SHA256
            and self.expectations_sha256 == EXPECTATIONS_SHA256
            and self.authoring_version_id == AUTHORING_VERSION_ID,
            "Unsupported bundled source identity.",
        )
        _require(
            type(self.evaluator_contract) is str
            and self.evaluator_contract == _CONTRACTS[self.requested_version_id],
            "Incompatible evaluator contract.",
        )
        _require(
            type(self.fixture_schema_version) is int
            and self.fixture_schema_version == 1
            and type(self.schema_version) is int
            and self.schema_version == SCHEMA_VERSION
            and type(self.profile) is LimitProfile,
            "Unsupported execution contract.",
        )

    @property
    def fingerprint(self) -> str:
        payload = {
            "owner_id": str(self.owner_id),
            "fixture_id": self.fixture_id,
            "fixture_sha256": self.fixture_sha256,
            "expectations_sha256": self.expectations_sha256,
            "authoring_version_id": self.authoring_version_id,
            "requested_version_id": self.requested_version_id,
            "evaluator_contract": self.evaluator_contract,
            "profile": self.profile.value,
            "schema_version": self.schema_version,
            "fixture_schema_version": self.fixture_schema_version,
        }
        canonical = json.dumps(
            payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True
        )
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def decide_admission(
    request: RunRequest, existing: RunRequest | None
) -> AdmissionDecision:
    """Compare a repository-selected owner/version/key match, if any."""
    _require(type(request) is RunRequest, "Invalid admission request.")
    if existing is None:
        return AdmissionDecision.CREATE
    _require(
        type(existing) is RunRequest and _scope(request) == _scope(existing),
        "Existing admission is outside the requested idempotency scope.",
    )
    if request.fingerprint == existing.fingerprint:
        return AdmissionDecision.EXISTING
    return AdmissionDecision.CONFLICT


def _scope(request: RunRequest) -> tuple[UUID, int, str]:
    return request.owner_id, request.schema_version, request.idempotency_key


@dataclass(frozen=True, slots=True)
class Lease:
    run_id: UUID
    attempt_number: int
    token: UUID = field(repr=False)

    def __post_init__(self) -> None:
        _uuid(self.run_id)
        _uuid(self.token)
        _require(
            type(self.attempt_number) is int and self.attempt_number > 0,
            "Invalid lease attempt number.",
        )


@dataclass(frozen=True, slots=True)
class Attempt:
    lease: Lease
    started_at: datetime
    deadline: datetime
    ended_at: datetime | None = None
    failure: Failure | None = None

    def __post_init__(self) -> None:
        _require(type(self.lease) is Lease, "Invalid attempt lease.")
        _utc(self.started_at)
        _utc(self.deadline)
        _require(self.started_at < self.deadline, "Invalid lease deadline.")
        if self.ended_at is not None:
            _utc(self.ended_at)
            _require(
                self.started_at <= self.ended_at, "Attempt ended before it started."
            )
        if self.failure is not None:
            _require(
                type(self.failure) is Failure
                and self.failure in _ATTEMPT_FAILURES
                and self.ended_at is not None,
                "Invalid attempt failure.",
            )
        if self.ended_at is not None:
            expired = self.ended_at >= self.deadline
            _require(
                (not expired or self.failure in {Failure.LEASE_LOST, *_CANCELLATIONS})
                and (self.failure is not Failure.LEASE_LOST or expired),
                "Attempt outcome contradicts its lease deadline.",
            )


@dataclass(frozen=True, slots=True)
class Evidence:
    executed_version_id: tuple[str, str]
    grade_sha256: str
    evidence_sha256: str
    passed: bool
    grade_schema_version: int = 1

    def __post_init__(self) -> None:
        _version(self.executed_version_id)
        _digest(self.grade_sha256)
        _digest(self.evidence_sha256)
        _require(
            type(self.passed) is bool
            and type(self.grade_schema_version) is int
            and self.grade_schema_version == 1,
            "Invalid evidence contract.",
        )


@dataclass(frozen=True, slots=True)
class ReplayRun:
    run_id: UUID
    request: RunRequest
    created_at: datetime
    status: Status = Status.QUEUED
    attempts: tuple[Attempt, ...] = ()
    cancel_requested_at: datetime | None = None
    finished_at: datetime | None = None
    expired_at: datetime | None = None
    failure: Failure | None = None
    evidence: Evidence | None = None

    @property
    def attempt_number(self) -> int:
        return len(self.attempts)

    @property
    def started_at(self) -> datetime | None:
        return self.attempts[0].started_at if self.attempts else None

    @property
    def queue_deadline(self) -> datetime:
        return self.created_at + self.request.profile.queue_duration

    @property
    def retention_deadline(self) -> datetime | None:
        return (
            self.finished_at + self.request.profile.retention
            if self.finished_at
            else None
        )

    @property
    def purge_at(self) -> datetime | None:
        return (
            self.expired_at + self.request.profile.tombstone_retention
            if self.expired_at
            else None
        )

    def __post_init__(self) -> None:
        _uuid(self.run_id)
        _require(
            type(self.request) is RunRequest and type(self.status) is Status,
            "Invalid run request or status.",
        )
        _utc(self.created_at)
        _require(
            type(self.attempts) is tuple
            and self.attempt_number <= self.request.profile.max_attempts,
            "Invalid attempt history.",
        )
        self._validate_attempts()
        for timestamp in (self.cancel_requested_at, self.finished_at, self.expired_at):
            if timestamp is not None:
                _utc(timestamp)
                _require(
                    timestamp >= self.created_at, "Run timestamp precedes admission."
                )
        self._validate_outcome()

    def _validate_attempts(self) -> None:
        previous = None
        tokens = set()
        for number, attempt in enumerate(self.attempts, 1):
            _require(type(attempt) is Attempt, "Invalid attempt history entry.")
            _require(
                attempt.lease.run_id == self.run_id
                and attempt.lease.attempt_number == number
                and attempt.lease.token not in tokens,
                "Inconsistent attempt identity.",
            )
            _require(
                self.created_at <= attempt.started_at < self.queue_deadline
                and attempt.deadline
                == attempt.started_at + self.request.profile.lease_duration,
                "Inconsistent attempt time bounds.",
            )
            if previous is not None:
                _require(
                    previous.failure in _RETRYABLE
                    and previous.ended_at is not None
                    and previous.ended_at <= attempt.started_at,
                    "Invalid attempt retry history.",
                )
            tokens.add(attempt.lease.token)
            previous = attempt

    def _validate_outcome(self) -> None:
        last = self.attempts[-1] if self.attempts else None
        queued_history = last is None or (
            last.failure in _RETRYABLE
            and last.ended_at < self.queue_deadline
            and self.attempt_number < self.request.profile.max_attempts
        )
        _require(
            (self.status is Status.RUNNING)
            == (last is not None and last.ended_at is None),
            "Run status contradicts active attempt.",
        )
        _require(
            self.failure is None or type(self.failure) is Failure,
            "Invalid run failure.",
        )
        _require(
            (self.evidence is not None) == (self.status is Status.COMPLETED),
            "Evidence is required only for completed runs.",
        )
        if self.evidence is not None:
            _require(
                type(self.evidence) is Evidence
                and self.evidence.executed_version_id
                == self.request.requested_version_id,
                "Evidence version differs from request.",
            )
        if self.cancel_requested_at is not None:
            _require(
                self.status in {Status.RUNNING, Status.CANCELLED}
                and (last is None or last.started_at <= self.cancel_requested_at)
                and (
                    self.finished_at is None
                    or self.cancel_requested_at <= self.finished_at
                ),
                "Inconsistent cancellation intent.",
            )
        if self.status in {Status.QUEUED, Status.RUNNING}:
            _require(
                self.finished_at is None
                and self.expired_at is None
                and self.failure is None,
                "Active run cannot have a terminal outcome.",
            )
            if self.status is Status.QUEUED:
                _require(queued_history, "Queued retry is ineligible.")
            return
        if self.status is Status.EXPIRED:
            _require(
                self.expired_at is not None and self.failure is None,
                "Invalid expired run outcome.",
            )
            cutoff = self.retention_deadline or self.queue_deadline
            _require(self.expired_at >= cutoff, "Run expired before its deadline.")
            if self.finished_at is None:
                _require(queued_history, "Invalid expired queue history.")
                return
        else:
            _require(
                self.finished_at is not None and self.expired_at is None,
                "Invalid terminal timestamps.",
            )
        if last is not None:
            _require(
                last.ended_at == self.finished_at
                or (
                    queued_history
                    and last.ended_at < self.finished_at
                    and self.status in {Status.CANCELLED, Status.EXPIRED}
                ),
                "Inconsistent terminal attempt timestamp.",
            )
        if self.status is Status.COMPLETED:
            _require(
                last is not None and last.failure is None and self.failure is None,
                "Completed run requires a successful execution attempt.",
            )
        elif self.status is Status.FAILED:
            _require(
                last is not None
                and self.failure in _RUN_FAILURES
                and (
                    last.failure is self.failure
                    or (
                        last.failure in _RETRYABLE
                        and (
                            (
                                self.failure is Failure.RETRY_EXHAUSTED
                                and self.attempt_number
                                == self.request.profile.max_attempts
                            )
                            or (
                                self.failure is Failure.QUEUE_DEADLINE
                                and self.finished_at >= self.queue_deadline
                                and self.attempt_number
                                < self.request.profile.max_attempts
                            )
                        )
                    )
                ),
                "Invalid failed run outcome.",
            )
        elif self.status is Status.CANCELLED:
            _require(
                self.failure in _CANCELLATIONS
                and (
                    (self.cancel_requested_at is not None)
                    == (self.failure is Failure.CANCEL_REQUESTED)
                )
                and (queued_history or last.failure is self.failure),
                "Invalid cancelled run outcome.",
            )


def _at(run: ReplayRun, now: datetime) -> None:
    _require(type(run) is ReplayRun, "Expected a replay run snapshot.")
    _utc(now)
    last = run.attempts[-1] if run.attempts else None
    _require(
        all(
            value is None or value <= now
            for value in (
                run.created_at,
                run.cancel_requested_at,
                run.finished_at,
                run.expired_at,
                (last.ended_at or last.started_at) if last else None,
            )
        ),
        "Transition time precedes recorded history.",
    )


def admit(run_id: UUID, request: RunRequest, now: datetime) -> ReplayRun:
    """Create a new queued snapshot after caller admission checks."""
    return ReplayRun(run_id, request, now)


def claim(run: ReplayRun, token: UUID, now: datetime) -> ReplayRun:
    _at(run, now)
    _require(
        run.status is Status.QUEUED and now < run.queue_deadline,
        "Run is not claimable.",
    )
    lease = Lease(run.run_id, run.attempt_number + 1, token)
    attempt = Attempt(lease, now, now + run.request.profile.lease_duration)
    return replace(run, status=Status.RUNNING, attempts=(*run.attempts, attempt))


def cancel(run: ReplayRun, now: datetime) -> ReplayRun:
    _at(run, now)
    if run.status in _TERMINAL:
        return run
    _require(run.status in {Status.QUEUED, Status.RUNNING}, "Run cannot be cancelled.")
    if run.status is Status.RUNNING:
        return run if run.cancel_requested_at else replace(run, cancel_requested_at=now)
    return replace(
        run,
        status=Status.CANCELLED,
        cancel_requested_at=now,
        finished_at=now,
        failure=Failure.CANCEL_REQUESTED,
    )


def cancel_inactive_owner(run: ReplayRun, now: datetime) -> ReplayRun:
    """Close a queued run after the repository observes owner deactivation."""
    _at(run, now)
    _require(
        run.status is Status.QUEUED, "Expected a queued run for owner deactivation."
    )
    return replace(
        run, status=Status.CANCELLED, finished_at=now, failure=Failure.OWNER_INACTIVE
    )


def _current(run: ReplayRun, lease: Lease, now: datetime) -> None:
    _at(run, now)
    _require(
        run.status is Status.RUNNING
        and type(lease) is Lease
        and lease == run.attempts[-1].lease,
        "Stale or invalid execution lease.",
    )
    _require(now < run.attempts[-1].deadline, "Execution lease expired.")


def _close(
    run: ReplayRun,
    now: datetime,
    status: Status,
    *,
    attempt_failure: Failure | None = None,
    failure: Failure | None = None,
    evidence: Evidence | None = None
) -> ReplayRun:
    ended = replace(run.attempts[-1], ended_at=now, failure=attempt_failure)
    return replace(
        run,
        status=status,
        attempts=(*run.attempts[:-1], ended),
        finished_at=now if status in _TERMINAL else None,
        failure=failure,
        evidence=evidence,
    )


def _cancel_running(run: ReplayRun, now: datetime, reason: Failure) -> ReplayRun:
    return _close(run, now, Status.CANCELLED, attempt_failure=reason, failure=reason)


def complete(
    run: ReplayRun, lease: Lease, evidence: Evidence, now: datetime
) -> ReplayRun:
    _current(run, lease, now)
    if run.cancel_requested_at is not None:
        return _cancel_running(run, now, Failure.CANCEL_REQUESTED)
    _require(
        type(evidence) is Evidence, "Completion requires validated evidence identity."
    )
    return _close(run, now, Status.COMPLETED, evidence=evidence)


def acknowledge_cancel(run: ReplayRun, lease: Lease, now: datetime) -> ReplayRun:
    _current(run, lease, now)
    _require(run.cancel_requested_at is not None, "No cancellation is pending.")
    return _cancel_running(run, now, Failure.CANCEL_REQUESTED)


def _retry(
    run: ReplayRun, reason: Failure, now: datetime, owner_active: bool
) -> ReplayRun:
    if not owner_active:
        return _cancel_running(run, now, Failure.OWNER_INACTIVE)
    if run.attempt_number == run.request.profile.max_attempts:
        return _close(
            run,
            now,
            Status.FAILED,
            attempt_failure=reason,
            failure=Failure.RETRY_EXHAUSTED,
        )
    if now >= run.queue_deadline:
        return _close(
            run,
            now,
            Status.FAILED,
            attempt_failure=reason,
            failure=Failure.QUEUE_DEADLINE,
        )
    return _close(run, now, Status.QUEUED, attempt_failure=reason)


def fail(
    run: ReplayRun, lease: Lease, reason: Failure, now: datetime, *, owner_active: bool
) -> ReplayRun:
    _current(run, lease, now)
    _require(
        type(reason) is Failure and reason in _EXECUTION_FAILURES,
        "Invalid execution failure.",
    )
    _require(
        type(owner_active) is bool, "Expected an explicit owner eligibility decision."
    )
    if run.cancel_requested_at is not None:
        return _cancel_running(run, now, Failure.CANCEL_REQUESTED)
    if reason in _RETRYABLE:
        return _retry(run, reason, now, owner_active)
    return _close(run, now, Status.FAILED, attempt_failure=reason, failure=reason)


def recover(run: ReplayRun, now: datetime, *, owner_active: bool) -> ReplayRun:
    """Reconcile a lease at or after expiration without executor authority."""
    _at(run, now)
    _require(
        run.status is Status.RUNNING and now >= run.attempts[-1].deadline,
        "Recovery requires an expired running lease.",
    )
    _require(
        type(owner_active) is bool, "Expected an explicit owner eligibility decision."
    )
    if run.cancel_requested_at is not None:
        return _cancel_running(run, now, Failure.CANCEL_REQUESTED)
    return _retry(run, Failure.LEASE_LOST, now, owner_active)


def expire(run: ReplayRun, now: datetime) -> ReplayRun:
    _at(run, now)
    _require(
        (run.status is Status.QUEUED and now >= run.queue_deadline)
        or (run.status in _TERMINAL and now >= run.retention_deadline),
        "Run is not eligible for expiry.",
    )
    return replace(
        run,
        status=Status.EXPIRED,
        expired_at=now,
        failure=None,
        evidence=None,
        cancel_requested_at=None,
    )
