import hashlib
import json
from dataclasses import FrozenInstanceError, replace
from pathlib import Path

import pytest

from app.services import replay_grading
from app.services.replay_evaluator import EvaluationError, evaluate_fixture_version
from app.services.replay_evidence import VerificationResult, verify_replay_evidence
from app.services.replay_expectations import ExpectationError
from app.services.replay_fixtures import load_replay_fixture
from app.services.replay_grading import GradeTotals, GradingError, grade_replay
from app.services.replay_harness import run_replay
from app.services.rule_versions import RuleDefinition, RuleVersion

FIXTURE = (
    Path(__file__).resolve().parents[1] / "app/replay_assets/encoded_powershell.json"
)
LABELS = FIXTURE.with_suffix(".expectations.json")
AUTHOR = RuleVersion(RuleDefinition())


def test_bundled_scenario_executes_selected_version_and_grades_cleanly():
    selected = RuleVersion(replace(AUTHOR.definition, title="Alternate title"))
    report = grade_replay(FIXTURE, LABELS, AUTHOR, selected)
    assert report.passed
    assert report.authoring_version_id == AUTHOR.version_id
    assert (
        report.executed_version_id == report.requested_version_id == selected.version_id
    )
    assert report.unlabeled_events == 0
    assert report.totals == GradeTotals(1, 2, 0, 0, 0, 0)
    assert [
        (grade.expectation_id, grade.classification) for grade in report.grades
    ] == [
        ("benign-get-date", "true_negative"),
        ("benign-get-service", "true_negative"),
        ("encoded-switch", "true_positive"),
    ]
    assert (
        report.canonical_json()
        == grade_replay(FIXTURE, LABELS, AUTHOR, selected).canonical_json()
    )
    with pytest.raises(FrozenInstanceError):
        report.grades[0].classification = "false_positive"
    with pytest.raises(FrozenInstanceError):
        report.totals.true_positive = 2


def test_synthetic_decisions_distinguish_misses_false_alarms_and_errors(monkeypatch):
    evaluation = evaluate_fixture_version(load_replay_fixture(FIXTURE), AUTHOR)
    encoded, date, service = evaluation.decisions
    synthetic = replace(
        evaluation,
        decisions=(
            replace(
                service,
                outcome="error",
                error=EvaluationError("invalid_field", "command_line"),
            ),
            replace(date, outcome="match"),
            replace(encoded, outcome="no_match"),
        ),
    )
    monkeypatch.setattr(
        replay_grading, "evaluate_fixture_version", lambda *_: synthetic
    )
    report = grade_replay(FIXTURE, LABELS, AUTHOR, AUTHOR)
    assert not report.passed
    assert report.totals == GradeTotals(0, 0, 1, 1, 1, 0)
    assert [grade.classification for grade in report.grades] == [
        "false_positive",
        "evaluation_error",
        "false_negative",
    ]
    assert (
        report.grades[1].diagnostic
        == "Evaluator reported invalid_field for command_line."
    )


def test_unsupported_version_records_request_without_claiming_execution():
    definition = RuleDefinition()
    object.__setattr__(definition, "predicate_id", "unsupported/v2")
    version = RuleVersion(definition)
    report = grade_replay(FIXTURE, LABELS, AUTHOR, version)
    assert not report.passed
    assert report.requested_version_id == version.version_id
    assert report.executed_version_id is None
    assert report.totals == GradeTotals(0, 0, 0, 0, 0, 3)
    assert all(
        grade.classification == "unsupported" and grade.actual_outcome is None
        for grade in report.grades
    )


def test_identity_mismatches_fail_before_execution(tmp_path, monkeypatch):
    def unexpected_execution(*_):
        pytest.fail("Identity mismatch must prevent evaluation")

    monkeypatch.setattr(
        replay_grading, "evaluate_fixture_version", unexpected_execution
    )
    payload = json.loads(FIXTURE.read_bytes())
    path = tmp_path / "fixture.json"
    payload["events"][0]["fields"]["command_line"] = "Get-Date"
    path.write_text(json.dumps(payload), encoding="utf-8")
    with pytest.raises(ExpectationError, match="different fixture revision"):
        grade_replay(path, LABELS, AUTHOR, AUTHOR)
    payload = json.loads(FIXTURE.read_bytes())
    payload["fixture_id"] = "other"
    path.write_text(json.dumps(payload), encoding="utf-8")
    with pytest.raises(ExpectationError, match="different fixture revision"):
        grade_replay(path, LABELS, AUTHOR, AUTHOR)

    definition = RuleDefinition()
    object.__setattr__(definition, "rule_id", "other")
    with pytest.raises(ExpectationError, match="different rule ID"):
        grade_replay(FIXTURE, LABELS, AUTHOR, RuleVersion(definition))
    version = RuleVersion(RuleDefinition())
    object.__setattr__(version, "content_sha256", "0" * 64)
    with pytest.raises(GradingError, match="Selected rule-version identity"):
        grade_replay(FIXTURE, LABELS, AUTHOR, version)


@pytest.mark.parametrize(
    ("change", "message"),
    [
        ("missing", "missing one or more"),
        ("duplicate", "duplicate event"),
        ("unknown", "unknown event"),
        ("ordinal", "ID and ordinal"),
        ("rule", "different logical rule"),
        ("outcome", "Malformed evaluation outcome"),
        ("error", "Malformed evaluation error"),
        ("extra-error", "Unexpected error"),
        ("version", "Executed rule version"),
        ("malformed", "Malformed versioned evaluation"),
    ],
)
def test_malformed_synthetic_execution_fails_closed(monkeypatch, change, message):
    evaluation = evaluate_fixture_version(load_replay_fixture(FIXTURE), AUTHOR)
    first, *rest = evaluation.decisions
    changes = {
        "missing": tuple(rest),
        "duplicate": (first, first, *rest),
        "unknown": (replace(first, source_event_id="unknown"), *rest),
        "ordinal": (replace(first, ordinal=0), *rest),
        "rule": (replace(first, rule_id="other"), *rest),
        "outcome": (replace(first, outcome="unknown"), *rest),
        "error": (replace(first, outcome="error"), *rest),
        "extra-error": (
            replace(first, error=EvaluationError("missing_field", "event_type")),
            *rest,
        ),
    }
    if change == "version":
        synthetic = replace(
            evaluation, version_id=(AUTHOR.definition.rule_id, "0" * 64)
        )
    elif change == "malformed":
        synthetic = None
    else:
        synthetic = replace(evaluation, decisions=changes[change])
    monkeypatch.setattr(
        replay_grading, "evaluate_fixture_version", lambda *_: synthetic
    )
    with pytest.raises(GradingError, match=message):
        grade_replay(FIXTURE, LABELS, AUTHOR, AUTHOR)


def test_partial_labels_leave_other_events_unscored(tmp_path):
    payload = json.loads(LABELS.read_bytes())
    payload["expectations"] = payload["expectations"][1:2]
    path = tmp_path / "labels.json"
    path.write_text(json.dumps(payload), encoding="utf-8")
    report = grade_replay(FIXTURE, path, AUTHOR, AUTHOR)
    assert report.passed
    assert report.unlabeled_events == 2
    assert report.totals == GradeTotals(0, 1, 0, 0, 0, 0)


@pytest.mark.parametrize("schema_version", [True, 2])
def test_unsupported_grading_schema_fails_closed(schema_version):
    with pytest.raises(GradingError, match="Unsupported grading schema"):
        grade_replay(FIXTURE, LABELS, AUTHOR, AUTHOR, schema_version=schema_version)


def test_historical_replay_evidence_remains_reproducible():
    grade_replay(FIXTURE, LABELS, AUTHOR, AUTHOR)
    manifest = run_replay(load_replay_fixture(FIXTURE), AUTHOR.definition.rule_id)
    assert hashlib.sha256(manifest.canonical_json()).hexdigest() == (
        "f32268d29259b7cdb548573d3ef9985b4eddecdd5e4ad7f86fd8811bd29651a6"
    )
    assert verify_replay_evidence(
        FIXTURE.with_suffix(".manifest.json"), FIXTURE, AUTHOR.definition.rule_id
    ) == VerificationResult("verified")
