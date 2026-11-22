import hashlib
import json
from dataclasses import FrozenInstanceError, replace
from pathlib import Path

import pytest

from app.services import replay_grading
from app.services.replay_evaluator import EvaluationError, evaluate_fixture_version
from app.services.replay_expectations import load_replay_expectations
from app.services.replay_fixtures import load_replay_fixture
from app.services.replay_grading import GradeTotals, grade_replay
from app.services.replay_regression_proof import CORRECTED, WEAKENED
from app.services.replay_summary import (
    LabeledSatisfaction,
    SummaryError,
    summarize_replay_grade,
)
from app.services.rule_versions import RuleDefinition, RuleVersion

BUNDLE = (
    Path(__file__).resolve().parents[1] / "app/replay_assets/encoded_powershell.json"
)
LABELS = BUNDLE.with_suffix(".expectations.json")


@pytest.fixture
def context():
    fixture = load_replay_fixture(BUNDLE)
    return fixture, load_replay_expectations(LABELS, fixture, CORRECTED)


@pytest.mark.parametrize(
    ("version", "totals", "passed", "satisfied", "diagnostic"),
    [
        (
            WEAKENED,
            GradeTotals(0, 2, 1, 0, 0, 0),
            False,
            2,
            "expected_detection_missed",
        ),
        (CORRECTED, GradeTotals(1, 2, 0, 0, 0, 0), True, 3, "all_expectations_passed"),
    ],
    ids=["weakened", "corrected"],
)
def test_bundled_summaries_use_real_grading(
    context, version, totals, passed, satisfied, diagnostic
):
    report = grade_replay(BUNDLE, LABELS, CORRECTED, version)
    summary = summarize_replay_grade(report, *context, version)
    assert summary.totals == report.totals == totals
    assert summary.passed is report.passed is passed
    assert (
        summary.total_events,
        summary.labeled_events,
        summary.unlabeled_events,
        summary.decisive_labeled_events,
    ) == (3, 3, 0, 3)
    assert summary.labeled_satisfaction == LabeledSatisfaction(satisfied, 3)
    assert [d.code for d in summary.diagnostics] == [diagnostic]
    assert (
        summary.requested_version_id
        == summary.executed_version_id
        == version.version_id
    )
    assert summary.authoring_version_id == CORRECTED.version_id
    assert summary.fixture_sha256 == context[0].content_hash
    assert summary.expectations_sha256 == context[1].content_sha256
    assert summary.grade_sha256 == hashlib.sha256(report.canonical_json()).hexdigest()
    assert summary.expectations[-1].expectation_id == "encoded-switch"
    assert summary.expectations[-1].event_id == "encoded"
    with pytest.raises(FrozenInstanceError):
        summary.passed = not passed


def test_false_positives_and_errors_keep_separate_counts(context, monkeypatch):
    fixture, _ = context
    evaluation = evaluate_fixture_version(fixture, CORRECTED)
    encoded, date, service = evaluation.decisions
    synthetic = replace(
        evaluation,
        decisions=(
            encoded,
            replace(date, outcome="match"),
            replace(
                service,
                outcome="error",
                error=EvaluationError("invalid_field", "command_line"),
            ),
        ),
    )
    monkeypatch.setattr(
        replay_grading, "evaluate_fixture_version", lambda *_: synthetic
    )
    report = grade_replay(BUNDLE, LABELS, CORRECTED, CORRECTED)
    summary = summarize_replay_grade(report, *context, CORRECTED)
    assert not summary.passed
    assert summary.totals == GradeTotals(1, 0, 0, 1, 1, 0)
    assert summary.decisive_labeled_events == 2
    assert summary.labeled_satisfaction == LabeledSatisfaction(1, 3)
    assert [d.code for d in summary.diagnostics] == [
        "unexpected_detection",
        "evaluation_failed",
        "incomplete_evidence",
    ]


def test_unsupported_results_have_no_decisive_labels_or_execution_identity(context):
    definition = RuleDefinition()
    object.__setattr__(definition, "predicate_id", "unsupported/v2")
    version = RuleVersion(definition)
    report = grade_replay(BUNDLE, LABELS, CORRECTED, version)
    summary = summarize_replay_grade(report, *context, version)
    assert not summary.passed
    assert summary.executed_version_id is None
    assert summary.totals == GradeTotals(0, 0, 0, 0, 0, 3)
    assert summary.labeled_events == 3
    assert summary.decisive_labeled_events == 0
    assert summary.labeled_satisfaction is None
    assert [d.code for d in summary.diagnostics] == [
        "unsupported_execution",
        "incomplete_evidence",
    ]


def test_unlabeled_events_are_excluded_from_the_denominator(tmp_path, context):
    fixture, _ = context
    asset = json.loads(LABELS.read_bytes())
    asset["expectations"] = asset["expectations"][:1]
    labels = tmp_path / "labels.json"
    labels.write_text(json.dumps(asset), encoding="utf-8")
    expectations = load_replay_expectations(labels, fixture, CORRECTED)
    report = grade_replay(BUNDLE, labels, CORRECTED, CORRECTED)
    summary = summarize_replay_grade(report, fixture, expectations, CORRECTED)
    assert summary.passed
    assert (summary.total_events, summary.labeled_events, summary.unlabeled_events) == (
        3,
        1,
        2,
    )
    assert summary.labeled_satisfaction == LabeledSatisfaction(1, 1)
    assert [d.code for d in summary.diagnostics] == [
        "all_expectations_passed",
        "unlabeled_events",
    ]


@pytest.mark.parametrize(
    ("change", "message"),
    [
        ({"schema_version": True}, "report contract"),
        ({"schema_version": 2}, "report contract"),
        ({"fixture_id": "wrong"}, "fixture identity"),
        ({"fixture_sha256": "0" * 64}, "fixture identity"),
        ({"expectations_sha256": "0" * 64}, "expectation identity"),
        ({"authoring_version_id": WEAKENED.version_id}, "rule-version identity"),
        ({"requested_version_id": WEAKENED.version_id}, "rule-version identity"),
        ({"executed_version_id": WEAKENED.version_id}, "rule-version identity"),
        ({"executed_version_id": None}, "execution status"),
        ({"unlabeled_events": 1}, "event counts"),
        ({"unlabeled_events": False}, "event counts"),
        ({"totals": GradeTotals(0, 2, 1, 0, 0, 0)}, "totals"),
        ({"totals": GradeTotals(True, 2, 0, 0, 0, 0)}, "totals"),
        ({"grades": ()}, "one grade per expectation"),
    ],
)
def test_inconsistent_reports_fail_closed(context, change, message):
    report = grade_replay(BUNDLE, LABELS, CORRECTED, CORRECTED)
    with pytest.raises(SummaryError, match=message):
        summarize_replay_grade(replace(report, **change), *context, CORRECTED)


@pytest.mark.parametrize(
    "mutation",
    [
        "duplicate",
        "unknown",
        "event",
        "expected",
        "reorder",
        "classification",
        "diagnostic",
    ],
)
def test_invalid_reference_or_classification_is_rejected(context, mutation):
    report = grade_replay(BUNDLE, LABELS, CORRECTED, CORRECTED)
    a, b, c = report.grades
    alternatives = {
        "duplicate": (a, a, c),
        "unknown": (replace(a, expectation_id="unknown"), b, c),
        "event": (replace(a, event_id="unknown"), b, c),
        "expected": (replace(a, expected_outcome="match"), b, c),
        "reorder": (b, a, c),
        "classification": (replace(a, classification="true_positive"), b, c),
        "diagnostic": (replace(a, diagnostic="TEST_ONLY_SECRET_VALUE"), b, c),
    }
    with pytest.raises(SummaryError) as exc:
        summarize_replay_grade(
            replace(report, grades=alternatives[mutation]), *context, CORRECTED
        )
    assert "TEST_ONLY_SECRET_VALUE" not in str(exc.value)


def test_canonical_bytes_and_hash_bind_meaningful_changes(context):
    report = grade_replay(BUNDLE, LABELS, CORRECTED, CORRECTED)
    summary = summarize_replay_grade(report, *context, CORRECTED)
    first = summary.canonical_json()
    assert first == summarize_replay_grade(report, *context, CORRECTED).canonical_json()
    assert b"pwsh.exe" not in first and b" -enc " not in first
    payload = json.loads(first)
    digest = payload.pop("summary_sha256")
    assert payload["schema_version"] == 1
    assert (
        digest
        == hashlib.sha256(
            json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
        ).hexdigest()
    )
    weakened = grade_replay(BUNDLE, LABELS, CORRECTED, WEAKENED)
    other = json.loads(
        summarize_replay_grade(weakened, *context, WEAKENED).canonical_json()
    )
    assert other["summary_sha256"] != digest
    assert other["grade_sha256"] != summary.grade_sha256
