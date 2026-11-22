"""Evaluate the encoded PowerShell rule on loader-normalized replay fixtures.

Results follow the loader's UTC-time and ordinal order, one per input event.
The loader owns envelope validation and size limits. A missing event_type
produces a missing_field error. A null, blank or non-string event_type, or
a non-string, non-null process_name or command_line, produces an
invalid_field error. Omitted, null and empty optional fields retain the
live predicate's non-match behavior. All three fields are validated before
matching. Error results identify the field without echoing its content.
"""

import re
from collections.abc import Callable
from dataclasses import dataclass, replace
from typing import Literal

from app.services.replay_fixtures import FixtureError, ReplayEvent, ReplayFixture
from app.services.rule_versions import (
    CORRECTED_EVALUATOR_CONTRACT,
    CORRECTED_PREDICATE_ID,
    WEAKENED_EVALUATOR_CONTRACT,
    WEAKENED_PREDICATE_ID,
    RuleCompatibility,
    RuleDefinition,
    RuleVersion,
)
from app.services.single_event_evaluator import (
    _is_powershell_creation,
    matches_encoded_powershell,
)


ENCODED_POWERSHELL_RULE_ID = "encoded-powershell"
EVALUATOR_CONTRACT = CORRECTED_EVALUATOR_CONTRACT
_ENCODED_POWERSHELL_VERSION = RuleVersion(RuleDefinition())
_LONG_SWITCH_PATTERN = re.compile(r"(?:^|\s)-encodedcommand(?:\s|$)", re.IGNORECASE)
_Matcher = Callable[[str, str | None, str | None], bool]


class UnsupportedRuleError(ValueError):
    """The requested rule is unavailable for replay."""


@dataclass(frozen=True, slots=True)
class EvaluationError:
    code: Literal["missing_field", "invalid_field"]
    field: Literal["event_type", "process_name", "command_line"]


@dataclass(frozen=True, slots=True)
class EvaluationResult:
    rule_id: str
    source_event_id: str
    ordinal: int
    outcome: Literal["match", "no_match", "error"]
    error: EvaluationError | None = None


@dataclass(frozen=True, slots=True)
class VersionedEvaluation:
    """In-memory decisions and the version selected by their evaluator."""

    version_id: tuple[str, str]
    decisions: tuple[EvaluationResult, ...]


def _resolve_version(
    version: RuleVersion, fixture_schema_version: int, *, allow_weakened: bool
) -> tuple[RuleVersion, _Matcher]:
    if type(version) is not RuleVersion:
        raise UnsupportedRuleError("Expected a RuleVersion for replay.")
    try:
        definition = version.definition
        if (
            type(definition) is not RuleDefinition
            or type(definition.compatibility) is not RuleCompatibility
        ):
            raise ValueError
        # Revalidate immutable values and recompute identity at the execution boundary.
        selected = RuleVersion(
            replace(definition, compatibility=replace(definition.compatibility))
        )
        supplied_digest = version.content_sha256
    except (AttributeError, ValueError) as exc:
        raise UnsupportedRuleError(
            "Invalid or unsupported replay rule definition."
        ) from exc
    if type(supplied_digest) is not str or supplied_digest != selected.content_sha256:
        raise UnsupportedRuleError(
            "Replay rule version digest does not match its definition."
        )

    definition = selected.definition
    if (
        definition.rule_id != ENCODED_POWERSHELL_RULE_ID
        or definition.definition_schema_version != 1
        or definition.compatibility.fixture_schema_version != 1
    ):
        raise UnsupportedRuleError(
            "No evaluator is registered for this replay rule definition."
        )
    if (
        type(fixture_schema_version) is not int
        or fixture_schema_version != definition.compatibility.fixture_schema_version
    ):
        raise FixtureError("Unsupported fixture schema version.")
    binding = (definition.predicate_id, definition.compatibility.evaluator_contract)
    if binding == (CORRECTED_PREDICATE_ID, EVALUATOR_CONTRACT):
        return selected, matches_encoded_powershell
    if allow_weakened and binding == (
        WEAKENED_PREDICATE_ID,
        WEAKENED_EVALUATOR_CONTRACT,
    ):
        return selected, _matches_long_switch
    raise UnsupportedRuleError(
        "No evaluator is registered for this replay rule definition."
    )


def _matches_long_switch(
    event_type: str, process_name: str | None, command_line: str | None
) -> bool:
    return _is_powershell_creation(event_type, process_name) and bool(
        _LONG_SWITCH_PATTERN.search(command_line or "")
    )


def _evaluate_encoded_powershell_event(
    event: ReplayEvent, rule_id: str, matcher: _Matcher
) -> EvaluationResult:
    event_type = event.fields.get("event_type")
    process_name = event.fields.get("process_name")
    command_line = event.fields.get("command_line")
    reference = (rule_id, event.event_id, event.ordinal)

    if "event_type" not in event.fields:
        return EvaluationResult(
            *reference, "error", EvaluationError("missing_field", "event_type")
        )
    if not isinstance(event_type, str) or not event_type.strip():
        return EvaluationResult(
            *reference, "error", EvaluationError("invalid_field", "event_type")
        )
    if process_name is not None and not isinstance(process_name, str):
        return EvaluationResult(
            *reference, "error", EvaluationError("invalid_field", "process_name")
        )
    if command_line is not None and not isinstance(command_line, str):
        return EvaluationResult(
            *reference, "error", EvaluationError("invalid_field", "command_line")
        )

    matched = matcher(event_type, process_name, command_line)
    return EvaluationResult(*reference, "match" if matched else "no_match")


def _evaluate_fixture_version(
    fixture: ReplayFixture, version: RuleVersion, *, allow_weakened: bool
) -> VersionedEvaluation:
    selected, matcher = _resolve_version(
        version, fixture.schema_version, allow_weakened=allow_weakened
    )
    decisions = tuple(
        _evaluate_encoded_powershell_event(event, selected.definition.rule_id, matcher)
        for event in fixture.events
    )
    return VersionedEvaluation(selected.version_id, decisions)


def evaluate_fixture_version(
    fixture: ReplayFixture, version: RuleVersion
) -> VersionedEvaluation:
    """Evaluate a loader-normalized fixture with the standard replay allowlist."""
    return _evaluate_fixture_version(fixture, version, allow_weakened=False)


def evaluate_regression_fixture_version(
    fixture: ReplayFixture, version: RuleVersion
) -> VersionedEvaluation:
    """Evaluate with the offline regression allowlist."""
    return _evaluate_fixture_version(fixture, version, allow_weakened=True)


def evaluate_fixture(
    fixture: ReplayFixture, rule_id: str
) -> tuple[EvaluationResult, ...]:
    """Return immutable decisions for a normalized fixture and exact rule ID."""
    if rule_id != ENCODED_POWERSHELL_RULE_ID:
        raise UnsupportedRuleError(
            "Only the encoded-powershell rule is supported for replay."
        )
    return evaluate_fixture_version(fixture, _ENCODED_POWERSHELL_VERSION).decisions
