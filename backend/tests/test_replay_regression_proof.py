import json
import subprocess
import sys
from dataclasses import replace
from pathlib import Path
from types import MappingProxyType

import pytest

from app.services import replay_evaluator, replay_regression_proof as proof
from app.services.replay_evaluator import (
    UnsupportedRuleError,
    evaluate_fixture,
    evaluate_fixture_version,
    evaluate_regression_fixture_version,
)
from app.services.replay_fixtures import load_replay_fixture
from app.services.rule_versions import RuleDefinition, RuleVersion

BACKEND = Path(__file__).resolve().parents[1]
ASSETS = BACKEND / "app" / "replay_assets"
FIXTURE = ASSETS / "encoded_powershell.json"


def test_real_predicates_disagree_only_on_short_switch_in_bundled_fixture():
    fixture = load_replay_fixture(FIXTURE)
    weakened = evaluate_regression_fixture_version(fixture, proof.WEAKENED)
    corrected = evaluate_fixture_version(fixture, proof.CORRECTED)
    assert corrected.version_id == (
        "encoded-powershell",
        "b243c81ae85fb7a63d053837434d32a9eb349ffd56e0e2d6acb6908495c8ce80",
    )
    assert weakened.version_id == proof.WEAKENED.version_id != corrected.version_id
    assert [d.outcome for d in weakened.decisions] == [
        "no_match",
        "no_match",
        "no_match",
    ]
    assert [d.outcome for d in corrected.decisions] == ["match", "no_match", "no_match"]
    assert evaluate_fixture(fixture, corrected.version_id[0]) == corrected.decisions
    with pytest.raises(UnsupportedRuleError):
        evaluate_fixture_version(fixture, proof.WEAKENED)
    with pytest.raises(UnsupportedRuleError):
        evaluate_fixture(fixture, proof.WEAKENED.definition.predicate_id)
    assert corrected.version_id[0] == proof.WEAKENED.definition.rule_id


@pytest.mark.parametrize(
    ("field_updates", "expected"),
    [
        ({"command_line": "pwsh.exe -EncodedCommand TEST"}, "match"),
        ({"command_line": "pwsh.exe -EncodedCommandExtra TEST"}, "no_match"),
        (
            {
                "command_line": "pwsh.exe -EncodedCommand TEST",
                "process_name": "other.exe",
            },
            "no_match",
        ),
        ({"command_line": 123}, "error"),
    ],
)
def test_long_switch_and_field_validation_use_real_predicates(field_updates, expected):
    fixture = load_replay_fixture(FIXTURE)
    event = fixture.events[0]
    changed = replace(event, fields=MappingProxyType({**event.fields, **field_updates}))
    synthetic_fixture = replace(fixture, events=(changed,))
    for version in (proof.WEAKENED, proof.CORRECTED):
        result = evaluate_regression_fixture_version(synthetic_fixture, version)
        assert result.decisions[0].outcome == expected


def test_cli_is_byte_stable_and_expected_weakened_failure_exits_zero():
    command = [sys.executable, "-B", "-m", "app.services.replay_regression_proof"]
    results = [
        subprocess.run(
            command, cwd=BACKEND, capture_output=True, timeout=15, check=True
        )
        for _ in range(2)
    ]
    assert results[0].stdout == results[1].stdout
    assert results[0].stderr == results[1].stderr == b""
    payload = json.loads(results[0].stdout)
    assert payload["proof_passed"] is True
    weakened, corrected = payload["reports"]
    assert (weakened["name"], weakened["diagnostic"], weakened["passed"]) == (
        "weakened",
        "FAIL",
        False,
    )
    assert (corrected["name"], corrected["diagnostic"], corrected["passed"]) == (
        "corrected",
        "PASS",
        True,
    )
    assert weakened["executed_version_id"] == list(proof.WEAKENED.version_id)
    assert corrected["executed_version_id"] == list(proof.CORRECTED.version_id)
    assert weakened["classifications"] == {
        "benign-get-date": "true_negative",
        "benign-get-service": "true_negative",
        "encoded-switch": "false_negative",
    }
    assert corrected["classifications"] == {
        **weakened["classifications"],
        "encoded-switch": "true_positive",
    }


@pytest.mark.parametrize(
    "regression", ["miss", "false-positive", "same-behavior", "bad-digest"]
)
def test_proof_gate_exits_nonzero_on_regressions(monkeypatch, capsys, regression):
    corrected = replay_evaluator.matches_encoded_powershell
    if regression == "miss":
        monkeypatch.setattr(
            replay_evaluator, "matches_encoded_powershell", lambda *_: False
        )
    elif regression == "false-positive":
        monkeypatch.setattr(
            replay_evaluator, "matches_encoded_powershell", lambda *_: True
        )
    elif regression == "same-behavior":
        monkeypatch.setattr(replay_evaluator, "_matches_long_switch", corrected)
    else:
        malformed = RuleVersion(proof.WEAKENED.definition)
        object.__setattr__(malformed, "content_sha256", "0" * 64)
        monkeypatch.setattr(proof, "WEAKENED", malformed)
    assert proof.main() == 1
    captured = capsys.readouterr()
    if regression == "bad-digest":
        assert "failed validation" in captured.err
    else:
        assert json.loads(captured.out)["proof_passed"] is False


def test_proof_gate_rejects_changed_fixture(tmp_path, monkeypatch, capsys):
    payload = json.loads(FIXTURE.read_bytes())
    payload["fixture_id"] = "unexpected"
    path = tmp_path / FIXTURE.name
    path.write_text(json.dumps(payload), encoding="utf-8")
    monkeypatch.setattr(proof, "_FIXTURE", path)
    assert proof.main() == 1
    assert "different fixture revision" in capsys.readouterr().err


def test_offline_binding_rejects_malformed_and_unsupported_versions():
    fixture = load_replay_fixture(FIXTURE)
    with pytest.raises(ValueError, match="does not support this predicate_id"):
        RuleDefinition(predicate_id=proof.WEAKENED.definition.predicate_id)

    forged = RuleVersion(proof.WEAKENED.definition)
    object.__setattr__(forged, "content_sha256", proof.CORRECTED.content_sha256)
    with pytest.raises(UnsupportedRuleError, match="digest does not match"):
        evaluate_regression_fixture_version(fixture, forged)

    for field, bad_value in (
        ("predicate_id", "unknown"),
        ("compatibility", proof.CORRECTED.definition.compatibility),
    ):
        definition = replace(proof.WEAKENED.definition)
        object.__setattr__(definition, field, bad_value)
        with pytest.raises(UnsupportedRuleError, match="Invalid or unsupported"):
            evaluate_regression_fixture_version(fixture, RuleVersion(definition))
