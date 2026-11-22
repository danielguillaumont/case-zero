"""Short PostgreSQL transactions for the ADR 006 local dispatcher."""

import hashlib
from contextlib import asynccontextmanager
from dataclasses import dataclass, field, replace
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from sqlalchemy import and_, delete, func, insert, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.replay_run import replay_attempts as attempts
from app.models.replay_run import replay_execution_control as control
from app.models.replay_run import replay_results as results
from app.models.replay_run import replay_runs as runs
from app.models.user import User
from app.services import replay_run_state as state

_ACTIVE = (state.Status.QUEUED.value, state.Status.RUNNING.value)
_TERMINAL = tuple(
    s.value
    for s in (state.Status.COMPLETED, state.Status.FAILED, state.Status.CANCELLED)
)
_QUEUED, _RUNNING = _ACTIVE
_EXPIRED = state.Status.EXPIRED.value
_MAINTENANCE_BATCH = 64


class StoreError(ValueError):
    """A fixed repository rejection, suitable for internal callers."""


@dataclass(frozen=True, slots=True)
class ResultPayload:
    """Digest-bound, already redacted canonical bytes from a trusted caller."""

    identity: state.Evidence
    grade: bytes = field(repr=False)
    evidence: bytes = field(repr=False)

    def __post_init__(self) -> None:
        if (
            type(self.identity) is not state.Evidence
            or type(self.grade) is not bytes
            or type(self.evidence) is not bytes
            or not self.grade
            or not self.evidence
            or len(self.grade) + len(self.evidence) > 32768
        ):
            raise StoreError("invalid_result_payload")
        if (
            hashlib.sha256(self.grade).hexdigest() != self.identity.grade_sha256
            or hashlib.sha256(self.evidence).hexdigest()
            != self.identity.evidence_sha256
        ):
            raise StoreError("result_digest_mismatch")


def _time(value: datetime | None) -> datetime | None:
    return value.astimezone(UTC) if value is not None else None


async def _now(db: AsyncSession) -> datetime:
    return _time(await db.scalar(select(func.clock_timestamp())))


def _request(row) -> state.RunRequest:
    request = state.RunRequest(
        owner_id=row.owner_id,
        idempotency_key=row.idempotency_key,
        requested_version_id=(row.rule_id, row.requested_sha256),
        evaluator_contract=row.evaluator_contract,
        fixture_id=row.fixture_id,
        fixture_sha256=row.fixture_sha256,
        expectations_sha256=row.expectations_sha256,
        authoring_version_id=(row.rule_id, row.authoring_sha256),
        fixture_schema_version=row.fixture_schema_version,
        schema_version=row.schema_version,
        profile=state.LimitProfile(row.profile),
    )
    if request.fingerprint != row.fingerprint:
        raise StoreError("stored_request_mismatch")
    return request


def _lifecycle(run: state.ReplayRun) -> dict:
    return dict(
        status=run.status.value,
        cancel_requested_at=run.cancel_requested_at,
        finished_at=run.finished_at,
        retention_deadline=run.retention_deadline,
        expired_at=run.expired_at,
        purge_at=run.purge_at,
        failure=run.failure.value if run.failure else None,
    )


def _evidence(row) -> state.Evidence:
    return state.Evidence(
        (row.executed_rule_id, row.executed_sha256),
        row.grade_sha256,
        row.evidence_sha256,
        row.passed,
        row.grade_schema_version,
    )


async def _snapshot(db: AsyncSession, row) -> state.ReplayRun:
    history = (
        await db.execute(
            select(attempts)
            .where(attempts.c.run_id == row.id)
            .order_by(attempts.c.number)
        )
    ).all()
    result = (
        await db.execute(
            select(
                results.c.attempt_number,
                results.c.executed_rule_id,
                results.c.executed_sha256,
                results.c.grade_schema_version,
                results.c.grade_sha256,
                results.c.evidence_sha256,
                results.c.passed,
            ).where(results.c.run_id == row.id)
        )
    ).one_or_none()
    if result is not None and result.attempt_number != len(history):
        raise StoreError("stored_attempt_mismatch")
    run = state.ReplayRun(
        run_id=row.id,
        request=_request(row),
        created_at=_time(row.created_at),
        status=state.Status(row.status),
        attempts=tuple(
            state.Attempt(
                state.Lease(row.id, item.number, item.lease_token),
                _time(item.started_at),
                _time(item.lease_deadline),
                _time(item.ended_at),
                state.Failure(item.failure) if item.failure else None,
            )
            for item in history
        ),
        cancel_requested_at=_time(row.cancel_requested_at),
        finished_at=_time(row.finished_at),
        expired_at=_time(row.expired_at),
        failure=state.Failure(row.failure) if row.failure else None,
        evidence=_evidence(result) if result is not None else None,
    )
    if (run.queue_deadline, run.retention_deadline, run.purge_at) != (
        row.queue_deadline,
        row.retention_deadline,
        row.purge_at,
    ):
        raise StoreError("stored_deadline_mismatch")
    return run


async def _save(
    db: AsyncSession,
    previous: state.ReplayRun,
    current: state.ReplayRun,
    payload: ResultPayload | None = None,
) -> None:
    if current is previous:
        return
    if current.attempt_number > previous.attempt_number:
        attempt = current.attempts[-1]
        await db.execute(
            insert(attempts).values(
                run_id=current.run_id,
                number=current.attempt_number,
                lease_token=attempt.lease.token,
                started_at=attempt.started_at,
                lease_deadline=attempt.deadline,
            )
        )
    elif current.attempts != previous.attempts:
        attempt = current.attempts[-1]
        await db.execute(
            update(attempts)
            .where(
                attempts.c.run_id == current.run_id,
                attempts.c.number == current.attempt_number,
            )
            .values(
                ended_at=attempt.ended_at,
                failure=attempt.failure.value if attempt.failure else None,
            )
        )

    if (
        current.status is state.Status.COMPLETED
        and previous.status is state.Status.RUNNING
    ):
        identity = current.evidence
        if payload is None or payload.identity != identity:
            raise StoreError("missing_result_payload")
        await db.execute(
            insert(results).values(
                run_id=current.run_id,
                attempt_number=current.attempt_number,
                executed_rule_id=identity.executed_version_id[0],
                executed_sha256=identity.executed_version_id[1],
                grade_schema_version=identity.grade_schema_version,
                passed=identity.passed,
                grade_sha256=identity.grade_sha256,
                evidence_sha256=identity.evidence_sha256,
                grade_bytes=payload.grade,
                evidence_bytes=payload.evidence,
            )
        )
    elif current.status is state.Status.EXPIRED:
        await db.execute(delete(results).where(results.c.run_id == current.run_id))
        await db.execute(delete(attempts).where(attempts.c.run_id == current.run_id))
    await db.execute(
        update(runs).where(runs.c.id == current.run_id).values(**_lifecycle(current))
    )


async def _owner_active(db: AsyncSession, owner_id: UUID) -> bool:
    query = select(User.is_active).where(User.id == owner_id).with_for_update(read=True)
    return await db.scalar(query) is True


async def _count(db: AsyncSession, *conditions) -> int:
    return await db.scalar(select(func.count()).select_from(runs).where(*conditions))


async def _locked_run(db: AsyncSession, run_id: UUID, *conditions):
    query = select(runs).where(runs.c.id == run_id, *conditions).with_for_update()
    return (await db.execute(query)).one_or_none()


def _expired(run: state.ReplayRun, now: datetime) -> bool:
    deadline = (
        run.queue_deadline
        if run.status is state.Status.QUEUED
        else run.retention_deadline
    )
    return (
        run.status is not state.Status.EXPIRED
        and deadline is not None
        and now >= deadline
    )


def _visible(run: state.ReplayRun, now: datetime) -> state.ReplayRun:
    if _expired(run, now):
        return replace(state.expire(run, now), attempts=())
    return run


class ReplayRunStore:
    """All calls own their transaction. Evaluate only after `claim` returns."""

    def __init__(self, sessions: async_sessionmaker[AsyncSession]):
        self._sessions = sessions

    @asynccontextmanager
    async def _transaction(self, *, read: bool = False):
        async with self._sessions.begin() as db:
            # Statements after the singleton lock must see the preceding owner's commits.
            await db.connection(execution_options={"isolation_level": "READ COMMITTED"})
            query = (
                select(control.c.id).where(control.c.id == 1).with_for_update(read=read)
            )
            if await db.scalar(query) != 1:
                raise StoreError("missing_replay_execution_control")
            yield db

    async def admit(self, request: state.RunRequest) -> state.ReplayRun:
        if type(request) is not state.RunRequest:
            raise StoreError("invalid_request")
        async with self._transaction() as db:
            existing = (
                await db.execute(
                    select(runs)
                    .where(
                        runs.c.owner_id == request.owner_id,
                        runs.c.schema_version == request.schema_version,
                        runs.c.idempotency_key == request.idempotency_key,
                    )
                    .with_for_update()
                )
            ).one_or_none()
            if not await _owner_active(db, request.owner_id):
                raise StoreError("inactive_owner")
            now = await _now(db)
            decision = state.decide_admission(
                request, _request(existing) if existing else None
            )
            if decision is state.AdmissionDecision.CONFLICT:
                raise StoreError("idempotency_conflict")
            if existing is not None:
                run = await _snapshot(db, existing)
                return _visible(run, now)

            owner = runs.c.owner_id == request.owner_id
            if (
                await _count(db, owner, runs.c.created_at > now - timedelta(minutes=1))
                >= 5
            ):
                raise StoreError("owner_rate_limit")
            if await _count(db, owner, runs.c.status.in_(_ACTIVE)) >= 2:
                raise StoreError("owner_active_limit")
            # Reserve a queue position for a running attempt that may requeue.
            if await _count(db, runs.c.status.in_(_ACTIVE)) >= 10:
                raise StoreError("global_queue_limit")
            if await _count(db) >= 256:
                raise StoreError("retained_run_limit")
            run = state.admit(uuid4(), request, now)
            await db.execute(
                insert(runs).values(
                    id=run.run_id,
                    owner_id=request.owner_id,
                    schema_version=request.schema_version,
                    idempotency_key=request.idempotency_key,
                    fingerprint=request.fingerprint,
                    fixture_id=request.fixture_id,
                    fixture_schema_version=request.fixture_schema_version,
                    fixture_sha256=request.fixture_sha256,
                    expectations_sha256=request.expectations_sha256,
                    rule_id=request.requested_version_id[0],
                    requested_sha256=request.requested_version_id[1],
                    authoring_sha256=request.authoring_version_id[1],
                    evaluator_contract=request.evaluator_contract,
                    profile=request.profile.value,
                    created_at=run.created_at,
                    queue_deadline=run.queue_deadline,
                    **_lifecycle(run),
                )
            )
            return run

    async def get(self, owner_id: UUID, run_id: UUID) -> state.ReplayRun | None:
        async with self._transaction(read=True) as db:
            row = (
                await db.execute(
                    select(runs).where(runs.c.id == run_id, runs.c.owner_id == owner_id)
                )
            ).one_or_none()
            if row is None or not await _owner_active(db, owner_id):
                return None
            run = await _snapshot(db, row)
            now = await _now(db)
            return _visible(run, now)

    async def get_result(self, owner_id: UUID, run_id: UUID) -> ResultPayload | None:
        async with self._transaction(read=True) as db:
            if not await _owner_active(db, owner_id):
                return None
            query = (
                select(results)
                .join(runs, results.c.run_id == runs.c.id)
                .where(
                    runs.c.id == run_id,
                    runs.c.owner_id == owner_id,
                    runs.c.status == state.Status.COMPLETED.value,
                    results.c.executed_rule_id == runs.c.rule_id,
                    results.c.executed_sha256 == runs.c.requested_sha256,
                    runs.c.retention_deadline > func.clock_timestamp(),
                )
            )
            row = (await db.execute(query)).one_or_none()
            return (
                ResultPayload(_evidence(row), row.grade_bytes, row.evidence_bytes)
                if row
                else None
            )

    async def cancel(self, owner_id: UUID, run_id: UUID) -> state.ReplayRun | None:
        async with self._transaction() as db:
            row = await _locked_run(db, run_id, runs.c.owner_id == owner_id)
            if row is None or not await _owner_active(db, owner_id):
                return None
            run = await _snapshot(db, row)
            now = await _now(db)
            if run.status is state.Status.EXPIRED:
                return run
            updated = (
                state.expire(run, now) if _expired(run, now) else state.cancel(run, now)
            )
            await _save(db, run, updated)
            return (
                replace(updated, attempts=())
                if updated.status is state.Status.EXPIRED
                else updated
            )

    async def claim(self) -> state.ReplayRun | None:
        async with self._transaction() as db:
            if await _count(db, runs.c.status == _RUNNING):
                return None
            query = (
                select(runs)
                .where(runs.c.status == _QUEUED)
                .order_by(
                    runs.c.created_at,
                    runs.c.id,
                )
                .limit(10)
                .with_for_update()
            )
            for row in (await db.execute(query)).all():
                active = await _owner_active(db, row.owner_id)
                run = await _snapshot(db, row)
                now = await _now(db)
                if _expired(run, now):
                    updated = state.expire(run, now)
                elif not active:
                    updated = state.cancel_inactive_owner(run, now)
                else:
                    updated = state.claim(run, uuid4(), now)
                await _save(db, run, updated)
                if updated.status is state.Status.RUNNING:
                    return updated
            return None

    async def _finish(
        self,
        lease: state.Lease,
        *,
        payload: ResultPayload | None = None,
        failure: state.Failure | None = None
    ) -> state.ReplayRun:
        if type(lease) is not state.Lease:
            raise StoreError("invalid_lease")
        async with self._transaction() as db:
            row = await _locked_run(db, lease.run_id)
            if row is None:
                raise StoreError("run_not_found")
            run = await _snapshot(db, row)
            active = (
                await _owner_active(db, row.owner_id) if failure is not None else False
            )
            now = await _now(db)
            if payload is not None:
                updated = state.complete(run, lease, payload.identity, now)
            elif failure is not None:
                updated = state.fail(run, lease, failure, now, owner_active=active)
            else:
                updated = state.acknowledge_cancel(run, lease, now)
            await _save(db, run, updated, payload)
            return updated

    async def publish(
        self, lease: state.Lease, payload: ResultPayload
    ) -> state.ReplayRun:
        if type(payload) is not ResultPayload:
            raise StoreError("invalid_result_payload")
        return await self._finish(lease, payload=payload)

    async def fail(self, lease: state.Lease, reason: state.Failure) -> state.ReplayRun:
        if type(reason) is not state.Failure:
            raise StoreError("invalid_failure")
        return await self._finish(lease, failure=reason)

    async def acknowledge_cancel(self, lease: state.Lease) -> state.ReplayRun:
        return await self._finish(lease)

    async def reconcile_lease(self) -> state.ReplayRun | None:
        async with self._transaction() as db:
            query = select(runs).where(runs.c.status == _RUNNING).with_for_update()
            row = (await db.execute(query)).one_or_none()
            if row is None:
                return None
            run = await _snapshot(db, row)
            active = await _owner_active(db, row.owner_id)
            now = await _now(db)
            if now < run.attempts[-1].deadline:
                return None
            updated = state.recover(run, now, owner_active=active)
            await _save(db, run, updated)
            return updated

    async def expire_due(self) -> int:
        async with self._transaction() as db:
            now = await _now(db)
            query = (
                select(runs)
                .where(
                    or_(
                        and_(runs.c.status == _QUEUED, runs.c.queue_deadline <= now),
                        and_(
                            runs.c.status.in_(_TERMINAL),
                            runs.c.retention_deadline <= now,
                        ),
                    )
                )
                .order_by(runs.c.created_at, runs.c.id)
                .limit(_MAINTENANCE_BATCH)
                .with_for_update()
            )
            rows = (await db.execute(query)).all()
            for row in rows:
                run = await _snapshot(db, row)
                await _save(db, run, state.expire(run, now))
            return len(rows)

    async def purge_due(self) -> int:
        async with self._transaction() as db:
            now = await _now(db)
            query = (
                select(runs.c.id)
                .where(runs.c.status == _EXPIRED, runs.c.purge_at <= now)
                .order_by(
                    runs.c.purge_at,
                    runs.c.id,
                )
                .limit(_MAINTENANCE_BATCH)
                .with_for_update()
            )
            ids = (await db.scalars(query)).all()
            if ids:
                await db.execute(delete(runs).where(runs.c.id.in_(ids)))
            return len(ids)
