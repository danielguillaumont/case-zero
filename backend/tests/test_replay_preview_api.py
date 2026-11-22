import asyncio
import hashlib
import json
import os
import selectors
import socket
import subprocess
import sys
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import UUID

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import event

from app.services.replay_evidence import verify_replay_evidence


BACKEND = Path(__file__).resolve().parents[1]
URL = "/api/lab/replay-preview"
COMPARISON_URL = "/api/lab/comparison-preview"
RULE = "encoded-powershell"
USER_ID = UUID("00000000-0000-4000-8000-000000000001")
TEST_ENV = {
    "POSTGRES_HOST": "127.0.0.1",
    "POSTGRES_PORT": "55432",
    "POSTGRES_DB": "casezero_test",
    "POSTGRES_USER": "preview-test",
    "POSTGRES_PASSWORD": "preview-test-only",
    "JWT_SECRET_KEY": "preview-tests-only-key-not-for-deployment",
}


@pytest.mark.parametrize(("app_env", "flag", "dotenv_values", "enabled"), [
    (None, None, {}, False),
    ("development", None, {}, False),
    ("development", "TRUE", {}, False),
    ("development", "true ", {}, False),
    ("development", None, {"CASE_ZERO_REPLAY_PREVIEW": "true"}, False),
    (None, "true", {"APP_ENV": "development"}, False),
    ("development", "true", {}, True),
    ("test", "true", {}, True),
    ("production", "true", {}, False),
])
def test_route_registration_in_isolated_process(app_env, flag, dotenv_values, enabled):
    program = """
import json
import os
import sys
from pathlib import Path
import dotenv
from fastapi.testclient import TestClient
from sqlalchemy import event

values, expected = json.loads(sys.argv[1])

def mock_dotenv(*args, **kwargs):
    for key, value in values.items():
        os.environ.setdefault(key, value)

dotenv.load_dotenv = mock_dotenv
original_lstat = Path.lstat

def forbid_bundle_access(path):
    if "replay_assets" in path.parts:
        raise AssertionError("Bundle read during app import")
    return original_lstat(path)

Path.lstat = forbid_bundle_access
from app.main import app
from app.database import engine

def forbid_database(*args, **kwargs):
    raise AssertionError("Gate test attempted database checkout")

event.listen(engine.sync_engine, "do_connect", forbid_database)
event.listen(engine.sync_engine, "checkout", forbid_database)
preview_path = "/api/lab/replay-preview"
comparison_path = "/api/lab/comparison-preview"
operations = app.openapi()["paths"]
assert (preview_path in operations) is expected
assert (comparison_path in operations) is expected
assert TestClient(app).post(preview_path).status_code == (401 if expected else 404)
assert TestClient(app).get(comparison_path).status_code == (401 if expected else 404)
assert ("app.api.routes.replay_preview" in sys.modules) is expected
assert ("app.api.routes.comparison_preview" in sys.modules) is expected
assert "/api/events" in operations and "/api/auth/me" in operations
if expected:
    assert set(operations[preview_path]) == {"post"}
    assert "requestBody" not in operations[preview_path]["post"]
    assert set(operations[comparison_path]) == {"get"}
    assert "requestBody" not in operations[comparison_path]["get"]
"""
    env = {key: os.environ[key] for key in ("SYSTEMROOT", "PATH") if key in os.environ}
    env.update(TEST_ENV)
    if app_env is not None:
        env["APP_ENV"] = app_env
    if flag is not None:
        env["CASE_ZERO_REPLAY_PREVIEW"] = flag
    result = subprocess.run(
        [sys.executable, "-B", "-c", program, json.dumps([dotenv_values, enabled])],
        cwd=BACKEND, env=env, capture_output=True, text=True, timeout=20,
    )
    assert result.returncode == 0, result.stderr


def create_selector_event_loop():
    return asyncio.SelectorEventLoop(selectors.SelectSelector())


@pytest.fixture
def preview(monkeypatch):
    # In normal suite runs conftest already validated configuration. The
    # focused --noconftest run must select test mode before its first import.
    if "app.config" not in sys.modules:
        monkeypatch.setenv("APP_ENV", "test")
        for key, value in TEST_ENV.items():
            monkeypatch.setenv(key, value)
    from app import auth, database
    from app.api.routes import comparison_preview
    from app.api.routes import replay_preview as route
    from app.models.user import User
    from app.security import create_access_token

    user = User(id=USER_ID, role="analyst", is_active=True)
    lookup = AsyncMock(return_value=user)
    audit = AsyncMock()
    monkeypatch.setattr(auth, "record_security_audit_event", audit)

    class IdentityOnlySession:
        async def get(self, model, user_id):
            assert model is User and user_id == USER_ID
            return await lookup()

    async def mock_session():
        yield IdentityOnlySession()

    def forbid_database(*args, **kwargs):
        pytest.fail("Preview attempted real database access.")

    app = FastAPI()
    app.include_router(route.router)
    app.include_router(comparison_preview.router)
    app.dependency_overrides[database.get_database_session] = mock_session
    engine = database.engine.sync_engine
    listeners = ("do_connect", "checkout", "before_cursor_execute")
    for name in listeners:
        event.listen(engine, name, forbid_database)
    backend_options = {"loop_factory": create_selector_event_loop} if sys.platform == "win32" else {}
    # The stored user's role, rather than this deliberately different claim,
    # must control authorization.
    headers = {"Authorization": f"Bearer {create_access_token(USER_ID, 'viewer')}"}
    try:
        with TestClient(app, backend_options=backend_options) as client:
            yield client, route, user, headers, lookup, audit
    finally:
        for name in listeners:
            event.remove(engine, name, forbid_database)


@pytest.mark.parametrize(("method", "url"), [("POST", URL), ("GET", COMPARISON_URL)])
def test_missing_authentication(preview, method, url):
    client, _, _, _, lookup, audit = preview
    response = client.request(method, url)
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"
    lookup.assert_not_awaited()
    audit.assert_not_awaited()


@pytest.mark.parametrize(("role", "active", "audit_event"), [
    ("analyst", False, "auth.inactive_session"),
    ("viewer", True, "rbac.access_denied"),
])
@pytest.mark.parametrize(("method", "url"), [("POST", URL), ("GET", COMPARISON_URL)])
def test_denials_preserve_auth_auditing(preview, monkeypatch, role, active, audit_event, method, url):
    from app.api.routes import comparison_preview

    client, route, user, headers, lookup, audit = preview
    user.role = role
    user.is_active = active
    monkeypatch.setattr(route, "run_replay", lambda *args: pytest.fail("Denied request ran replay."))
    monkeypatch.setattr(comparison_preview, "grade_loaded_replay", lambda *args: pytest.fail("Denied request ran comparison."))
    assert client.request(method, url, headers=headers).status_code == 403
    lookup.assert_awaited_once()
    audit.assert_awaited_once()
    assert audit.await_args.kwargs["event_type"] == audit_event


@pytest.mark.parametrize(("method", "url"), [("POST", URL), ("GET", COMPARISON_URL)])
def test_invalid_token_retains_audit(preview, method, url):
    client, _, _, _, lookup, audit = preview
    assert client.request(method, url, headers={"Authorization": "Bearer invalid"}).status_code == 401
    lookup.assert_not_awaited()
    assert audit.await_args.kwargs["event_type"] == "auth.invalid_token"


@pytest.mark.parametrize("role", ["analyst", "administrator"])
def test_allowed_roles_get_verified_bounded_repeatable_manifest(preview, tmp_path, role):
    client, route, user, headers, lookup, audit = preview
    user.role = role
    original_assets = route._FIXTURE_PATH.read_bytes(), route._MANIFEST_PATH.read_bytes()
    first = client.post(URL, headers=headers)
    second = client.post(URL, headers=headers)
    assert first.status_code == second.status_code == 200, first.text
    assert first.headers["cache-control"] == "no-store"
    assert first.content == second.content
    assert len(first.content) <= 16 * 1024
    payload = first.json()
    manifest = payload["manifest"]
    assert manifest == json.loads(original_assets[1])
    assert payload["verification"] == {"status": "verified", "reason": None}
    assert (manifest["event_count"], manifest["match_count"], manifest["non_match_count"], manifest["error_count"]) == (3, 1, 2, 0)
    assert [(row["source_event_id"], row["ordinal"], row["outcome"]) for row in manifest["results"]] == [
        ("encoded", 1, "match"), ("benign-tie", 2, "no_match"), ("benign-later", 0, "no_match"),
    ]
    returned = tmp_path / "returned-manifest.json"
    returned.write_text(json.dumps(manifest), encoding="utf-8")
    assert verify_replay_evidence(returned, route._FIXTURE_PATH, RULE).status == "verified"
    original_fixture = BACKEND / "tests" / "fixtures" / "encoded_powershell.json"
    assert verify_replay_evidence(route._MANIFEST_PATH, original_fixture, RULE).status == "verified"
    assert (route._FIXTURE_PATH.read_bytes(), route._MANIFEST_PATH.read_bytes()) == original_assets
    assert b"command_line" not in first.content
    assert lookup.await_count == 2
    audit.assert_not_awaited()


@pytest.mark.parametrize("request_args", [
    {"params": {"rule": RULE}},
    {"content": b" "},
    {"json": {}},
    {"files": {"fixture": ("fixture.json", b"{}")}},
    {"content": iter([b"first", b"second"])},
], ids=["query", "body", "json", "multipart", "streamed"])
def test_rejects_request_inputs_without_running_replay(preview, monkeypatch, request_args):
    client, route, _, headers, _, _ = preview
    monkeypatch.setattr(route, "run_replay", lambda *args: pytest.fail("Invalid request ran replay."))
    assert client.post(URL, headers=headers, **request_args).status_code == 400


@pytest.mark.parametrize("asset", ["_FIXTURE_PATH", "_MANIFEST_PATH"])
@pytest.mark.parametrize("problem", ["missing", "directory", "oversized", "tampered"])
def test_unsafe_or_tampered_bundle_returns_503(preview, monkeypatch, tmp_path, asset, problem):
    client, route, _, headers, _, _ = preview
    path = tmp_path / "bad.json"
    original = getattr(route, asset)
    if problem == "directory":
        path.mkdir()
    elif problem == "oversized":
        path.write_bytes(b" " * (16 * 1024 + 1))
    elif problem == "tampered":
        content = json.loads(original.read_bytes())
        if asset == "_FIXTURE_PATH":
            content["events"][0]["fields"]["command_line"] = "Get-Date"
        else:
            content["output_sha256"] = "0" * 64
        path.write_text(json.dumps(content), encoding="utf-8")
    monkeypatch.setattr(route, asset, path)

    response = client.post(URL, headers=headers)
    assert response.status_code == 503
    assert response.json() == {"detail": {"code": "preview_unavailable"}}


def test_returned_manifest_must_match_verified_expected_manifest(preview, monkeypatch):
    client, route, _, headers, _, _ = preview
    original_run = route.run_replay
    monkeypatch.setattr(
        route, "run_replay", lambda *args: replace(original_run(*args), match_count=0, non_match_count=3),
    )
    assert client.post(URL, headers=headers).status_code == 503


def test_failed_replay_and_oversized_serialized_output_fail_closed(preview, monkeypatch):
    client, route, _, headers, _, _ = preview
    original_run = route.run_replay
    with monkeypatch.context() as scoped:
        scoped.setattr(route, "run_replay", lambda *args: replace(original_run(*args), status="failed"))
        assert client.post(URL, headers=headers).status_code == 503
    monkeypatch.setattr(route, "_MAX_RESPONSE_BYTES", 16)
    assert client.post(URL, headers=headers).status_code == 503


@pytest.mark.parametrize(("method", "url"), [("POST", URL), ("GET", COMPARISON_URL)])
def test_preview_execution_has_no_outbound_network_or_operational_io(preview, monkeypatch, method, url):
    client, _, _, headers, lookup, audit = preview

    def forbid_network(*args, **kwargs):
        pytest.fail("Replay attempted outbound network access.")

    # TestClient's portal is already running. The ASGI request is in-process.
    monkeypatch.setattr(socket.socket, "connect", forbid_network)
    monkeypatch.setattr(socket.socket, "connect_ex", forbid_network)
    monkeypatch.setattr(socket, "getaddrinfo", forbid_network)
    assert client.request(method, url, headers=headers).status_code == 200
    lookup.assert_awaited_once()
    audit.assert_not_awaited()


@pytest.mark.parametrize("role", ["analyst", "administrator"])
def test_comparison_preview_reproduces_the_published_offline_comparison(preview, role):
    client, _, user, headers, lookup, audit = preview
    user.role = role
    first, second = (client.get(COMPARISON_URL, headers=headers) for _ in range(2))
    assert first.status_code == second.status_code == 200
    assert first.content == second.content
    assert first.headers["cache-control"] == "no-store"
    assert len(first.content) <= 16 * 1024
    payload = first.json()
    assert payload["schema_version"] == 1
    assert payload["baseline"]["labeled_satisfaction"] == {"numerator": 2, "denominator": 3}
    assert payload["candidate"]["labeled_satisfaction"] == {"numerator": 3, "denominator": 3}
    assert payload["baseline"]["passed"] is False
    assert payload["candidate"]["passed"] is True
    assert payload["change_totals"] == {"improved": 1, "regressed": 0, "unchanged": 2, "inconclusive": 0}
    assert payload["candidate_minus_baseline"]["true_positive"] == 1
    assert payload["candidate_minus_baseline"]["false_negative"] == -1
    assert payload["expectations"][-1]["expectation_id"] == "encoded-switch"
    assert payload["expectations"][-1]["change"] == "improved"
    digest = payload.pop("comparison_sha256")
    assert digest == "537a653234548dca4490997a4c344c4cbaa1673c1314b95357eefda55e7136a2"
    assert digest == hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    assert b"command_line" not in first.content and b"pwsh.exe" not in first.content
    assert lookup.await_count == 2
    audit.assert_not_awaited()


@pytest.mark.parametrize("kwargs", [
    {"params": {"fixture": "untrusted-path"}},
    {"content": b" "},
    {"json": {}},
    {"content": iter([b"chunk"])},
], ids=["query", "body", "json", "streamed"])
def test_comparison_rejects_input_before_reading_assets(preview, monkeypatch, kwargs):
    from app.api.routes import comparison_preview

    client, _, _, headers, _, _ = preview
    monkeypatch.setattr(comparison_preview, "_read_bundled_asset", lambda *_: pytest.fail("Invalid request read an asset."))
    assert client.request("GET", COMPARISON_URL, headers=headers, **kwargs).status_code == 400


@pytest.mark.parametrize("asset", ["_FIXTURE_PATH", "_EXPECTATIONS_PATH"])
@pytest.mark.parametrize("problem", ["missing", "directory", "oversized", "tampered"])
def test_comparison_asset_validation_precedes_evaluation(preview, monkeypatch, tmp_path, asset, problem):
    from app.api.routes import comparison_preview

    client, _, _, headers, _, _ = preview
    target = tmp_path / "bundle.json"
    if problem == "directory":
        target.mkdir()
    elif problem == "oversized":
        target.write_bytes(b"x" * (16 * 1024 + 1))
    elif problem == "tampered":
        data = json.loads(getattr(comparison_preview, asset).read_bytes())
        if asset == "_FIXTURE_PATH":
            data["events"][0]["fields"]["command_line"] = "TEST_ONLY_PRIVATE_VALUE"
        else:
            data["expectations"][0]["rationale"] = "TEST_ONLY_PRIVATE_VALUE"
        target.write_text(json.dumps(data), encoding="utf-8")
    monkeypatch.setattr(comparison_preview, asset, target)
    monkeypatch.setattr(comparison_preview, "grade_loaded_replay", lambda *_: pytest.fail("Invalid asset was evaluated."))
    response = client.get(COMPARISON_URL, headers=headers)
    assert response.status_code == 503
    assert response.json() == {"detail": {"code": "comparison_preview_unavailable"}}
    assert response.headers["cache-control"] == "no-store"


@pytest.mark.parametrize("failure", ["exception", "extra_field", "changed_result", "oversized"])
def test_comparison_internal_failures_are_sanitized(preview, monkeypatch, failure):
    from app.api.routes import comparison_preview

    client, _, _, headers, _, _ = preview
    compare = comparison_preview.compare_replay_summaries

    def malformed(*args):
        if failure == "exception":
            raise KeyError("TEST_ONLY_PRIVATE_VALUE")
        data = json.loads(compare(*args).canonical_json())
        if failure == "extra_field":
            data["candidate"]["totals"]["untrusted"] = "TEST_ONLY_PRIVATE_VALUE"
        else:
            data["candidate"]["passed"] = False
        return SimpleNamespace(canonical_json=lambda: json.dumps(data).encode())

    if failure == "oversized":
        monkeypatch.setattr(comparison_preview, "_MAX_RESPONSE_BYTES", 16)
    else:
        monkeypatch.setattr(comparison_preview, "compare_replay_summaries", malformed)
    response = client.get(COMPARISON_URL, headers=headers)
    assert response.status_code == 503
    assert response.json() == {"detail": {"code": "comparison_preview_unavailable"}}
    assert "TEST_ONLY_PRIVATE_VALUE" not in response.text
