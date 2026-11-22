import hashlib
import json
from dataclasses import FrozenInstanceError, replace
from pathlib import Path

import pytest

from app.services import replay_grading
from app.services.replay_comparison import (
    ChangeTotals,
    ComparisonError,
    compare_replay_summaries,
)
from app.services.replay_evaluator import EvaluationError, evaluate_fixture_version
from app.services.replay_expectations import load_replay_expectations
from app.services.replay_fixtures import load_replay_fixture
from app.services.replay_grading import GradeTotals, grade_replay
from app.services.replay_regression_proof import CORRECTED, WEAKENED
from app.services.replay_summary import (
    LabeledSatisfaction,
    SummaryDiagnostic,
    summarize_replay_grade,
)
from app.services.rule_versions import RuleDefinition, RuleVersion

BUNDLE = (
    Path(__file__).resolve().parents[1] / "app/replay_assets/encoded_powershell.json"
)
LABELS = BUNDLE.with_suffix(".expectations.json")


def summary(version, label_path=LABELS):
    fixture = load_replay_fixture(BUNDLE)
    labels = load_replay_expectations(label_path, fixture, CORRECTED)
    report = grade_replay(BUNDLE, label_path, CORRECTED, version)
    return summarize_replay_grade(report, fixture, labels, version)


@pytest.fixture
def pair():
    return summary(WEAKENED), summary(CORRECTED)


def test_real_weakened_to_corrected_comparison_and_reverse(pair):
    baseline, candidate = pair
    result = compare_replay_summaries(*pair)
    assert result.change_totals == ChangeTotals(1, 0, 2, 0)
    assert result.candidate_minus_baseline == GradeTotals(1, 0, -1, 0, 0, 0)
    assert (result.total_events, result.labeled_events, result.unlabeled_events) == (
        3,
        3,
        0,
    )
    assert result.fixture_sha256 == baseline.fixture_sha256
    assert result.expectations_sha256 == candidate.expectations_sha256
    assert result.baseline.labeled_satisfaction == LabeledSatisfaction(2, 3)
    assert result.candidate.labeled_satisfaction == LabeledSatisfaction(3, 3)
    assert not result.baseline.passed and result.candidate.passed
    assert (
        result.baseline.requested_version_id
        == result.baseline.executed_version_id
        == WEAKENED.version_id
    )
    assert (
        result.candidate.requested_version_id
        == result.candidate.executed_version_id
        == CORRECTED.version_id
    )
    assert [(item.expectation_id, item.change) for item in result.expectations] == [
        ("benign-get-date", "unchanged"),
        ("benign-get-service", "unchanged"),
        ("encoded-switch", "improved"),
    ]
    reverse = compare_replay_summaries(candidate, baseline)
    assert reverse.change_totals == ChangeTotals(0, 1, 2, 0)
    assert reverse.candidate_minus_baseline == GradeTotals(-1, 0, 1, 0, 0, 0)
    assert reverse.expectations[-1].change == "regressed"
    assert result.canonical_json() != reverse.canonical_json()
    with pytest.raises(FrozenInstanceError):
        result.labeled_events = 0


@pytest.mark.parametrize(
    ("change", "message"),
    [
        ({"fixture_id": "other"}, "different fixtures"),
        ({"fixture_sha256": "0" * 64}, "different fixtures"),
        ({"expectations_sha256": "0" * 64}, "different authored expectation sets"),
        (
            {"authoring_version_id": WEAKENED.version_id},
            "different authored expectation sets",
        ),
        ({"schema_version": 2}, "summary contract"),
        ({"schema_version": True}, "summary contract"),
        (
            {"requested_version_id": ("different-rule", "0" * 64)},
            "rule-version identity",
        ),
        (
            {"requested_version_id": ("encoded-powershell", "bad-hash")},
            "rule-version identity",
        ),
        ({"executed_version_id": WEAKENED.version_id}, "rule-version identity"),
        ({"executed_version_id": None}, "execution identity"),
        ({"grade_sha256": "bad-hash"}, "content identity"),
        ({"labeled_events": 2, "unlabeled_events": 1}, "counts or references"),
        ({"totals": GradeTotals(0, 2, 1, 0, 0, 0)}, "classification totals"),
        ({"passed": False}, "satisfaction or completeness"),
        (
            {"labeled_satisfaction": LabeledSatisfaction(3, 2)},
            "satisfaction or completeness",
        ),
    ],
)
def test_bad_or_incompatible_inputs_are_rejected(pair, change, message):
    baseline, candidate = pair
    with pytest.raises(ComparisonError, match=message):
        compare_replay_summaries(baseline, replace(candidate, **change))


def test_same_version_cannot_be_compared(pair):
    with pytest.raises(ComparisonError, match="different requested rule versions"):
        compare_replay_summaries(pair[0], pair[0])


@pytest.mark.parametrize(
    "mutation",
    [
        "duplicate",
        "duplicate-event",
        "reordered",
        "missing",
        "unknown",
        "altered-event",
        "altered-expectation",
        "outcome",
    ],
)
def test_tampered_references_fail_closed(pair, mutation):
    baseline, candidate = pair
    first, second, third = candidate.expectations
    alternatives = {
        "duplicate": (first, first, third),
        "duplicate-event": (first, replace(second, event_id=first.event_id), third),
        "reordered": (second, first, third),
        "missing": (first, second),
        "unknown": (replace(first, expectation_id="benign-get-fake"), second, third),
        "altered-event": (replace(first, event_id="other"), second, third),
        "altered-expectation": (
            first,
            second,
            replace(
                third, expected_outcome="no_match", classification="false_positive"
            ),
        ),
        "outcome": (first, second, replace(third, actual_outcome=None)),
    }
    if mutation == "altered-expectation":
        candidate = replace(
            candidate,
            totals=GradeTotals(0, 2, 0, 1, 0, 0),
            passed=False,
            labeled_satisfaction=LabeledSatisfaction(2, 3),
        )
    with pytest.raises(ComparisonError):
        compare_replay_summaries(
            baseline, replace(candidate, expectations=alternatives[mutation])
        )


def test_real_unsupported_grade_is_inconclusive_in_both_directions(pair):
    definition = RuleDefinition()
    object.__setattr__(definition, "predicate_id", "unsupported/v2")
    unsupported = summary(RuleVersion(definition))
    result = compare_replay_summaries(unsupported, pair[1])
    assert result.baseline.executed_version_id is None
    assert result.change_totals == ChangeTotals(0, 0, 0, 3)
    assert result.candidate_minus_baseline.unsupported == -3
    assert result.labeled_events == 3
    assert (
        compare_replay_summaries(pair[1], unsupported).change_totals
        == result.change_totals
    )


def test_synthetic_evaluation_error_is_inconclusive(pair, monkeypatch):
    fixture = load_replay_fixture(BUNDLE)
    evaluation = evaluate_fixture_version(fixture, CORRECTED)
    encoded, date, service = evaluation.decisions
    evaluation = replace(
        evaluation,
        decisions=(
            replace(
                encoded,
                outcome="error",
                error=EvaluationError("invalid_field", "command_line"),
            ),
            date,
            service,
        ),
    )
    monkeypatch.setattr(
        replay_grading, "evaluate_fixture_version", lambda *_: evaluation
    )
    result = compare_replay_summaries(pair[0], summary(CORRECTED))
    assert result.change_totals == ChangeTotals(0, 0, 2, 1)
    assert result.candidate_minus_baseline.evaluation_error == 1
    assert result.candidate.labeled_satisfaction == LabeledSatisfaction(2, 3)
    assert result.expectations[-1].candidate_classification == "evaluation_error"


def test_partial_labels_remain_the_complete_denominator(tmp_path):
    asset = json.loads(LABELS.read_bytes())
    asset["expectations"] = asset["expectations"][:1]
    labels = tmp_path / "partial.json"
    labels.write_text(json.dumps(asset), encoding="utf-8")
    result = compare_replay_summaries(
        summary(WEAKENED, labels), summary(CORRECTED, labels)
    )
    assert (result.total_events, result.labeled_events, result.unlabeled_events) == (
        3,
        1,
        2,
    )
    assert result.candidate.labeled_satisfaction == LabeledSatisfaction(1, 1)
    assert result.change_totals == ChangeTotals(1, 0, 0, 0)


def test_canonical_bytes_are_repeatable_and_omit_caller_diagnostics(pair):
    before, after = pair
    result = compare_replay_summaries(*pair)
    first = result.canonical_json()
    changed_diagnostics = replace(
        after, diagnostics=(SummaryDiagnostic("test", "TEST_ONLY_PRIVATE_VALUE"),)
    )
    assert (
        first == compare_replay_summaries(before, changed_diagnostics).canonical_json()
    )
    assert first == compare_replay_summaries(*pair).canonical_json()
    assert b"TEST_ONLY_PRIVATE_VALUE" not in first and b"pwsh.exe" not in first
    payload = json.loads(first)
    digest = payload.pop("comparison_sha256")
    assert payload["schema_version"] == 1
    assert (
        digest
        == hashlib.sha256(
            json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
        ).hexdigest()
    )
    changed_grade = replace(after, grade_sha256="0" * 64)
    assert first != compare_replay_summaries(before, changed_grade).canonical_json()
