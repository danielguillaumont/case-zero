"""Opt-in integration tests for the verified Windows disposable database.

Run this file alone with --noconftest and CASE_ZERO_RUN_D3_INTEGRATION=1
after approval. Collection performs no Docker or database operations.
"""

import asyncio
import json
import os
import re
import selectors
import subprocess
import sys
from ipaddress import IPv6Address
from pathlib import Path
from uuid import uuid4

import psycopg
import pytest
from fastapi.testclient import TestClient
from psycopg import sql
from sqlalchemy import event


pytestmark = pytest.mark.skipif(
    os.environ.get("CASE_ZERO_RUN_D3_INTEGRATION") != "1",
    reason="D3 requires separate approval and the verified disposable database.",
)

ROOT = Path(__file__).resolve().parents[2]
PREVIEW = "/api/lab/replay-preview"
LOGIN = "/api/auth/login"
PROJECT = "case-zero-v21b-test"
SERVICE = "postgres-test"
DATABASE = "casezero_test"
USER = "casezero_local_test"
PASSWORD = "casezero-local-test-only"
TEST_ENV = {
    "APP_ENV": "test",
    "CASE_ZERO_REPLAY_PREVIEW": "true",
    "POSTGRES_HOST": "127.0.0.1",
    "POSTGRES_PORT": "55432",
    "POSTGRES_DB": DATABASE,
    "POSTGRES_USER": USER,
    "POSTGRES_PASSWORD": PASSWORD,
    "JWT_SECRET_KEY": "replay-preview-d3-test-only-signing-key",
}
IDENTITY_SQL = """
SELECT current_database(), current_user, current_setting('server_version_num')::int / 10000,
       system_identifier::text, current_setting('data_directory')
FROM pg_control_system()
"""
OPERATIONAL_TABLES = ("security_events", "alerts", "cases", "case_notes", "case_activities")


def _docker(*arguments):
    result = subprocess.run(
        ["docker", *arguments], cwd=ROOT, capture_output=True, text=True, timeout=20,
    )
    if result.returncode or result.stderr.strip():
        pytest.fail("Docker preflight command failed or emitted diagnostics.", pytrace=False)
    return result.stdout.strip()


def _verify_test_container():
    context = _docker("context", "show")
    endpoint = _docker("context", "inspect", context, "--format", "{{.Endpoints.docker.Host}}")
    assert endpoint in {
        "npipe:////./pipe/docker_engine", "npipe:////./pipe/dockerDesktopLinuxEngine",
    }, "D3 requires a local Docker Desktop named-pipe context."
    docker = ("--context", context)
    assert _docker(*docker, "info", "--format", "{{.OSType}}/{{.OperatingSystem}}") == "linux/Docker Desktop"
    ids = _docker(*docker, "ps", "-aq", "--no-trunc", "--filter", f"label=com.docker.compose.project={PROJECT}").splitlines()
    assert len(ids) == 1 and re.fullmatch(r"[0-9a-f]{64}", ids[0]), "Expected one test-project container."
    container_id = ids[0]
    compose_id = _docker(
        *docker, "compose", "--project-name", PROJECT,
        "--env-file", str(ROOT / "compose.test.env"), "--file", str(ROOT / "compose.test.yaml"),
        "ps", "--quiet", SERVICE,
    )
    assert re.fullmatch(r"[0-9a-f]{12,64}", compose_id) and container_id.startswith(compose_id)

    def inspect(template):
        return _docker(*docker, "inspect", "--type", "container", "--format", template, container_id)

    labels = json.loads(inspect("{{json .Config.Labels}}"))
    assert labels["com.docker.compose.project"] == PROJECT
    assert labels["com.docker.compose.service"] == SERVICE
    assert inspect("{{.Config.Image}} {{.State.Health.Status}}") == "postgres:18 healthy"
    assert json.loads(inspect("{{json .NetworkSettings.Ports}}")) == {
        "5432/tcp": [{"HostIp": "127.0.0.1", "HostPort": "55432"}],
    }
    assert json.loads(inspect("{{json .HostConfig.Tmpfs}}")) == {"/var/lib/postgresql": "size=512m"}
    mounts = json.loads(inspect("{{json .Mounts}}")) or []
    assert len(mounts) <= 1 and all(
        mount["Type"] == "tmpfs" and mount["Destination"] == "/var/lib/postgresql" for mount in mounts
    )
    return docker, container_id


@pytest.fixture(scope="module")
def disposable_database():
    if sys.flags.optimize:
        pytest.fail("D3 requires assertions to be enabled.", pytrace=False)
    assert not {"app.config", "app.database", "app.main"}.intersection(sys.modules), (
        "Run the opted-in D3 file alone with --noconftest, before loading application config."
    )
    for key, value in TEST_ENV.items():
        if os.environ.get(key) != value:
            pytest.fail(f"Set the exact disposable test setting for {key}.", pytrace=False)
    if any(key.upper().startswith(("PG", "DOCKER_", "COMPOSE_")) for key in os.environ):
        pytest.fail("Clear libpq, Docker and Compose overrides before running D3.", pytrace=False)
    if "DATABASE_URL" in os.environ:
        pytest.fail("Clear the ambient DATABASE_URL before running D3.", pytrace=False)

    docker, container_id = _verify_test_container()
    # The first database operations are read-only identity probes. Compare
    # the Windows endpoint to the verified container's cluster.
    identity = _docker(
        *docker, "exec", container_id, "/usr/bin/env", "-i",
        "PATH=/usr/lib/postgresql/18/bin:/usr/local/bin:/usr/bin:/bin",
        "psql", "-X", "-w", "-At", "-h", "/var/run/postgresql",
        "-U", USER, "-d", DATABASE, "-v", "ON_ERROR_STOP=1", "-c", f"BEGIN READ ONLY; {IDENTITY_SQL}; COMMIT;",
    )
    # psql may emit transaction command tags unless quiet mode is selected.
    inside = [line for line in identity.splitlines() if "|" in line]
    assert len(inside) == 1
    with psycopg.connect(
        host="127.0.0.1", port=55432, dbname=DATABASE, user=USER, password=PASSWORD,
        connect_timeout=5, autocommit=True,
    ) as db:
        with db.transaction():
            db.execute("SET TRANSACTION READ ONLY")
            actual = db.execute(IDENTITY_SQL).fetchone()
            assert actual[:3] == (DATABASE, USER, 18)
            assert actual[4].startswith("/var/lib/postgresql/")
            assert "|".join(map(str, actual)) == inside[0], "Host and container cluster identities differ."
            assert db.execute("SELECT version_num FROM public.alembic_version").fetchall() == [("e6ab1b3d315d",)]
        yield db


@pytest.fixture(scope="module")
def preview_app(disposable_database):
    from app import config
    from app.database import engine
    from app.main import app

    assert config.EXPLICIT_TEST_MODE and config.REPLAY_PREVIEW_ENABLED
    url = engine.url
    assert (url.host, url.port, url.database, url.username) == ("127.0.0.1", 55432, DATABASE, USER)
    if url.password != PASSWORD or url.query:
        pytest.fail("Application engine credentials or options differ from D3 settings.", pytrace=False)
    assert PREVIEW in app.openapi()["paths"]
    return app


@pytest.fixture(scope="module")
def accounts(disposable_database, preview_app):
    from app.security import hash_password
    from app.services.login_throttle import hash_login_identity

    db = disposable_database
    run_id = uuid4()
    source_ip = str(IPv6Address(int(IPv6Address("2001:db8::")) | (run_id.int & ((1 << 96) - 1))))
    users = {name: uuid4() for name in ("analyst", "administrator", "viewer", "inactive")}
    email = f"{run_id.hex}@replay-preview.casezero.dev"
    password = f"test-only-{run_id.hex}"
    password_hash = hash_password(password)
    with db.transaction():
        for name, user_id in users.items():
            db.execute(
                """INSERT INTO public.users (id, email, display_name, password_hash, role, is_active)
                   VALUES (%s, %s, %s, %s, %s, %s)""",
                (user_id, email if name == "analyst" else f"{name}-{email}", "Replay preview test",
                 password_hash, "analyst" if name == "inactive" else name, name != "inactive"),
            )
    try:
        yield users, source_ip, email, password
    finally:
        with db.transaction():
            db.execute(
                """DELETE FROM public.security_audit_events
                   WHERE source_ip = %s AND request_path = ANY(%s)
                     AND (user_id = ANY(%s) OR user_id IS NULL)""",
                (source_ip, [PREVIEW, LOGIN], list(users.values())),
            )
            db.execute("DELETE FROM public.login_throttles WHERE identity_hash = %s", (hash_login_identity(email),))
            db.execute("DELETE FROM public.users WHERE id = ANY(%s)", (list(users.values()),))


def _selector_loop():
    return asyncio.SelectorEventLoop(selectors.SelectSelector())


@pytest.fixture(scope="module")
def client(preview_app, accounts):
    backend_options = {"loop_factory": _selector_loop} if sys.platform == "win32" else {}
    with TestClient(preview_app, client=(accounts[1], 50000), backend_options=backend_options) as test_client:
        yield test_client


def _headers(accounts, name, claim="viewer"):
    from app.security import create_access_token

    return {"Authorization": f"Bearer {create_access_token(accounts[0][name], claim)}"}


def _audit_rows(db, source_ip, path, event_type):
    return db.execute(
        """SELECT user_id, outcome, request_method FROM public.security_audit_events
           WHERE source_ip = %s AND request_path = %s AND event_type = %s""",
        (source_ip, path, event_type),
    ).fetchall()


def _operational_snapshot(db):
    relations = db.execute(
        """SELECT schemaname, tablename FROM pg_tables
           WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
           ORDER BY schemaname, tablename"""
    ).fetchall()
    rows = [
        db.execute(sql.SQL(
            "SELECT count(*), md5(coalesce(string_agg(id::text || ':' || xmin::text, ',' ORDER BY id), '')) FROM {}"
        ).format(sql.Identifier("public", table))).fetchone()
        for table in OPERATIONAL_TABLES
    ]
    return relations, rows


@pytest.fixture
def linked_operational_records(disposable_database, preview_app):
    db = disposable_database
    event_id, alert_id, case_id, note_id, activity_id = (uuid4() for _ in range(5))
    with db.transaction():
        db.execute(
            """INSERT INTO public.security_events (id, event_type, source, event_time)
               VALUES (%s, 'authentication', 'synthetic-d3', '2026-01-01T00:00:00Z')""",
            (event_id,),
        )
        db.execute("INSERT INTO public.cases (id, title, status, priority) VALUES (%s, 'Synthetic D3 case', 'open', 'high')",
                   (case_id,))
        db.execute(
            """INSERT INTO public.alerts (id, title, severity, status, source, source_event_id, case_id)
               VALUES (%s, 'Synthetic D3 alert', 'high', 'new', 'synthetic-d3', %s, %s)""",
            (alert_id, event_id, case_id),
        )
        db.execute("INSERT INTO public.case_notes (id, case_id, author, content) VALUES (%s, %s, 'D3', 'Synthetic note')",
                   (note_id, case_id))
        db.execute(
            """INSERT INTO public.case_activities (id, case_id, event_type, message)
               VALUES (%s, %s, 'case_created', 'Synthetic activity')""",
            (activity_id, case_id),
        )
    try:
        yield
    finally:
        with db.transaction():
            for table, record_id in (
                ("case_activities", activity_id), ("case_notes", note_id), ("alerts", alert_id),
                ("cases", case_id), ("security_events", event_id),
            ):
                db.execute(sql.SQL("DELETE FROM {} WHERE id = %s").format(sql.Identifier("public", table)), (record_id,))


def test_unauthenticated_preview_returns_401(client):
    response = client.post(PREVIEW)
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


@pytest.mark.parametrize(("name", "event_type"), [
    ("viewer", "rbac.access_denied"), ("inactive", "auth.inactive_session"),
])
def test_denial_persists_real_security_audit(client, disposable_database, accounts, name, event_type):
    # Even a valid JWT carrying an elevated claim cannot override the database.
    response = client.post(PREVIEW, headers=_headers(accounts, name, claim="administrator"))
    assert response.status_code == 403
    assert _audit_rows(disposable_database, accounts[1], PREVIEW, event_type) == [(accounts[0][name], "denied", "POST")]


def test_bad_jwt_signature_returns_401_and_is_audited(client, disposable_database, accounts):
    headers = _headers(accounts, "analyst")
    message, signature = headers["Authorization"].rsplit(".", 1)
    replacement = "A" if signature[0] != "A" else "B"
    response = client.post(PREVIEW, headers={"Authorization": f"{message}.{replacement}{signature[1:]}"})
    assert response.status_code == 401
    assert _audit_rows(disposable_database, accounts[1], PREVIEW, "auth.invalid_token") == [(None, "failure", "POST")]


@pytest.mark.parametrize("role", ["analyst", "administrator"])
def test_real_auth_replay_is_repeatable_and_leaves_operational_state_unchanged(
    client, disposable_database, accounts, linked_operational_records, role,
):
    from app.database import engine

    before = _operational_snapshot(disposable_database)
    source_ip = accounts[1]
    audit_before = disposable_database.execute(
        "SELECT count(*) FROM public.security_audit_events WHERE source_ip = %s", (source_ip,),
    ).fetchone()
    statements = []

    def allow_user_lookup_only(conn, cursor, statement, parameters, context, executemany):
        normalized = " ".join(statement.lower().split())
        assert re.fullmatch(r"select users\..+ from users where users\.id = .+", normalized), (
            "Replay issued SQL beyond the real authentication lookup."
        )
        statements.append(normalized)

    event.listen(engine.sync_engine, "before_cursor_execute", allow_user_lookup_only)
    try:
        headers = _headers(accounts, role)
        first = client.post(PREVIEW, headers=headers)
        second = client.post(PREVIEW, headers=headers)
    finally:
        event.remove(engine.sync_engine, "before_cursor_execute", allow_user_lookup_only)

    assert first.status_code == second.status_code == 200
    assert first.content == second.content
    manifest = first.json()["manifest"]
    assert (manifest["event_count"], manifest["match_count"], manifest["non_match_count"], manifest["error_count"]) == (3, 1, 2, 0)
    assert len(manifest["results"]) == 3
    assert manifest["output_sha256"] == second.json()["manifest"]["output_sha256"]
    assert first.json()["verification"] == {"status": "verified", "reason": None}
    assert len(statements) == 2
    assert _operational_snapshot(disposable_database) == before
    assert disposable_database.execute(
        "SELECT count(*) FROM public.security_audit_events WHERE source_ip = %s", (source_ip,),
    ).fetchone() == audit_before


def test_existing_login_profile_and_rules_routes(client, disposable_database, accounts):
    users, source_ip, email, password = accounts
    response = client.post(LOGIN, data={"username": email, "password": password})
    assert response.status_code == 200
    headers = {"Authorization": f"Bearer {response.json()['access_token']}"}
    me = client.get("/api/auth/me", headers=headers)
    assert me.status_code == 200 and me.json()["id"] == str(users["analyst"])
    rules = client.get("/api/rules", headers=headers)
    assert rules.status_code == 200 and "encoded-powershell" in {rule["id"] for rule in rules.json()}
    assert _audit_rows(disposable_database, source_ip, LOGIN, "auth.login_success") == [(users["analyst"], "success", "POST")]
