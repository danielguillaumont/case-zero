"""Opt-in PostgreSQL 18 integration for the disposable v2.6-G Compose project."""

import asyncio
import hashlib
import json
import os
import selectors
import subprocess
import sys
from dataclasses import replace
from datetime import timedelta
from pathlib import Path
from uuid import uuid4

import psycopg
import pytest
from sqlalchemy import URL, delete, event, func, insert, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.models.replay_run import replay_attempts, replay_results, replay_runs
from app.models.user import User
from app.services import replay_run_state as state
from app.services.replay_regression_proof import WEAKENED
from app.services.replay_run_store import ReplayRunStore, ResultPayload, StoreError

pytestmark = pytest.mark.skipif(
    os.getenv("CASE_ZERO_RUN_V26G_INTEGRATION") != "1",
    reason="Requires explicit opt-in and a verified disposable PostgreSQL 18 container.",
)
_BACKEND = Path(__file__).resolve().parents[1]
_PROJECT = "case-zero-v26g-test"
_DB, _USER, _PASSWORD = (
    "casezero_test",
    "casezero_local_test",
    "casezero-local-test-only",
)
_BASE, _HEAD = "e6ab1b3d315d", "c84d31ef7b26"
_TABLES = {
    "replay_runs",
    "replay_attempts",
    "replay_results",
    "replay_execution_control",
}
_IDENTITY = (
    "SELECT current_database(), current_user, "
    "current_setting('server_version_num')::int / 10000, "
    "system_identifier::text, current_setting('data_directory') FROM pg_control_system()"
)


def _docker(*args):
    result = subprocess.run(
        ["docker", *args],
        check=True,
        capture_output=True,
        text=True,
        timeout=30,
    )
    if result.stderr.strip():
        pytest.fail("Docker preflight emitted diagnostics.", pytrace=False)
    return result.stdout.strip()


@pytest.fixture(scope="module")
def verified_database():
    assert not sys.flags.optimize
    assert not any(
        name.upper().startswith(("PG", "DOCKER_", "COMPOSE_", "DATABASE_URL"))
        for name in os.environ
    )
    expected = {
        "APP_ENV": "test",
        "POSTGRES_HOST": "127.0.0.1",
        "POSTGRES_DB": _DB,
        "POSTGRES_USER": _USER,
        "POSTGRES_PASSWORD": _PASSWORD,
    }
    for key, value in expected.items():
        if os.getenv(key) != value:
            pytest.fail(f"Unexpected test setting for {key}.", pytrace=False)
    port = int(os.environ["POSTGRES_PORT"])
    assert 1024 < port <= 65535 and port != 5432
    context = _docker("context", "show")
    endpoint = _docker(
        "context", "inspect", context, "--format", "{{.Endpoints.docker.Host}}"
    )
    assert endpoint == "npipe:////./pipe/dockerDesktopLinuxEngine"
    cli = ("--context", context)
    assert (
        _docker(*cli, "info", "--format", "{{.OSType}}/{{.OperatingSystem}}")
        == "linux/Docker Desktop"
    )
    ids = _docker(
        *cli,
        "ps",
        "-aq",
        "--no-trunc",
        "--filter",
        f"label=com.docker.compose.project={_PROJECT}",
    ).splitlines()
    assert len(ids) == 1 and len(ids[0]) == 64
    info = json.loads(_docker(*cli, "inspect", "--type", "container", ids[0]))[0]
    assert info["Config"]["Labels"]["com.docker.compose.service"] == "postgres-test"
    assert (
        info["Config"]["Image"] == "postgres:18"
        and info["State"]["Health"]["Status"] == "healthy"
    )
    assert info["HostConfig"]["Tmpfs"] == {"/var/lib/postgresql": "size=512m"}
    assert all(
        item["Type"] == "tmpfs" and item["Destination"] == "/var/lib/postgresql"
        for item in info["Mounts"]
    )
    assert info["NetworkSettings"]["Ports"] == {
        "5432/tcp": [{"HostIp": "127.0.0.1", "HostPort": str(port)}],
    }
    inside = _docker(
        *cli,
        "exec",
        ids[0],
        "psql",
        "-XqwAt",
        "-h",
        "/var/run/postgresql",
        "-U",
        _USER,
        "-d",
        _DB,
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        f"BEGIN READ ONLY; {_IDENTITY}; COMMIT;",
    )
    with psycopg.connect(
        host="127.0.0.1",
        port=port,
        dbname=_DB,
        user=_USER,
        password=_PASSWORD,
        connect_timeout=5,
        autocommit=True,
    ) as connection:
        with connection.transaction():
            connection.execute("SET TRANSACTION READ ONLY")
            actual = connection.execute(_IDENTITY).fetchone()
            assert actual[:3] == (_DB, _USER, 18)
            assert actual[4].startswith("/var/lib/postgresql/")
            assert "|".join(map(str, actual)) == inside
            assert connection.execute(
                "SELECT count(*) FROM pg_tables WHERE schemaname = 'public'"
            ).fetchone() == (0,), "This test requires a freshly created empty cluster."
        yield connection, port


def _migrate(*args):
    subprocess.run(
        [sys.executable, "-m", "alembic", *args],
        cwd=_BACKEND,
        check=True,
        timeout=45,
        capture_output=True,
    )


def _tables(connection):
    return {
        row[0]
        for row in connection.execute(
            "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
        )
    }


@pytest.fixture(scope="module")
def migrated_database(verified_database):
    connection, port = verified_database
    _migrate("upgrade", _BASE)
    operational = _tables(connection)
    assert {"alerts", "cases", "security_events", "users"} <= operational
    _migrate("upgrade", _HEAD)
    assert _tables(connection) == operational | _TABLES
    assert connection.execute("SELECT id FROM replay_execution_control").fetchall() == [
        (1,)
    ]
    _migrate("downgrade", _BASE)
    assert _tables(connection) == operational
    assert connection.execute("SELECT version_num FROM alembic_version").fetchone() == (
        _BASE,
    )
    _migrate("upgrade", "head")
    assert _tables(connection) == operational | _TABLES
    assert connection.execute("SELECT version_num FROM alembic_version").fetchone() == (
        _HEAD,
    )
    yield connection, port


@pytest.fixture
def database(migrated_database):
    connection, port = migrated_database
    engine = create_async_engine(
        URL.create(
            "postgresql+psycopg",
            username=_USER,
            password=_PASSWORD,
            host="127.0.0.1",
            port=port,
            database=_DB,
        ),
        poolclass=NullPool,
    )
    sessions = async_sessionmaker(engine)
    factory = (
        (lambda: asyncio.SelectorEventLoop(selectors.SelectSelector()))
        if sys.platform == "win32"
        else None
    )
    with asyncio.Runner(loop_factory=factory) as runner:
        try:
            yield runner.run, ReplayRunStore(sessions), sessions, engine
        finally:
            runner.run(engine.dispose())
            connection.execute("DELETE FROM replay_runs")
            connection.execute("DELETE FROM users WHERE email LIKE '%@test.invalid'")


async def _owner(sessions):
    owner = uuid4()
    async with sessions.begin() as db:
        await db.execute(
            insert(User).values(
                id=owner,
                email=f"{owner}@test.invalid",
                display_name="test owner",
                password_hash="test",
            )
        )
    return owner


def _request(owner, key="proof", weak=False):
    return state.RunRequest(
        owner,
        key,
        WEAKENED.version_id if weak else state.AUTHORING_VERSION_ID,
        WEAKENED.definition.compatibility.evaluator_contract
        if weak
        else "encoded-powershell/v1",
    )


def _payload(version=state.AUTHORING_VERSION_ID):
    grade, evidence = (
        b'{"synthetic_test_grade":true}',
        b'{"synthetic_test_evidence":true}',
    )
    return ResultPayload(
        state.Evidence(
            version,
            hashlib.sha256(grade).hexdigest(),
            hashlib.sha256(evidence).hexdigest(),
            False,
        ),
        grade,
        evidence,
    )


def test_additive_migration_round_trip(migrated_database):
    connection, _ = migrated_database
    assert _TABLES <= _tables(connection)


def test_owner_scope_foreign_keys_and_concurrent_idempotency(database):
    run, store, sessions, _ = database

    async def exercise():
        one, two = await _owner(sessions), await _owner(sessions)
        left, right = await asyncio.gather(
            store.admit(_request(one)), store.admit(_request(one))
        )
        assert left.run_id == right.run_id
        with pytest.raises(StoreError, match="idempotency_conflict"):
            await store.admit(_request(one, weak=True))
        assert await store.get(two, left.run_id) is None
        assert await store.get_result(two, left.run_id) is None
        assert await store.cancel(two, left.run_id) is None
        assert (await store.admit(_request(two))).run_id != left.run_id
        with pytest.raises(IntegrityError):
            async with sessions.begin() as db:
                await db.execute(delete(User).where(User.id == one))
        with pytest.raises(StoreError, match="inactive_owner"):
            await store.admit(_request(uuid4()))

    run(exercise())


def test_concurrent_claims_stale_tokens_and_atomic_completion(database):
    run, store, sessions, _ = database

    async def exercise():
        owner = await _owner(sessions)
        first = await store.admit(_request(owner))
        await store.admit(_request(owner, "next"))
        claimed = [
            item for item in await asyncio.gather(store.claim(), store.claim()) if item
        ]
        assert len(claimed) == 1 and claimed[0].run_id == first.run_id
        lease = claimed[0].attempts[-1].lease
        with pytest.raises(state.StateError, match="Stale"):
            await store.publish(replace(lease, token=uuid4()), _payload())
        result = await store.publish(lease, _payload())
        assert result.status is state.Status.COMPLETED and not result.evidence.passed
        assert await store.get_result(owner, first.run_id) == _payload()
        assert (await store.claim()).run_id != first.run_id
        with pytest.raises(state.StateError, match="Stale"):
            await store.publish(lease, _payload())

    run(exercise())


def test_capacity_limits_and_retry_reservation(database):
    run, store, sessions, _ = database

    async def exercise():
        owner = await _owner(sessions)
        first = await store.admit(_request(owner))
        await store.admit(_request(owner, "second"))
        with pytest.raises(StoreError, match="owner_active_limit"):
            await store.admit(_request(owner, "third"))
        assert (await store.admit(_request(owner))).run_id == first.run_id
        claimed = await store.claim()
        for _ in range(8):
            await store.admit(_request(await _owner(sessions)))
        with pytest.raises(StoreError, match="global_queue_limit"):
            await store.admit(_request(await _owner(sessions)))
        queued = await store.fail(
            claimed.attempts[-1].lease, state.Failure.TRANSIENT_INFRASTRUCTURE
        )
        assert queued.status is state.Status.QUEUED
        async with sessions() as db:
            assert (
                await db.scalar(
                    select(func.count())
                    .select_from(replay_runs)
                    .where(replay_runs.c.status == "QUEUED")
                )
                == 10
            )

    run(exercise())


def test_admission_rate_and_retained_record_limit(database):
    run, store, sessions, _ = database

    async def exercise():
        owner = await _owner(sessions)
        for index in range(5):
            row = await store.admit(_request(owner, str(index)))
            await store.cancel(owner, row.run_id)
        with pytest.raises(StoreError, match="owner_rate_limit"):
            await store.admit(_request(owner, "sixth"))
        other = await _owner(sessions)
        async with sessions.begin() as db:
            sample = (await db.execute(select(replay_runs).limit(1))).mappings().one()
            await db.execute(
                insert(replay_runs),
                [
                    dict(sample, id=uuid4(), idempotency_key=f"fixture-{i}")
                    for i in range(251)
                ],
            )
        with pytest.raises(StoreError, match="retained_run_limit"):
            await store.admit(_request(other))

    run(exercise())


def test_cancellation_and_retry_exhaustion(database):
    run, store, sessions, _ = database

    async def exercise():
        owner = await _owner(sessions)
        first = await store.admit(_request(owner))
        claimed = await store.claim()
        pending = await store.cancel(owner, first.run_id)
        assert pending.status is state.Status.RUNNING and pending.cancel_requested_at
        assert (
            await store.publish(claimed.attempts[-1].lease, _payload())
        ).status is state.Status.CANCELLED
        assert await store.get_result(owner, first.run_id) is None
        await store.admit(_request(owner, "retry"))
        for number in (1, 2):
            claimed = await store.claim()
            assert claimed.attempt_number == number
            final = await store.fail(
                claimed.attempts[-1].lease, state.Failure.TRANSIENT_INFRASTRUCTURE
            )
        assert (
            final.status is state.Status.FAILED
            and final.failure is state.Failure.RETRY_EXHAUSTED
        )

    run(exercise())


async def _age(sessions, run_id, age):
    async with sessions.begin() as db:
        columns = (
            "created_at",
            "queue_deadline",
            "finished_at",
            "retention_deadline",
            "cancel_requested_at",
            "expired_at",
            "purge_at",
        )
        await db.execute(
            update(replay_runs)
            .where(replay_runs.c.id == run_id)
            .values(
                **{name: replay_runs.c[name] - age for name in columns},
            )
        )
        await db.execute(
            update(replay_attempts)
            .where(replay_attempts.c.run_id == run_id)
            .values(
                **{
                    name: replay_attempts.c[name] - age
                    for name in ("started_at", "lease_deadline", "ended_at")
                },
            )
        )


def test_recovery_expiry_and_tombstone_cleanup(database):
    run, store, sessions, _ = database

    async def exercise():
        owner = await _owner(sessions)
        first = await store.admit(_request(owner))
        claimed = await store.claim()
        assert await store.reconcile_lease() is None
        await _age(sessions, first.run_id, timedelta(seconds=31))
        old = claimed.attempts[-1].lease
        with pytest.raises(state.StateError, match="lease expired"):
            await store.publish(old, _payload())
        recovered = await store.reconcile_lease()
        assert recovered.status is state.Status.QUEUED
        assert recovered.attempts[-1].failure is state.Failure.LEASE_LOST
        new = await store.claim()
        assert new.attempt_number == 2
        with pytest.raises(state.StateError, match="Stale"):
            await store.publish(old, _payload())
        await store.publish(new.attempts[-1].lease, _payload())
        await _age(sessions, first.run_id, timedelta(days=8))
        assert await store.get_result(owner, first.run_id) is None
        assert (await store.get(owner, first.run_id)).status is state.Status.EXPIRED
        assert await store.expire_due() == 1
        assert await store.purge_due() == 0
        assert (await store.admit(_request(owner))).run_id == first.run_id
        await _age(sessions, first.run_id, timedelta(days=8))
        assert await store.purge_due() == 1
        assert await store.get(owner, first.run_id) is None
        second = await store.admit(_request(owner))
        assert second.run_id != first.run_id
        await _age(sessions, second.run_id, timedelta(minutes=11))
        assert await store.claim() is None
        assert (await store.get(owner, second.run_id)).status is state.Status.EXPIRED

    run(exercise())


def test_publication_rolls_back_and_leaves_operational_tables_unchanged(
    database, migrated_database
):
    run, store, sessions, engine = database
    connection, _ = migrated_database
    before = [
        connection.execute(f"SELECT count(*) FROM {table}").fetchone()
        for table in ("alerts", "cases", "security_events")
    ]

    def reject_update(conn, cursor, statement, parameters, context, executemany):
        if statement.startswith("UPDATE replay_runs"):
            raise RuntimeError("injected transaction failure after result INSERT")

    async def exercise():
        owner = await _owner(sessions)
        first = await store.admit(_request(owner))
        claimed = await store.claim()
        lease = claimed.attempts[-1].lease
        event.listen(engine.sync_engine, "before_cursor_execute", reject_update)
        try:
            with pytest.raises(RuntimeError, match="injected transaction failure"):
                await store.publish(lease, _payload())
        finally:
            event.remove(engine.sync_engine, "before_cursor_execute", reject_update)
        assert (await store.get(owner, first.run_id)).status is state.Status.RUNNING
        async with sessions() as db:
            assert (
                await db.scalar(select(func.count()).select_from(replay_results)) == 0
            )
        await store.publish(lease, _payload())

    run(exercise())
    assert before == [
        connection.execute(f"SELECT count(*) FROM {table}").fetchone()
        for table in ("alerts", "cases", "security_events")
    ]


def test_payload_integrity_and_database_size_constraint(database):
    run, store, sessions, _ = database
    payload = _payload()
    with pytest.raises(StoreError, match="result_digest_mismatch"):
        replace(payload, grade=b"changed")
    with pytest.raises(StoreError, match="invalid_result_payload"):
        replace(payload, evidence=b"x" * 32768)

    async def exercise():
        owner = await _owner(sessions)
        first = await store.admit(_request(owner))
        claimed = await store.claim()
        lease = claimed.attempts[-1].lease
        with pytest.raises(state.StateError, match="version differs"):
            await store.publish(lease, _payload(WEAKENED.version_id))
        assert await store.get_result(owner, first.run_id) is None
        await store.publish(lease, payload)
        with pytest.raises(IntegrityError):
            async with sessions.begin() as db:
                await db.execute(
                    update(replay_results)
                    .where(replay_results.c.run_id == first.run_id)
                    .values(evidence_bytes=b"x" * 32768)
                )
        assert await store.get_result(owner, first.run_id) == payload

    run(exercise())
