import hashlib
import json
import subprocess
import sys
from dataclasses import FrozenInstanceError, replace
from pathlib import Path
from types import MappingProxyType

import pytest

from app.services import replay_harness
from app.services.replay_evaluator import ENCODED_POWERSHELL_RULE_ID, UnsupportedRuleError
from app.services.replay_fixtures import MAX_EVENTS, MAX_FILE_BYTES, FixtureError, load_replay_fixture
from app.services.replay_harness import run_replay


BACKEND = Path(__file__).resolve().parents[1]
FIXTURE = Path(__file__).with_name("fixtures") / "encoded_powershell.json"
RULE = ENCODED_POWERSHELL_RULE_ID


def invoke_cli(path, *args):
    return subprocess.run(
        [sys.executable, "-B", "-m", "app.services.replay_harness", str(path), *args],
        cwd=BACKEND,
        capture_output=True,
        timeout=15,
    )


def test_independent_cli_runs_are_byte_identical_and_hash_verifiable():
    first = invoke_cli(FIXTURE)
    second = invoke_cli(FIXTURE, "--rule", RULE)
    assert first.returncode == second.returncode == 0, (first.stderr, second.stderr)
    assert first.stderr == second.stderr == b""
    assert first.stdout == second.stdout

    manifest = json.loads(first.stdout)
    output_hash = manifest.pop("output_sha256")
    canonical = json.dumps(manifest, sort_keys=True, ensure_ascii=True, separators=(",", ":")).encode("utf-8")
    assert output_hash == hashlib.sha256(canonical).hexdigest()
    assert manifest["manifest_version"] == 1
    assert manifest["fixture_id"] == "synthetic-encoded-powershell"
    assert manifest["input_sha256"] == load_replay_fixture(FIXTURE).content_hash
    assert manifest["evaluator_contract"] == "encoded-powershell/v1"
    assert manifest["rule_id"] == RULE
    assert manifest["status"] == "completed"
    assert (manifest["event_count"], manifest["match_count"], manifest["non_match_count"], manifest["error_count"]) == (3, 1, 2, 0)
    assert [(r["source_event_id"], r["ordinal"], r["event_time"], r["outcome"]) for r in manifest["results"]] == [
        ("encoded", 1, "2026-11-20T12:00:00.000000Z", "match"),
        ("benign-tie", 2, "2026-11-20T12:00:00.000000Z", "no_match"),
        ("benign-later", 0, "2026-11-20T12:01:00.000000Z", "no_match"),
    ]
    assert all(r["rule_id"] == RULE and r["error"] is None for r in manifest["results"])
    assert b"command_line" not in first.stdout


def test_replay_preserves_input_provenance_and_has_no_shared_run_state(tmp_path):
    fixture = load_replay_fixture(FIXTURE)
    original = load_replay_fixture(FIXTURE)
    manifest = run_replay(fixture, RULE)
    payload = json.loads(FIXTURE.read_bytes())
    payload["events"] = payload["events"][:1]
    path = tmp_path / "alternate.json"
    path.write_text(json.dumps(payload), encoding="utf-8")
    alternate = run_replay(load_replay_fixture(path), RULE)
    assert alternate.event_count == alternate.non_match_count == 1
    assert alternate.input_sha256 != manifest.input_sha256
    assert run_replay(fixture, RULE).canonical_json() == manifest.canonical_json()
    assert fixture == original
    assert manifest.provenance == fixture.provenance
    with pytest.raises(TypeError):
        manifest.provenance["source"] = "changed"
    with pytest.raises(FrozenInstanceError):
        manifest.results[0].decision.outcome = "no_match"
    with pytest.raises(FrozenInstanceError):
        manifest.match_count = 0


def test_evaluation_errors_mark_the_run_failed_and_preserve_event_evidence(monkeypatch, capsysbinary):
    fixture = load_replay_fixture(FIXTURE)
    event = replace(fixture.events[0], fields=MappingProxyType({}))
    malformed = replace(fixture, events=(event, *fixture.events[1:]))
    result = run_replay(malformed, RULE)
    assert result.status == "failed"
    assert (result.event_count, result.match_count, result.non_match_count, result.error_count) == (3, 0, 2, 1)
    decision = json.loads(result.canonical_json())["results"][0]
    assert decision == {
        "source_event_id": "encoded", "ordinal": 1, "event_time": "2026-11-20T12:00:00.000000Z",
        "outcome": "error", "rule_id": RULE, "error": {"code": "missing_field", "field": "event_type"},
    }
    monkeypatch.setattr(replay_harness, "load_replay_fixture", lambda _: malformed)
    assert replay_harness.main([str(FIXTURE)]) == 1
    assert capsysbinary.readouterr().out == result.canonical_json()


def test_rejects_unsupported_rule_and_fixture_contract():
    fixture = load_replay_fixture(FIXTURE)
    with pytest.raises(UnsupportedRuleError, match="Only the encoded-powershell rule"):
        run_replay(fixture, "auth-brute-force")
    with pytest.raises(FixtureError, match="Unsupported fixture schema version"):
        run_replay(replace(fixture, schema_version=2), RULE)
    with pytest.raises(FixtureError, match="event count"):
        run_replay(replace(fixture, events=()), RULE)
    with pytest.raises(FixtureError, match="event count"):
        run_replay(replace(fixture, events=(fixture.events[0],) * (MAX_EVENTS + 1)), RULE)


@pytest.mark.parametrize(("data", "message"), [
    (b'{', b"Malformed fixture JSON"),
    (b'{"schema_version":2}', b"missing required fields"),
    (b' ' * (MAX_FILE_BYTES + 1), b"maximum file size"),
], ids=["malformed", "incomplete", "oversized"])
def test_invalid_local_fixture_has_no_success_output(tmp_path, data, message):
    path = tmp_path / "invalid.json"
    path.write_bytes(data)
    result = invoke_cli(path)
    assert result.returncode == 2
    assert result.stdout == b""
    assert message in result.stderr


def test_cli_rejects_unsupported_rule():
    result = invoke_cli(FIXTURE, "--rule", "auth-brute-force")
    assert result.returncode == 2
    assert result.stdout == b""
    assert b"Only the encoded-powershell rule" in result.stderr


def test_bounded_manifest_has_one_record_per_event_and_omits_event_content(tmp_path):
    payload = json.loads(FIXTURE.read_bytes())
    sample = payload["events"][0]
    payload["events"] = [
        {**sample, "event_id": str(index), "fields": {**sample["fields"], "command_line": "X" * 512}}
        for index in range(MAX_EVENTS)
    ]
    path = tmp_path / "bounded.json"
    path.write_text(json.dumps(payload), encoding="utf-8")
    result = run_replay(load_replay_fixture(path), RULE)
    assert len(result.results) == result.event_count == result.non_match_count == MAX_EVENTS
    serialized = result.canonical_json()
    assert len(serialized) < path.stat().st_size
    assert b"X" * 512 not in serialized


def test_offline_cli_blocks_operational_imports_and_side_effects():
    program = """
import os
import runpy
import sys

class ImportBoundary:
    def find_spec(self, fullname, path=None, target=None):
        allowed = {
            "app", "app.services", "app.services.replay_harness", "app.services.replay_fixtures",
            "app.services.replay_evaluator", "app.services.single_event_evaluator",
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
sys.argv = ["replay_harness", sys.argv[2]]
sys.meta_path.insert(0, ImportBoundary())
sys.addaudithook(block_effects)
runpy.run_module("app.services.replay_harness", run_name="__main__")
"""
    result = subprocess.run(
        [sys.executable, "-I", "-B", "-c", program, str(BACKEND), str(FIXTURE)],
        capture_output=True,
        timeout=15,
    )
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout)["match_count"] == 1
