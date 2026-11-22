"""Ground truth authored independently of replay decisions.

A set targets one normalized fixture revision and one logical rule so that
the same labels can be used across rule versions. Labels are scoped to exact,
case-sensitive event IDs. Unlabeled events carry no ground truth. Sources
and rationales are inert annotations. Grading belongs to a later slice.

Schema v1 hashes the entire canonical document: schema version, fixture ID
and digest, logical rule ID, authoring version ID, and each label's ID, name,
event ID, polarity, expected outcome, source and rationale. Labels are sorted
by ID. Object keys are sorted and JSON uses compact separators, ASCII escapes
and UTF-8 without a trailing newline. Text is preserved exactly.
"""

import hashlib
import json
import re
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Literal

from app.services.replay_fixtures import (
    MAX_EVENTS, MAX_FILE_BYTES, FixtureError, ReplayFixture,
    _check_depth, _object, _reject_constant, _unique_keys,
)
from app.services.rule_versions import RuleVersion


_EXPECTATION_ID = re.compile(r"[a-z0-9][a-z0-9-]{0,79}")
_SHA256 = re.compile(r"[0-9a-f]{64}")
_SET_FIELDS = frozenset({
    "schema_version", "fixture_id", "fixture_sha256", "rule_id", "authoring_version_id", "expectations",
})
_LABEL_FIELDS = frozenset({
    "expectation_id", "name", "event_id", "polarity", "expected_outcome", "source", "rationale",
})


class ExpectationError(ValueError):
    """An expectation or its target fails the ground-truth contract."""


def _require_text(value: str, field: str) -> None:
    if type(value) is not str or not 1 <= len(value) <= 4096 or not value.strip():
        raise ExpectationError(f"{field} must be a nonblank string of at most 4096 characters.")
    try:
        value.encode("utf-8")
    except UnicodeEncodeError:
        raise ExpectationError(f"{field} must contain valid Unicode.") from None


@dataclass(frozen=True, slots=True)
class DetectionExpectation:
    expectation_id: str
    event_id: str
    expected_outcome: Literal["match", "no_match"]
    source: str
    rationale: str
    name: str
    polarity: Literal["positive", "negative"]

    def __post_init__(self) -> None:
        if type(self.expectation_id) is not str or not _EXPECTATION_ID.fullmatch(self.expectation_id):
            raise ExpectationError("expectation_id must be a lowercase alphanumeric or hyphenated ID.")
        if type(self.expected_outcome) is not str or self.expected_outcome not in ("match", "no_match"):
            raise ExpectationError("expected_outcome must be match or no_match.")
        if type(self.polarity) is not str or self.polarity not in ("positive", "negative"):
            raise ExpectationError("polarity must be positive or negative.")
        if (self.polarity == "positive") != (self.expected_outcome == "match"):
            raise ExpectationError("polarity contradicts expected_outcome.")
        _require_text(self.name, "name")
        _require_text(self.event_id, "event_id")
        _require_text(self.source, "source")
        _require_text(self.rationale, "rationale")


@dataclass(frozen=True, slots=True)
class ReplayExpectations:
    fixture_id: str
    fixture_sha256: str
    rule_id: str
    expectations: tuple[DetectionExpectation, ...]
    authoring_version_id: tuple[str, str]
    schema_version: int = 1

    def __post_init__(self) -> None:
        if type(self.schema_version) is not int or self.schema_version != 1:
            raise ExpectationError("Unsupported expectation schema version.")
        _require_text(self.fixture_id, "fixture_id")
        _require_text(self.rule_id, "rule_id")
        if type(self.fixture_sha256) is not str or not _SHA256.fullmatch(self.fixture_sha256):
            raise ExpectationError("fixture_sha256 must be a lowercase SHA-256 digest.")
        if (
            type(self.authoring_version_id) is not tuple
            or len(self.authoring_version_id) != 2
            or any(type(part) is not str for part in self.authoring_version_id)
            or self.authoring_version_id[0] != self.rule_id
            or not _SHA256.fullmatch(self.authoring_version_id[1])
        ):
            raise ExpectationError("authoring_version_id must pair the target rule ID with a lowercase SHA-256 digest.")
        if type(self.expectations) is not tuple or not 1 <= len(self.expectations) <= MAX_EVENTS:
            raise ExpectationError("expectations must be a nonempty tuple within the event limit.")
        expectation_ids: set[str] = set()
        event_ids: set[str] = set()
        for expectation in self.expectations:
            if type(expectation) is not DetectionExpectation:
                raise ExpectationError("Each label must be a DetectionExpectation.")
            if expectation.expectation_id in expectation_ids:
                raise ExpectationError("Duplicate expectation ID.")
            if expectation.event_id in event_ids:
                raise ExpectationError("Multiple expectations target the same event.")
            expectation_ids.add(expectation.expectation_id)
            event_ids.add(expectation.event_id)

    def canonical_json(self) -> bytes:
        payload = asdict(self)
        payload["expectations"] = sorted(payload["expectations"], key=lambda label: label["expectation_id"])
        return json.dumps(payload, sort_keys=True, ensure_ascii=True, separators=(",", ":")).encode("utf-8")

    @property
    def content_sha256(self) -> str:
        return hashlib.sha256(self.canonical_json()).hexdigest()

    def validate_authoring_version(self, version: RuleVersion) -> None:
        """Verify the recorded identity against the independently supplied original version."""
        if (
            type(version) is not RuleVersion
            or version.version_id != self.authoring_version_id
            or RuleVersion(version.definition).version_id != self.authoring_version_id
        ):
            raise ExpectationError("Authoring rule version does not match the recorded identity.")

    def validate_target(self, fixture: ReplayFixture, rule_id: str) -> None:
        """Check applicability to a loader-normalized fixture and logical rule."""
        if type(rule_id) is not str or rule_id != self.rule_id:
            raise ExpectationError("Expectations target a different rule ID.")
        if (fixture.fixture_id, fixture.content_hash) != (self.fixture_id, self.fixture_sha256):
            raise ExpectationError("Expectations target a different fixture revision.")
        event_ids = {event.event_id for event in fixture.events}
        if any(expectation.event_id not in event_ids for expectation in self.expectations):
            raise ExpectationError("An expectation references an unknown event ID.")


def load_replay_expectations(path: Path, fixture: ReplayFixture, authoring_version: RuleVersion) -> ReplayExpectations:
    """Load and validate a bounded local asset against its explicit provenance."""
    try:
        if path.as_posix().startswith("//"):
            raise ExpectationError("Expectation path must refer to a local file.")
        path = path.resolve(strict=True)
        if path.as_posix().startswith("//") or not path.is_file():
            raise ExpectationError("Expectation path must refer to a regular local file.")
        with path.open("rb") as stream:
            data = stream.read(MAX_FILE_BYTES + 1)
    except ExpectationError:
        raise
    except (OSError, RuntimeError, ValueError):
        raise ExpectationError("Unable to read expectation file.") from None
    if len(data) > MAX_FILE_BYTES:
        raise ExpectationError("Expectation file exceeds maximum size.")

    try:
        document = data.decode("utf-8")
        _check_depth(document)
        raw = json.loads(document, object_pairs_hook=_unique_keys, parse_constant=_reject_constant)
        payload = _object(raw, "Expectation set", _SET_FIELDS)
        if type(payload["schema_version"]) is not int or payload["schema_version"] != 1:
            raise ExpectationError("Unsupported expectation schema version.")
        labels = payload["expectations"]
        if type(labels) is not list or not 1 <= len(labels) <= MAX_EVENTS:
            raise ExpectationError("expectations must be a nonempty array within the event limit.")
        version_id = payload["authoring_version_id"]
        if type(version_id) is not list or len(version_id) != 2:
            raise ExpectationError("authoring_version_id must be a two-element array.")
        payload["authoring_version_id"] = tuple(version_id)
        payload["expectations"] = tuple(
            DetectionExpectation(**_object(label, "Expectation label", _LABEL_FIELDS)) for label in labels
        )
        expectations = ReplayExpectations(**payload)
    except FixtureError as exc:
        raise ExpectationError(str(exc)) from None
    except ExpectationError:
        raise
    except (ValueError, RecursionError):
        raise ExpectationError("Malformed expectation JSON or invalid UTF-8.") from None
    expectations.validate_authoring_version(authoring_version)
    expectations.validate_target(fixture, authoring_version.definition.rule_id)
    return expectations
