"""Compare two bound offline summaries without replaying or regrading events."""

import hashlib
import json
import re
from collections import Counter
from dataclasses import asdict, dataclass, fields
from typing import Literal

from app.services.replay_evaluator import ENCODED_POWERSHELL_RULE_ID
from app.services.replay_fixtures import MAX_EVENTS
from app.services.replay_grading import GradeTotals, _CLASSIFICATIONS
from app.services.replay_summary import (
    ExpectationReference,
    LabeledSatisfaction,
    ReplaySummary,
)

COMPARISON_SCHEMA_VERSION = 1
_SUPPORTED_SUMMARY_VERSION = 1
_TOTAL_FIELDS = tuple(item.name for item in fields(GradeTotals))
_SHA256 = re.compile(r"[0-9a-f]{64}")
_ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9._:-]{0,127}")
_EXPECTATION_ID = re.compile(r"[a-z0-9][a-z0-9-]{0,79}")
_SATISFIED = frozenset({"true_positive", "true_negative"})
_INCOMPLETE = frozenset({"evaluation_error", "unsupported"})
Change = Literal["improved", "regressed", "unchanged", "inconclusive"]


class ComparisonError(ValueError):
    """The supplied summaries are malformed or cannot be compared."""


@dataclass(frozen=True, slots=True)
class ComparedRun:
    grade_sha256: str
    requested_version_id: tuple[str, str]
    executed_version_id: tuple[str, str] | None
    totals: GradeTotals
    passed: bool
    labeled_satisfaction: LabeledSatisfaction | None


@dataclass(frozen=True, slots=True)
class ExpectationChange:
    expectation_id: str
    event_id: str
    expected_outcome: str
    baseline_classification: str
    candidate_classification: str
    change: Change


@dataclass(frozen=True, slots=True)
class ChangeTotals:
    improved: int
    regressed: int
    unchanged: int
    inconclusive: int


@dataclass(frozen=True, slots=True)
class ReplayComparison:
    fixture_id: str
    fixture_sha256: str
    expectations_sha256: str
    authoring_version_id: tuple[str, str]
    total_events: int
    labeled_events: int
    unlabeled_events: int
    baseline: ComparedRun
    candidate: ComparedRun
    candidate_minus_baseline: GradeTotals
    change_totals: ChangeTotals
    expectations: tuple[ExpectationChange, ...]
    schema_version: int = COMPARISON_SCHEMA_VERSION

    def canonical_json(self) -> bytes:
        payload = asdict(self)
        digest = hashlib.sha256(_json_bytes(payload)).hexdigest()
        return _json_bytes({**payload, "comparison_sha256": digest})


def _json_bytes(payload: dict) -> bytes:
    return json.dumps(
        payload, sort_keys=True, ensure_ascii=True, separators=(",", ":")
    ).encode("utf-8")


def _is_digest(value: object) -> bool:
    return type(value) is str and _SHA256.fullmatch(value) is not None


def _is_version(value: object) -> bool:
    return (
        type(value) is tuple
        and len(value) == 2
        and type(value[0]) is str
        and value[0] == ENCODED_POWERSHELL_RULE_ID
        and _is_digest(value[1])
    )


def _reference_key(reference: ExpectationReference) -> tuple[str, str, str]:
    return reference.expectation_id, reference.event_id, reference.expected_outcome


def _validate_reference(reference: ExpectationReference, executed: bool) -> None:
    if (
        type(reference) is not ExpectationReference
        or type(reference.expectation_id) is not str
        or not _EXPECTATION_ID.fullmatch(reference.expectation_id)
        or type(reference.event_id) is not str
        or not _ID.fullmatch(reference.event_id)
        or type(reference.expected_outcome) is not str
        or reference.expected_outcome not in ("match", "no_match")
        or type(reference.classification) is not str
        or (
            reference.actual_outcome is not None
            and type(reference.actual_outcome) is not str
        )
    ):
        raise ComparisonError("Malformed expectation reference.")
    if not executed:
        valid = (
            reference.classification == "unsupported"
            and reference.actual_outcome is None
        )
    elif reference.actual_outcome == "error":
        valid = reference.classification == "evaluation_error"
    else:
        result = _CLASSIFICATIONS.get(
            (reference.expected_outcome, reference.actual_outcome)
        )
        valid = result is not None and result[0] == reference.classification
    if not valid:
        raise ComparisonError(
            "Expectation classification contradicts its outcome or execution identity."
        )


def _validate_summary(summary: ReplaySummary) -> None:
    if (
        type(summary) is not ReplaySummary
        or type(summary.schema_version) is not int
        or summary.schema_version != _SUPPORTED_SUMMARY_VERSION
    ):
        raise ComparisonError("Unsupported replay summary contract.")
    if (
        type(summary.fixture_id) is not str
        or not _ID.fullmatch(summary.fixture_id)
        or not all(
            _is_digest(value)
            for value in (
                summary.fixture_sha256,
                summary.expectations_sha256,
                summary.grade_sha256,
            )
        )
    ):
        raise ComparisonError("Malformed summary content identity.")
    if (
        not _is_version(summary.authoring_version_id)
        or not _is_version(summary.requested_version_id)
        or (
            summary.executed_version_id is not None
            and (
                not _is_version(summary.executed_version_id)
                or summary.executed_version_id != summary.requested_version_id
            )
        )
    ):
        raise ComparisonError("Malformed or inconsistent rule-version identity.")
    if (
        any(
            type(value) is not int
            for value in (
                summary.total_events,
                summary.labeled_events,
                summary.unlabeled_events,
                summary.decisive_labeled_events,
            )
        )
        or not 1 <= summary.labeled_events <= summary.total_events <= MAX_EVENTS
        or summary.total_events != summary.labeled_events + summary.unlabeled_events
        or type(summary.expectations) is not tuple
        or len(summary.expectations) != summary.labeled_events
    ):
        raise ComparisonError("Summary event counts or references do not reconcile.")
    previous = ""
    event_ids = set()
    for reference in summary.expectations:
        _validate_reference(reference, summary.executed_version_id is not None)
        if reference.expectation_id <= previous or reference.event_id in event_ids:
            raise ComparisonError("Duplicate or unordered expectation references.")
        previous = reference.expectation_id
        event_ids.add(reference.event_id)
    counts = Counter(reference.classification for reference in summary.expectations)
    if type(summary.totals) is not GradeTotals or any(
        type(getattr(summary.totals, name)) is not int
        or getattr(summary.totals, name) != counts[name]
        for name in _TOTAL_FIELDS
    ):
        raise ComparisonError("Summary classification totals do not reconcile.")
    satisfied = sum(counts[name] for name in _SATISFIED)
    decisive = summary.labeled_events - sum(counts[name] for name in _INCOMPLETE)
    satisfaction = summary.labeled_satisfaction
    if (
        summary.decisive_labeled_events != decisive
        or type(summary.passed) is not bool
        or summary.passed != (satisfied == summary.labeled_events)
        or (decisive == 0 and satisfaction is not None)
        or (
            decisive > 0
            and (
                type(satisfaction) is not LabeledSatisfaction
                or type(satisfaction.numerator) is not int
                or type(satisfaction.denominator) is not int
                or satisfaction
                != LabeledSatisfaction(satisfied, summary.labeled_events)
            )
        )
    ):
        raise ComparisonError(
            "Summary satisfaction or completeness does not reconcile."
        )


def _change(baseline: str, candidate: str) -> Change:
    if baseline in _INCOMPLETE or candidate in _INCOMPLETE:
        return "inconclusive"
    was_satisfied, is_satisfied = baseline in _SATISFIED, candidate in _SATISFIED
    if was_satisfied == is_satisfied:
        return "unchanged"
    return "improved" if is_satisfied else "regressed"


def _run(summary: ReplaySummary) -> ComparedRun:
    return ComparedRun(
        summary.grade_sha256,
        summary.requested_version_id,
        summary.executed_version_id,
        summary.totals,
        summary.passed,
        summary.labeled_satisfaction,
    )


def compare_replay_summaries(
    baseline: ReplaySummary, candidate: ReplaySummary
) -> ReplayComparison:
    """Compare every authored label in canonical order with candidate-minus-baseline deltas."""
    _validate_summary(baseline)
    _validate_summary(candidate)
    if (baseline.fixture_id, baseline.fixture_sha256, baseline.total_events) != (
        candidate.fixture_id,
        candidate.fixture_sha256,
        candidate.total_events,
    ):
        raise ComparisonError("Summaries target different fixtures.")
    if (baseline.expectations_sha256, baseline.authoring_version_id) != (
        candidate.expectations_sha256,
        candidate.authoring_version_id,
    ):
        raise ComparisonError("Summaries target different authored expectation sets.")
    if baseline.requested_version_id == candidate.requested_version_id:
        raise ComparisonError("Comparison requires different requested rule versions.")
    if tuple(map(_reference_key, baseline.expectations)) != tuple(
        map(_reference_key, candidate.expectations)
    ):
        raise ComparisonError(
            "Summaries disagree on the authored expectation references."
        )

    changes = tuple(
        ExpectationChange(
            before.expectation_id,
            before.event_id,
            before.expected_outcome,
            before.classification,
            after.classification,
            _change(before.classification, after.classification),
        )
        for before, after in zip(
            baseline.expectations, candidate.expectations, strict=True
        )
    )
    counts = Counter(item.change for item in changes)
    return ReplayComparison(
        baseline.fixture_id,
        baseline.fixture_sha256,
        baseline.expectations_sha256,
        baseline.authoring_version_id,
        baseline.total_events,
        baseline.labeled_events,
        baseline.unlabeled_events,
        _run(baseline),
        _run(candidate),
        GradeTotals(
            **{
                name: getattr(candidate.totals, name) - getattr(baseline.totals, name)
                for name in _TOTAL_FIELDS
            }
        ),
        ChangeTotals(
            counts["improved"],
            counts["regressed"],
            counts["unchanged"],
            counts["inconclusive"],
        ),
        changes,
    )
