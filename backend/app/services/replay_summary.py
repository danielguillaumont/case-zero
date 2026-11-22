"""Validate offline grading evidence and project it into a presentation summary."""

import hashlib
import json
import re
from collections import Counter
from dataclasses import asdict, dataclass, fields, replace

from app.services.replay_grading import (
    GRADING_SCHEMA_VERSION,
    ExpectationGrade,
    GradeTotals,
    ReplayGrade,
    _CLASSIFICATIONS,
)
from app.services.replay_expectations import ReplayExpectations
from app.services.replay_fixtures import (
    MAX_EVENTS,
    ReplayFixture,
    _fixture_content_hash,
)
from app.services.rule_versions import RuleDefinition, RuleVersion

SUMMARY_SCHEMA_VERSION = 1
_TOTAL_FIELDS = tuple(item.name for item in fields(GradeTotals))
_SAFE_ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9._:-]{0,127}")
_ERROR_DIAGNOSTICS = {
    "Evaluator reported missing_field for event_type.",
    "Evaluator reported invalid_field for event_type.",
    "Evaluator reported invalid_field for process_name.",
    "Evaluator reported invalid_field for command_line.",
}
_UNSUPPORTED_DIAGNOSTIC = "Selected rule version is incompatible with offline replay."


class SummaryError(ValueError):
    """The report does not reconcile with the source grading inputs."""


@dataclass(frozen=True, slots=True)
class SummaryDiagnostic:
    code: str
    message: str


@dataclass(frozen=True, slots=True)
class ExpectationReference:
    expectation_id: str
    event_id: str
    expected_outcome: str
    actual_outcome: str | None
    classification: str


@dataclass(frozen=True, slots=True)
class LabeledSatisfaction:
    numerator: int
    denominator: int


@dataclass(frozen=True, slots=True)
class ReplaySummary:
    fixture_id: str
    fixture_sha256: str
    expectations_sha256: str
    grade_sha256: str
    authoring_version_id: tuple[str, str]
    requested_version_id: tuple[str, str]
    executed_version_id: tuple[str, str] | None
    total_events: int
    labeled_events: int
    unlabeled_events: int
    decisive_labeled_events: int
    totals: GradeTotals
    passed: bool
    labeled_satisfaction: LabeledSatisfaction | None
    diagnostics: tuple[SummaryDiagnostic, ...]
    expectations: tuple[ExpectationReference, ...]
    schema_version: int = SUMMARY_SCHEMA_VERSION

    def canonical_json(self) -> bytes:
        payload = asdict(self)
        canonical = _canonical_json(payload)
        return _canonical_json(
            {**payload, "summary_sha256": hashlib.sha256(canonical).hexdigest()}
        )


def _canonical_json(payload: dict) -> bytes:
    return json.dumps(
        payload, sort_keys=True, ensure_ascii=True, separators=(",", ":")
    ).encode("utf-8")


def _version_matches(value: object, expected: tuple[str, str]) -> bool:
    return (
        type(value) is tuple
        and len(value) == 2
        and all(type(part) is str for part in value)
        and value == expected
    )


def _validate_inputs(
    report: ReplayGrade,
    fixture: ReplayFixture,
    expectations: ReplayExpectations,
    requested: RuleVersion,
) -> None:
    if (
        type(report) is not ReplayGrade
        or type(report.schema_version) is not int
        or report.schema_version != GRADING_SCHEMA_VERSION
    ):
        raise SummaryError("Unsupported grading report contract.")
    if (
        type(fixture) is not ReplayFixture
        or type(fixture.schema_version) is not int
        or fixture.schema_version != 1
        or type(fixture.events) is not tuple
        or not 1 <= len(fixture.events) <= MAX_EVENTS
    ):
        raise SummaryError("Expected a bounded replay fixture v1.")
    if (
        type(expectations) is not ReplayExpectations
        or type(expectations.expectations) is not tuple
        or not 1 <= len(expectations.expectations) <= len(fixture.events)
    ):
        raise SummaryError("Expected authored replay expectations.")
    if (
        type(requested) is not RuleVersion
        or type(requested.definition) is not RuleDefinition
    ):
        raise SummaryError("Expected a requested rule version.")
    if type(fixture.fixture_id) is not str or not _SAFE_ID.fullmatch(
        fixture.fixture_id
    ):
        raise SummaryError("Fixture ID must be a bounded investigation identifier.")

    try:
        fixture_hash = _fixture_content_hash(
            fixture.schema_version,
            fixture.fixture_id,
            fixture.provenance,
            fixture.events,
        )
        checked_expectations = replace(
            expectations,
            expectations=tuple(replace(item) for item in expectations.expectations),
        )
        checked_expectations.validate_target(fixture, requested.definition.rule_id)
        requested_id = RuleVersion(requested.definition).version_id
    except (AttributeError, TypeError, ValueError, RecursionError):
        raise SummaryError("Invalid fixture, expectation or rule context.") from None
    if (
        type(fixture.content_hash) is not str
        or fixture.content_hash != fixture_hash
        or type(report.fixture_id) is not str
        or report.fixture_id != fixture.fixture_id
        or type(report.fixture_sha256) is not str
        or report.fixture_sha256 != fixture_hash
    ):
        raise SummaryError("Grading report fixture identity does not match.")
    if (
        type(report.expectations_sha256) is not str
        or report.expectations_sha256 != checked_expectations.content_sha256
    ):
        raise SummaryError("Grading report expectation identity does not match.")
    if (
        not _version_matches(requested.version_id, requested_id)
        or not _version_matches(report.requested_version_id, requested_id)
        or not _version_matches(
            report.authoring_version_id, expectations.authoring_version_id
        )
        or (
            report.executed_version_id is not None
            and not _version_matches(report.executed_version_id, requested_id)
        )
    ):
        raise SummaryError("Grading report rule-version identity does not match.")


def _validate_grade(grade: ExpectationGrade, *, executed: bool) -> None:
    if (
        type(grade.classification) is not str
        or type(grade.diagnostic) is not str
        or (grade.actual_outcome is not None and type(grade.actual_outcome) is not str)
    ):
        raise SummaryError("Malformed expectation classification.")
    if not executed:
        consistent = (
            grade.actual_outcome is None
            and grade.classification == "unsupported"
            and grade.diagnostic == _UNSUPPORTED_DIAGNOSTIC
        )
    elif grade.actual_outcome == "error":
        consistent = (
            grade.classification == "evaluation_error"
            and grade.diagnostic in _ERROR_DIAGNOSTICS
        )
    else:
        consistent = _CLASSIFICATIONS.get(
            (grade.expected_outcome, grade.actual_outcome)
        ) == (grade.classification, grade.diagnostic)
    if not consistent:
        raise SummaryError(
            "Expectation classification contradicts its outcome or execution status."
        )


def summarize_replay_grade(
    report: ReplayGrade,
    fixture: ReplayFixture,
    expectations: ReplayExpectations,
    requested: RuleVersion,
) -> ReplaySummary:
    """Summarize an actual ReplayGrade with its independently loaded input context."""
    _validate_inputs(report, fixture, expectations, requested)
    labels = sorted(expectations.expectations, key=lambda item: item.expectation_id)
    if type(report.grades) is not tuple or len(report.grades) != len(labels):
        raise SummaryError(
            "Grading report must have exactly one grade per expectation."
        )
    if type(report.unlabeled_events) is not int or report.unlabeled_events != len(
        fixture.events
    ) - len(labels):
        raise SummaryError("Grading report event counts do not reconcile.")

    references = []
    for grade, label in zip(report.grades, labels, strict=True):
        if (
            type(grade) is not ExpectationGrade
            or any(
                type(value) is not str
                for value in (
                    grade.expectation_id,
                    grade.event_id,
                    grade.expected_outcome,
                )
            )
            or (grade.expectation_id, grade.event_id, grade.expected_outcome)
            != (label.expectation_id, label.event_id, label.expected_outcome)
            or not _SAFE_ID.fullmatch(grade.event_id)
        ):
            raise SummaryError(
                "Grading report expectation references do not match the authored order and identities."
            )
        _validate_grade(grade, executed=report.executed_version_id is not None)
        references.append(
            ExpectationReference(
                grade.expectation_id,
                grade.event_id,
                grade.expected_outcome,
                grade.actual_outcome,
                grade.classification,
            )
        )
    counts = Counter(item.classification for item in references)
    if type(report.totals) is not GradeTotals or any(
        type(getattr(report.totals, name)) is not int
        or getattr(report.totals, name) != counts[name]
        for name in _TOTAL_FIELDS
    ):
        raise SummaryError(
            "Grading report totals do not reconcile with expectation classifications."
        )

    satisfied = counts["true_positive"] + counts["true_negative"]
    decisive = satisfied + counts["false_positive"] + counts["false_negative"]
    diagnostics = tuple(
        SummaryDiagnostic(code, message)
        for include, code, message in (
            (
                report.passed,
                "all_expectations_passed",
                "All labeled expectations passed.",
            ),
            (
                counts["false_negative"],
                "expected_detection_missed",
                "One or more expected detections did not match.",
            ),
            (
                counts["false_positive"],
                "unexpected_detection",
                "One or more events matched unexpectedly.",
            ),
            (
                counts["evaluation_error"],
                "evaluation_failed",
                "Evaluation failed for one or more labeled events.",
            ),
            (
                counts["unsupported"],
                "unsupported_execution",
                "The requested rule or evaluator could not execute.",
            ),
            (
                decisive < len(labels),
                "incomplete_evidence",
                "One or more labels lack a decisive result.",
            ),
            (
                report.unlabeled_events,
                "unlabeled_events",
                "Unlabeled events are outside the graded denominator.",
            ),
        )
        if include
    )
    return ReplaySummary(
        report.fixture_id,
        report.fixture_sha256,
        report.expectations_sha256,
        hashlib.sha256(report.canonical_json()).hexdigest(),
        report.authoring_version_id,
        report.requested_version_id,
        report.executed_version_id,
        len(fixture.events),
        len(labels),
        report.unlabeled_events,
        decisive,
        report.totals,
        report.passed,
        LabeledSatisfaction(satisfied, len(labels)) if decisive else None,
        diagnostics,
        tuple(references),
    )
