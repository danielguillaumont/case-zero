"""Load local CASE//ZERO replay fixtures without application configuration.

Version 1 is UTF-8 JSON. The root contains schema_version (integer 1),
fixture_id, provenance (source and optional description), and a nonempty
events array. Each event contains event_id, event_time, and fields. Fields
require event_type and source, and may include hostname, username, source_ip,
destination_ip, process_name and command_line as strings or null. Unknown
properties and duplicate JSON keys are rejected.

The original zero-based array index is the ordinal. Timestamps require an
explicit known offset and at most six fractional digits. Results are sorted
by UTC instant and then ordinal. The recorded timestamp text is retained for
provenance. Event IDs are opaque, case-sensitive strings.

The SHA-256 hashes the normalized envelope, including fixture provenance and
sorted events with their original ordinals. It excludes recorded timestamp
spelling. Canonical timestamps are UTC strings with
six fractional digits and a Z suffix. Canonical JSON uses sorted keys, ASCII
escapes and compact separators, encoded as UTF-8 with no trailing newline.
Thus object-key order, formatting and equivalent offsets are immaterial, but
array order and the distinction between omitted and null fields matter.
"""

import hashlib
import json
import re
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from types import MappingProxyType


MAX_FILE_BYTES = 1024 * 1024
MAX_EVENTS = 1000
MAX_NESTING_DEPTH = 8
MAX_FIELD_BYTES = 4096

_TIMESTAMP = re.compile(
    r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}"
    r"(?:\.[0-9]{1,6})?(?:Z|[+-](?:[01][0-9]|2[0-3]):[0-5][0-9])"
)
_REQUIRED_EVENT_FIELDS = frozenset({"event_type", "source"})
_OPTIONAL_EVENT_FIELDS = frozenset({
    "hostname", "username", "source_ip", "destination_ip", "process_name", "command_line",
})


class FixtureError(ValueError):
    """A fixture could not be read or did not meet the versioned contract."""


@dataclass(frozen=True, slots=True)
class ReplayEvent:
    event_id: str
    event_time: datetime
    recorded_event_time: str
    ordinal: int
    fields: Mapping[str, str | None]


@dataclass(frozen=True, slots=True)
class ReplayFixture:
    schema_version: int
    fixture_id: str
    provenance: Mapping[str, str]
    events: tuple[ReplayEvent, ...]
    content_hash: str


def _check_depth(document: str) -> None:
    # Scan before json.loads so hostile nesting never reaches its parser.
    depth = 0
    in_string = escaped = False
    for char in document:
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
        elif char == '"':
            in_string = True
        elif char in "[{":
            depth += 1
            if depth > MAX_NESTING_DEPTH:
                raise FixtureError(f"Fixture exceeds maximum nesting depth ({MAX_NESTING_DEPTH}).")
        elif char in "]}":
            depth -= 1
            if depth < 0:
                raise FixtureError("Malformed fixture JSON.")


def _unique_keys(pairs: list[tuple[str, object]]) -> dict[str, object]:
    result: dict[str, object] = {}
    for key, value in pairs:
        _string(key, "JSON object key")
        if key in result:
            raise FixtureError("Duplicate JSON object key.")
        result[key] = value
    return result


def _reject_constant(_: str) -> None:
    raise FixtureError("Malformed fixture JSON: non-finite number.")


def _object(
    value: object, label: str, required: frozenset[str], optional: frozenset[str] = frozenset(),
) -> dict[str, object]:
    if not isinstance(value, dict):
        raise FixtureError(f"{label} must be an object.")
    missing = required - value.keys()
    if missing:
        raise FixtureError(f"{label} is missing required fields: {', '.join(sorted(missing))}.")
    if value.keys() - required - optional:
        raise FixtureError(f"{label} contains unsupported fields.")
    return value


def _string(value: object, label: str, *, nonempty: bool = False) -> str:
    if not isinstance(value, str) or (nonempty and not value.strip()):
        raise FixtureError(f"{label} must be {'a nonempty' if nonempty else 'a'} string.")
    try:
        length = len(value.encode("utf-8"))
    except UnicodeEncodeError:
        raise FixtureError(f"{label} must contain valid Unicode.") from None
    if length > MAX_FIELD_BYTES:
        raise FixtureError(f"{label} exceeds maximum field size ({MAX_FIELD_BYTES} UTF-8 bytes).")
    return value


def _utc_timestamp(timestamp: str, label: str) -> datetime:
    if not _TIMESTAMP.fullmatch(timestamp) or timestamp.endswith("-00:00"):
        raise FixtureError(f"{label} must have an explicit known UTC offset and at most six fractional digits.")
    try:
        return datetime.fromisoformat(timestamp).astimezone(timezone.utc)
    except (ValueError, OverflowError):
        raise FixtureError(f"{label} is not a valid UTC-normalizable timestamp.") from None


def load_replay_fixture(path: Path) -> ReplayFixture:
    """Read a bounded regular JSON file from a caller-selected local path."""
    try:
        if path.as_posix().startswith("//"):
            raise FixtureError("Fixture path must refer to a local file.")
        path = path.resolve(strict=True)
        if path.as_posix().startswith("//") or not path.is_file():
            raise FixtureError("Fixture path must refer to a regular local file.")
        with path.open("rb") as stream:
            data = stream.read(MAX_FILE_BYTES + 1)
    except FixtureError:
        raise
    except (OSError, RuntimeError, ValueError):
        raise FixtureError("Unable to read fixture file.") from None
    if len(data) > MAX_FILE_BYTES:
        raise FixtureError(f"Fixture exceeds maximum file size ({MAX_FILE_BYTES} bytes).")
    try:
        document = data.decode("utf-8")
        _check_depth(document)
        raw = json.loads(document, object_pairs_hook=_unique_keys, parse_constant=_reject_constant)
    except FixtureError:
        raise
    except (ValueError, RecursionError):
        raise FixtureError("Malformed fixture JSON or invalid UTF-8.") from None

    root = _object(raw, "Fixture", frozenset({"schema_version", "fixture_id", "provenance", "events"}))
    version = root["schema_version"]
    if type(version) is not int:
        raise FixtureError("schema_version must be an integer.")
    if version != 1:
        raise FixtureError("Unsupported fixture schema version.")
    fixture_id = _string(root["fixture_id"], "fixture_id", nonempty=True)
    provenance_data = _object(root["provenance"], "provenance", frozenset({"source"}), frozenset({"description"}))
    provenance = {
        key: _string(value, f"provenance.{key}", nonempty=key == "source")
        for key, value in provenance_data.items()
    }

    event_data = root["events"]
    if not isinstance(event_data, list) or not event_data:
        raise FixtureError("events must be a nonempty array.")
    if len(event_data) > MAX_EVENTS:
        raise FixtureError(f"Fixture exceeds maximum event count ({MAX_EVENTS}).")
    events: list[ReplayEvent] = []
    event_ids: set[str] = set()
    for ordinal, candidate in enumerate(event_data):
        label = f"events[{ordinal}]"
        event = _object(candidate, label, frozenset({"event_id", "event_time", "fields"}))
        event_id = _string(event["event_id"], f"{label}.event_id", nonempty=True)
        if event_id in event_ids:
            raise FixtureError(f"{label} has a duplicate event ID.")
        event_ids.add(event_id)
        recorded_event_time = _string(event["event_time"], f"{label}.event_time")
        event_time = _utc_timestamp(recorded_event_time, f"{label}.event_time")
        raw_fields = _object(event["fields"], f"{label}.fields", _REQUIRED_EVENT_FIELDS, _OPTIONAL_EVENT_FIELDS)
        fields = {
            key: None if value is None and key in _OPTIONAL_EVENT_FIELDS
            else _string(value, f"{label}.fields.{key}", nonempty=key in _REQUIRED_EVENT_FIELDS)
            for key, value in raw_fields.items()
        }
        events.append(ReplayEvent(event_id, event_time, recorded_event_time, ordinal, MappingProxyType(fields)))

    ordered = tuple(sorted(events, key=lambda event: (event.event_time, event.ordinal)))
    canonical = {
        "schema_version": version,
        "fixture_id": fixture_id,
        "provenance": provenance,
        "events": [
            {
                "event_id": event.event_id,
                "event_time": event.event_time.isoformat(timespec="microseconds").replace("+00:00", "Z"),
                "ordinal": event.ordinal,
                "fields": dict(event.fields),
            }
            for event in ordered
        ],
    }
    encoded = json.dumps(canonical, sort_keys=True, ensure_ascii=True, separators=(",", ":")).encode("utf-8")
    return ReplayFixture(version, fixture_id, MappingProxyType(provenance), ordered, hashlib.sha256(encoded).hexdigest())
