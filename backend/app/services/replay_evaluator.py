"""Evaluate the encoded PowerShell rule on loader-normalized replay fixtures.

Results follow the loader's UTC-time and ordinal order, one per input event.
The loader owns envelope validation and size limits. A missing event_type
produces a missing_field error. A null, blank or non-string event_type, or
a non-string, non-null process_name or command_line, produces an
invalid_field error. Omitted, null and empty optional fields retain the
live predicate's non-match behavior. All three fields are validated before
matching. Error results identify the field without echoing its content.
"""

from dataclasses import dataclass
from typing import Literal

from app.services.replay_fixtures import ReplayEvent, ReplayFixture
from app.services.single_event_evaluator import matches_encoded_powershell


ENCODED_POWERSHELL_RULE_ID = "encoded-powershell"


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


def _evaluate_event(event: ReplayEvent) -> EvaluationResult:
    event_type = event.fields.get("event_type")
    process_name = event.fields.get("process_name")
    command_line = event.fields.get("command_line")
    reference = (ENCODED_POWERSHELL_RULE_ID, event.event_id, event.ordinal)

    if "event_type" not in event.fields:
        return EvaluationResult(*reference, "error", EvaluationError("missing_field", "event_type"))
    if not isinstance(event_type, str) or not event_type.strip():
        return EvaluationResult(*reference, "error", EvaluationError("invalid_field", "event_type"))
    if process_name is not None and not isinstance(process_name, str):
        return EvaluationResult(*reference, "error", EvaluationError("invalid_field", "process_name"))
    if command_line is not None and not isinstance(command_line, str):
        return EvaluationResult(*reference, "error", EvaluationError("invalid_field", "command_line"))

    matched = matches_encoded_powershell(event_type, process_name, command_line)
    return EvaluationResult(*reference, "match" if matched else "no_match")


def evaluate_fixture(fixture: ReplayFixture, rule_id: str) -> tuple[EvaluationResult, ...]:
    """Return immutable decisions for a normalized fixture and exact rule ID."""
    if rule_id != ENCODED_POWERSHELL_RULE_ID:
        raise UnsupportedRuleError("Only the encoded-powershell rule is supported for replay.")
    return tuple(_evaluate_event(event) for event in fixture.events)
