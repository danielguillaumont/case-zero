import json
import subprocess
import sys
from dataclasses import FrozenInstanceError, replace
from pathlib import Path
from types import MappingProxyType

import pytest

from app.services.replay_evaluator import (
    ENCODED_POWERSHELL_RULE_ID,
    EvaluationError,
    EvaluationResult,
    UnsupportedRuleError,
    evaluate_fixture,
)
from app.services.replay_fixtures import load_replay_fixture
from app.services.single_event_evaluator import matches_encoded_powershell


def write_fixture(tmp_path, *events):
    path = tmp_path / "fixture.json"
    path.write_text(
        json.dumps({
            "schema_version": 1,
            "fixture_id": "synthetic-evaluation",
            "provenance": {"source": "synthetic"},
            "events": [
                {"event_id": event_id, "event_time": timestamp, "fields": {"source": "synthetic", **fields}}
                for event_id, timestamp, fields in events
            ],
        }),
        encoding="utf-8",
    )
    return path


def load_single_event(tmp_path, fields):
    return load_replay_fixture(write_fixture(tmp_path, ("evt-original", "2026-11-20T12:00:00Z", fields)))


@pytest.mark.parametrize(("event_type", "process_name", "command_line", "matched"), [
    ("process_creation", "powershell.exe", "powershell.exe -enc TEST", True),
    ("process_creation", "powershell.exe", "Get-Service", False),
    ("PROCESS_CREATION", r"C:\Tools\PwSh.ExE", "pwsh\t-ENCODEDCOMMAND\tTEST", True),
    ("process_creation", "/tools/pwsh", "-enc", True),
    ("process_creation", "pwsh", "-encodedcommand:TEST", False),
    ("process_creation", "pwsh", "prefix-enc TEST", False),
    ("process_creation", "pwsh ", "-enc TEST", False),
    ("process_creation ", "pwsh", "-enc TEST", False),
    ("process_creation", "cmd.exe", "-enc TEST", False),
    ("authentication", "pwsh", "-enc TEST", False),
])
def test_encoded_rule_matches_existing_predicate(tmp_path, event_type, process_name, command_line, matched):
    fixture = load_single_event(tmp_path, {
        "event_type": event_type, "process_name": process_name, "command_line": command_line,
    })

    assert matches_encoded_powershell(event_type, process_name, command_line) is matched
    assert evaluate_fixture(fixture, ENCODED_POWERSHELL_RULE_ID) == (
        EvaluationResult("encoded-powershell", "evt-original", 0, "match" if matched else "no_match"),
    )


@pytest.mark.parametrize("fields", [
    {},
    {"command_line": "-enc TEST"},
    {"process_name": "pwsh"},
    {"process_name": None, "command_line": "-enc TEST"},
    {"process_name": "pwsh", "command_line": None},
    {"process_name": "", "command_line": "-enc TEST"},
    {"process_name": "pwsh", "command_line": ""},
])
def test_absent_null_and_empty_optional_values_do_not_match(tmp_path, fields):
    fixture = load_single_event(tmp_path, {"event_type": "process_creation", **fields})
    assert evaluate_fixture(fixture, ENCODED_POWERSHELL_RULE_ID) == (
        EvaluationResult("encoded-powershell", "evt-original", 0, "no_match"),
    )


@pytest.mark.parametrize(("fields", "code", "field"), [
    ({}, "missing_field", "event_type"),
    ({"event_type": None}, "invalid_field", "event_type"),
    ({"event_type": ""}, "invalid_field", "event_type"),
    ({"event_type": " \t"}, "invalid_field", "event_type"),
    ({"event_type": 42}, "invalid_field", "event_type"),
    ({"event_type": "process_creation", "process_name": False}, "invalid_field", "process_name"),
    ({"event_type": "process_creation", "command_line": 42}, "invalid_field", "command_line"),
    ({"event_type": "authentication", "command_line": []}, "invalid_field", "command_line"),
])
def test_invalid_in_memory_fields_produce_bounded_errors(tmp_path, fields, code, field):
    fixture = load_single_event(tmp_path, {"event_type": "process_creation"})
    event = replace(fixture.events[0], fields=MappingProxyType(fields))
    malformed = replace(fixture, events=(event,))

    assert evaluate_fixture(malformed, ENCODED_POWERSHELL_RULE_ID) == (
        EvaluationResult("encoded-powershell", "evt-original", 0, "error", EvaluationError(code, field)),
    )


def test_results_are_repeatable_immutable_and_preserve_fixture_order(tmp_path):
    process = {"event_type": "process_creation", "process_name": "pwsh"}
    path = write_fixture(
        tmp_path,
        ("latest", "2026-11-20T12:01:00Z", process),
        ("z-tie", "2026-11-20T14:00:00+02:00", {**process, "command_line": "-enc TEST"}),
        ("earliest", "2026-11-20T11:59:00Z", process),
        ("a-tie", "2026-11-20T12:00:00Z", process),
    )
    fixture = load_replay_fixture(path)
    original_hash = fixture.content_hash
    original_fields = [dict(event.fields) for event in fixture.events]
    results = evaluate_fixture(fixture, ENCODED_POWERSHELL_RULE_ID)

    assert [(result.source_event_id, result.ordinal, result.outcome) for result in results] == [
        ("earliest", 2, "no_match"), ("z-tie", 1, "match"), ("a-tie", 3, "no_match"), ("latest", 0, "no_match"),
    ]
    assert isinstance(results, tuple)
    with pytest.raises(FrozenInstanceError):
        results[0].outcome = "match"
    assert results == evaluate_fixture(fixture, ENCODED_POWERSHELL_RULE_ID)
    assert original_hash == fixture.content_hash
    assert original_fields == [dict(event.fields) for event in fixture.events]


@pytest.mark.parametrize("rule_id", ["auth-brute-force", "powershell-download-cradle", "ENCODED-POWERSHELL", ""])
def test_unsupported_rule_fails_before_reading_events(tmp_path, rule_id):
    fixture = load_single_event(tmp_path, {"event_type": "process_creation"})
    with pytest.raises(UnsupportedRuleError, match="Only the encoded-powershell rule"):
        evaluate_fixture(replace(fixture, events=None), rule_id)


def test_evaluation_in_isolated_process_blocks_operational_imports_and_io(tmp_path):
    path = write_fixture(tmp_path, ("evt-inert", "2026-11-20T12:00:00Z", {
        "event_type": "process_creation",
        "process_name": "pwsh",
        "command_line": "pwsh -enc TEST; embedded command text",
    }))
    program = """
import sys
from pathlib import Path

class ImportBoundary:
    def find_spec(self, fullname, path=None, target=None):
        allowed = {
            "app", "app.services", "app.services.replay_evaluator",
            "app.services.replay_fixtures", "app.services.single_event_evaluator",
        }
        if fullname.startswith(("app.", "sqlalchemy", "psycopg", "fastapi")) and fullname not in allowed:
            raise AssertionError("Operational import attempted: " + fullname)

sys.path.insert(0, sys.argv[1])
sys.meta_path.insert(0, ImportBoundary())
from app.services.replay_evaluator import evaluate_fixture
from app.services.replay_fixtures import load_replay_fixture

fixture = load_replay_fixture(Path(sys.argv[2]))

def block_io(event, args):
    if event == "open" or event.startswith(("socket.", "sqlite3.", "subprocess.", "os.")):
        raise AssertionError("I/O attempted during evaluation: " + event)

sys.addaudithook(block_io)
result, = evaluate_fixture(fixture, "encoded-powershell")
assert result.source_event_id == "evt-inert" and result.outcome == "match"
assert not hasattr(result, "command_line")
"""
    backend = Path(__file__).resolve().parents[1]
    result = subprocess.run(
        [sys.executable, "-I", "-B", "-c", program, str(backend), str(path)],
        capture_output=True,
        text=True,
        timeout=15,
    )
    assert result.returncode == 0, result.stderr
