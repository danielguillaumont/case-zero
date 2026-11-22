"""Grade authored labels using fresh, version-bound offline replay.

Every replay decision is validated. Only labeled events contribute to totals.
An unsupported run records the requested version and leaves execution identity
unset. The grading report has its own contract, independent of replay evidence.
"""

import json
from collections import Counter
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Literal

from app.services.replay_evaluator import (
    EvaluationError,
    EvaluationResult,
    UnsupportedRuleError,
    VersionedEvaluation,
    evaluate_fixture_version,
    evaluate_regression_fixture_version,
)
from app.services.replay_expectations import load_replay_expectations
from app.services.replay_fixtures import (
    FixtureError,
    ReplayFixture,
    load_replay_fixture,
)
from app.services.rule_versions import (
    WEAKENED_PREDICATE_ID,
    RuleDefinition,
    RuleVersion,
)

GRADING_SCHEMA_VERSION = 1
Classification = Literal[
    "true_positive",
    "true_negative",
    "false_negative",
    "false_positive",
    "evaluation_error",
    "unsupported",
]
_CLASSIFICATIONS = {
    ("match", "match"): ("true_positive", "Expected detection matched."),
    ("no_match", "no_match"): ("true_negative", "Expected non-match was observed."),
    ("match", "no_match"): ("false_negative", "Expected detection did not match."),
    ("no_match", "match"): ("false_positive", "Unexpected detection matched."),
}


class GradingError(ValueError):
    """The grading request or execution output failed validation."""


@dataclass(frozen=True, slots=True)
class ExpectationGrade:
    expectation_id: str
    event_id: str
    expected_outcome: str
    actual_outcome: str | None
    classification: Classification
    diagnostic: str


@dataclass(frozen=True, slots=True)
class GradeTotals:
    true_positive: int
    true_negative: int
    false_negative: int
    false_positive: int
    evaluation_error: int
    unsupported: int


@dataclass(frozen=True, slots=True)
class ReplayGrade:
    schema_version: int
    fixture_id: str
    fixture_sha256: str
    expectations_sha256: str
    authoring_version_id: tuple[str, str]
    requested_version_id: tuple[str, str]
    executed_version_id: tuple[str, str] | None
    unlabeled_events: int
    totals: GradeTotals
    grades: tuple[ExpectationGrade, ...]

    @property
    def passed(self) -> bool:
        """Whether all authored expectations passed."""
        totals = self.totals
        return not (
            totals.false_negative
            or totals.false_positive
            or totals.evaluation_error
            or totals.unsupported
        )

    def canonical_json(self) -> bytes:
        return json.dumps(
            {**asdict(self), "passed": self.passed},
            sort_keys=True,
            ensure_ascii=True,
            separators=(",", ":"),
        ).encode("utf-8")


def _index_decisions(
    fixture: ReplayFixture,
    evaluation: VersionedEvaluation,
    requested_version_id: tuple[str, str],
) -> dict[str, EvaluationResult]:
    if (
        type(evaluation) is not VersionedEvaluation
        or type(evaluation.decisions) is not tuple
    ):
        raise GradingError("Malformed versioned evaluation.")
    if (
        type(evaluation.version_id) is not tuple
        or len(evaluation.version_id) != 2
        or any(type(part) is not str for part in evaluation.version_id)
        or evaluation.version_id != requested_version_id
    ):
        raise GradingError(
            "Executed rule version does not match the selected identity."
        )
    ordinals = {event.event_id: event.ordinal for event in fixture.events}
    decisions: dict[str, EvaluationResult] = {}
    for decision in evaluation.decisions:
        if (
            type(decision) is not EvaluationResult
            or type(decision.source_event_id) is not str
        ):
            raise GradingError("Malformed evaluation decision.")
        event_id = decision.source_event_id
        if event_id not in ordinals:
            raise GradingError("Evaluation contains an unknown event ID.")
        if event_id in decisions:
            raise GradingError("Evaluation contains a duplicate event ID.")
        if type(decision.ordinal) is not int or decision.ordinal != ordinals[event_id]:
            raise GradingError("Evaluation event ID and ordinal do not agree.")
        if (
            type(decision.rule_id) is not str
            or decision.rule_id != requested_version_id[0]
        ):
            raise GradingError("Evaluation decision targets a different logical rule.")
        if type(decision.outcome) is not str or decision.outcome not in (
            "match",
            "no_match",
            "error",
        ):
            raise GradingError("Malformed evaluation outcome.")
        error = decision.error
        if decision.outcome == "error":
            if (
                type(error) is not EvaluationError
                or type(error.code) is not str
                or type(error.field) is not str
                or (error.code, error.field)
                not in (
                    ("missing_field", "event_type"),
                    ("invalid_field", "event_type"),
                    ("invalid_field", "process_name"),
                    ("invalid_field", "command_line"),
                )
            ):
                raise GradingError("Malformed evaluation error.")
        elif error is not None:
            raise GradingError("Unexpected error on a successful evaluation decision.")
        decisions[event_id] = decision
    if decisions.keys() != ordinals.keys():
        raise GradingError("Evaluation is missing one or more event decisions.")
    return decisions


def grade_replay(
    fixture_path: Path,
    expectations_path: Path,
    authoring_version: RuleVersion,
    selected_version: RuleVersion,
    *,
    schema_version: int = GRADING_SCHEMA_VERSION,
) -> ReplayGrade:
    """Load exact local inputs and grade the selected version against authored labels."""
    if type(schema_version) is not int or schema_version != GRADING_SCHEMA_VERSION:
        raise GradingError("Unsupported grading schema version.")
    if (
        type(selected_version) is not RuleVersion
        or type(selected_version.definition) is not RuleDefinition
    ):
        raise GradingError("Expected an immutable selected rule version.")
    requested_version_id = selected_version.version_id
    if (
        any(type(part) is not str for part in requested_version_id)
        or RuleVersion(selected_version.definition).version_id != requested_version_id
    ):
        raise GradingError(
            "Selected rule-version identity does not match its definition."
        )

    fixture = load_replay_fixture(fixture_path)
    expectations = load_replay_expectations(
        expectations_path, fixture, authoring_version
    )
    expectations.validate_target(fixture, requested_version_id[0])
    try:
        if selected_version.definition.predicate_id == WEAKENED_PREDICATE_ID:
            evaluation = evaluate_regression_fixture_version(fixture, selected_version)
        else:
            evaluation = evaluate_fixture_version(fixture, selected_version)
    except (UnsupportedRuleError, FixtureError):
        executed_version_id = None
        decisions = {}
    else:
        decisions = _index_decisions(fixture, evaluation, requested_version_id)
        executed_version_id = evaluation.version_id

    grades: list[ExpectationGrade] = []
    for label in sorted(
        expectations.expectations, key=lambda item: item.expectation_id
    ):
        expected = label.expected_outcome
        if executed_version_id is None:
            actual = None
            classification = "unsupported"
            diagnostic = "Selected rule version is incompatible with offline replay."
        else:
            decision = decisions[label.event_id]
            actual = decision.outcome
            if decision.error is not None:
                classification = "evaluation_error"
                diagnostic = f"Evaluator reported {decision.error.code} for {decision.error.field}."
            else:
                classification, diagnostic = _CLASSIFICATIONS[expected, actual]
        grades.append(
            ExpectationGrade(
                label.expectation_id,
                label.event_id,
                expected,
                actual,
                classification,
                diagnostic,
            )
        )

    counts = Counter(grade.classification for grade in grades)
    return ReplayGrade(
        schema_version=schema_version,
        fixture_id=fixture.fixture_id,
        fixture_sha256=fixture.content_hash,
        expectations_sha256=expectations.content_sha256,
        authoring_version_id=expectations.authoring_version_id,
        requested_version_id=requested_version_id,
        executed_version_id=executed_version_id,
        unlabeled_events=len(fixture.events) - len(grades),
        totals=GradeTotals(
            counts["true_positive"],
            counts["true_negative"],
            counts["false_negative"],
            counts["false_positive"],
            counts["evaluation_error"],
            counts["unsupported"],
        ),
        grades=tuple(grades),
    )
