import hashlib
import json
import subprocess
import sys
from pathlib import Path

import pytest

from app.services.replay_evidence import MAX_MANIFEST_BYTES, VerificationResult, verify_replay_evidence
from app.services.replay_fixtures import MAX_EVENTS, MAX_FIELD_BYTES, MAX_NESTING_DEPTH


BACKEND = Path(__file__).resolve().parents[1]
FIXTURE = Path(__file__).with_name("fixtures") / "encoded_powershell.json"
RULE = "encoded-powershell"


def with_output_digest(payload):
    content = {key: value for key, value in payload.items() if key != "output_sha256"}
    canonical = json.dumps(content, ensure_ascii=True, separators=(",", ":"), sort_keys=True).encode("utf-8")
    return {**content, "output_sha256": hashlib.sha256(canonical).hexdigest()}


@pytest.fixture
def manifest_path(tmp_path):
    # Authored from the v1 contract and the published demo result, without
    # invoking the harness to obtain the expected decisions.
    payload = {
        "manifest_version": 1,
        "fixture_id": "synthetic-encoded-powershell",
        "provenance": {"source": "synthetic", "description": "Offline encoded PowerShell replay demonstration"},
        "input_sha256": "025c8bb93536b73227406c8c74e2f64d8592350b328792147a77f628357beb6d",
        "rule_id": RULE,
        "evaluator_contract": "encoded-powershell/v1",
        "status": "completed",
        "event_count": 3,
        "match_count": 1,
        "non_match_count": 2,
        "error_count": 0,
        "results": [
            {"source_event_id": event_id, "ordinal": ordinal, "event_time": timestamp,
             "rule_id": RULE, "outcome": outcome, "error": None}
            for event_id, ordinal, timestamp, outcome in (
                ("encoded", 1, "2026-11-20T12:00:00.000000Z", "match"),
                ("benign-tie", 2, "2026-11-20T12:00:00.000000Z", "no_match"),
                ("benign-later", 0, "2026-11-20T12:01:00.000000Z", "no_match"),
            )
        ],
    }
    path = tmp_path / "manifest.json"
    path.write_text(json.dumps(with_output_digest(payload), indent=2), encoding="utf-8")
    return path


def test_verifies_independently_constructed_manifest_without_mutating_inputs(manifest_path):
    before = manifest_path.read_bytes(), FIXTURE.read_bytes()
    assert verify_replay_evidence(manifest_path, FIXTURE, RULE) == VerificationResult("verified")
    assert verify_replay_evidence(manifest_path, FIXTURE, RULE) == VerificationResult("verified")
    assert (manifest_path.read_bytes(), FIXTURE.read_bytes()) == before


def test_bad_output_digest_is_rejected(manifest_path):
    payload = json.loads(manifest_path.read_bytes())
    payload["output_sha256"] = "0" * 64
    manifest_path.write_text(json.dumps(payload), encoding="utf-8")
    assert verify_replay_evidence(manifest_path, FIXTURE, RULE) == VerificationResult("mismatch", "output_hash_mismatch")


@pytest.mark.parametrize(("key", "value", "status", "reason"), [
    ("input_sha256", "0" * 64, "mismatch", "input_hash_mismatch"),
    ("manifest_version", 2, "invalid", "unsupported_manifest_version"),
    ("manifest_version", True, "invalid", "invalid_manifest"),
    ("fixture_id", "changed", "mismatch", "replay_mismatch"),
    ("provenance", {"source": "other"}, "mismatch", "replay_mismatch"),
    ("evaluator_contract", "encoded-powershell/v2", "invalid", "unsupported_evaluator_contract"),
    ("rule_id", "auth-brute-force", "invalid", "unsupported_rule"),
    ("event_count", 4, "mismatch", "replay_mismatch"),
    ("match_count", 0, "mismatch", "replay_mismatch"),
    ("non_match_count", 3, "mismatch", "replay_mismatch"),
    ("error_count", 1, "mismatch", "replay_mismatch"),
    ("status", "failed", "mismatch", "replay_mismatch"),
    ("match_count", True, "invalid", "invalid_manifest"),
    ("match_count", 1.0, "invalid", "invalid_manifest"),
    ("unknown", "field", "invalid", "invalid_manifest"),
])
def test_recomputed_hash_does_not_make_tampered_metadata_valid(manifest_path, key, value, status, reason):
    payload = json.loads(manifest_path.read_bytes())
    payload[key] = value
    manifest_path.write_text(json.dumps(with_output_digest(payload)), encoding="utf-8")
    assert verify_replay_evidence(manifest_path, FIXTURE, RULE) == VerificationResult(status, reason)


@pytest.mark.parametrize(("updates", "status", "reason"), [
    ({"source_event_id": "changed"}, "mismatch", "replay_mismatch"),
    ({"ordinal": 8}, "mismatch", "replay_mismatch"),
    ({"event_time": "2026-11-20T11:00:00.000000Z"}, "mismatch", "replay_mismatch"),
    ({"rule_id": "auth-brute-force"}, "mismatch", "replay_mismatch"),
    ({"outcome": "no_match"}, "mismatch", "replay_mismatch"),
    ({"outcome": "error", "error": {"field": "event_type", "code": "missing_field"}}, "mismatch", "replay_mismatch"),
    ({"source_event_id": "benign-tie"}, "invalid", "invalid_manifest"),
    ({"ordinal": 2}, "invalid", "invalid_manifest"),
    ({"event_time": "2026-11-20T12:00:00Z"}, "invalid", "invalid_manifest"),
    ({"outcome": "error"}, "invalid", "invalid_manifest"),
    ({"source_event_id": "x" * (MAX_FIELD_BYTES + 1)}, "invalid", "invalid_manifest"),
], ids=[
    "id", "ordinal", "timestamp", "rule", "decision", "error",
    "duplicate-id", "duplicate-ordinal", "noncanonical-time", "missing-error", "oversized-id",
])
def test_recomputed_hash_does_not_make_tampered_results_valid(manifest_path, updates, status, reason):
    payload = json.loads(manifest_path.read_bytes())
    payload["results"][0].update(updates)
    manifest_path.write_text(json.dumps(with_output_digest(payload)), encoding="utf-8")
    assert verify_replay_evidence(manifest_path, FIXTURE, RULE) == VerificationResult(status, reason)


def test_reordered_results_fail_even_with_a_recomputed_hash(manifest_path):
    payload = json.loads(manifest_path.read_bytes())
    payload["results"].reverse()
    manifest_path.write_text(json.dumps(with_output_digest(payload)), encoding="utf-8")
    assert verify_replay_evidence(manifest_path, FIXTURE, RULE) == VerificationResult("mismatch", "replay_mismatch")


def test_modified_or_invalid_independently_supplied_fixture(manifest_path, tmp_path):
    path = tmp_path / "changed-fixture.json"
    fixture = json.loads(FIXTURE.read_bytes())
    fixture["events"][0]["fields"]["command_line"] = "Get-Date"
    path.write_text(json.dumps(fixture), encoding="utf-8")
    assert verify_replay_evidence(manifest_path, path, RULE) == VerificationResult("mismatch", "input_hash_mismatch")
    path.write_bytes(b"{")
    assert verify_replay_evidence(manifest_path, path, RULE) == VerificationResult("invalid", "invalid_fixture")
    assert verify_replay_evidence(manifest_path, FIXTURE, "ENCODED-POWERSHELL") == VerificationResult("invalid", "unsupported_rule")


@pytest.mark.parametrize("data", [
    b'{', b'\xff', b'[]', b'{"rule_id":"first","rule_id":"second"}',
    b'{"results":[{"ordinal":0,"ordinal":1}]}', b'{"event_count":NaN}',
    b'[' * (MAX_NESTING_DEPTH + 1) + b']' * (MAX_NESTING_DEPTH + 1),
], ids=["malformed", "non-utf8", "array", "duplicate-root", "duplicate-nested", "nonfinite", "depth"])
def test_invalid_json_evidence_fails_closed(manifest_path, data):
    manifest_path.write_bytes(data)
    assert verify_replay_evidence(manifest_path, FIXTURE, RULE) == VerificationResult("invalid", "invalid_manifest")


def test_manifest_resource_limits(manifest_path):
    payload = json.loads(manifest_path.read_bytes())
    payload["results"] = [payload["results"][0]] * (MAX_EVENTS + 1)
    manifest_path.write_text(json.dumps(with_output_digest(payload)), encoding="utf-8")
    assert verify_replay_evidence(manifest_path, FIXTURE, RULE) == VerificationResult("invalid", "invalid_manifest")
    manifest_path.write_bytes(b" " * (MAX_MANIFEST_BYTES + 1))
    assert verify_replay_evidence(manifest_path, FIXTURE, RULE) == VerificationResult("invalid", "manifest_too_large")


def test_missing_or_nonlocal_manifest_is_rejected(tmp_path):
    for path in (tmp_path / "missing", tmp_path, Path("//evidence-test.invalid/share/manifest.json")):
        assert verify_replay_evidence(path, FIXTURE, RULE) == VerificationResult("invalid", "manifest_unreadable")


def test_saved_harness_evidence_verifies_with_operational_imports_and_side_effects_blocked(tmp_path):
    evidence = subprocess.check_output(
        [sys.executable, "-B", "-m", "app.services.replay_harness", str(FIXTURE)],
        cwd=BACKEND, timeout=15,
    )
    manifest = tmp_path / "saved.json"
    manifest.write_bytes(evidence)
    program = """
import os
import sys
from pathlib import Path

class ImportBoundary:
    def find_spec(self, fullname, path=None, target=None):
        allowed = {
            "app", "app.services", "app.services.replay_harness", "app.services.replay_fixtures",
            "app.services.replay_evaluator", "app.services.single_event_evaluator", "app.services.replay_evidence",
        }
        if fullname.startswith(("app.", "sqlalchemy", "psycopg", "fastapi")) and fullname not in allowed:
            raise AssertionError("Operational import attempted: " + fullname)

def block_effects(event, args):
    if event.startswith(("socket.", "sqlite3.", "subprocess.")) or event in {
        "os.system", "os.exec", "os.posix_spawn", "os.remove", "os.rename", "os.mkdir", "os.rmdir",
    }:
        raise AssertionError("Side effect attempted: " + event)
    if event == "open" and args[2] & (os.O_WRONLY | os.O_RDWR | os.O_CREAT):
        raise AssertionError("Write attempted")

sys.path.insert(0, sys.argv[1])
sys.meta_path.insert(0, ImportBoundary())
sys.addaudithook(block_effects)
from app.services.replay_evidence import verify_replay_evidence
result = verify_replay_evidence(Path(sys.argv[2]), Path(sys.argv[3]), "encoded-powershell")
assert result.status == "verified", result
"""
    result = subprocess.run(
        [sys.executable, "-I", "-B", "-c", program, str(BACKEND), str(manifest), str(FIXTURE)],
        capture_output=True, timeout=15,
    )
    assert result.returncode == 0, result.stderr
