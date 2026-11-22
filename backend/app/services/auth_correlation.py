"""Bounded event-time authentication correlation for offline replay."""

import argparse
import hashlib
import json
import sys
from collections import deque
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
from ipaddress import ip_address
from pathlib import Path

from app.services.replay_fixtures import (
    MAX_EVENTS,
    MAX_FILE_BYTES,
    FixtureError,
    _check_depth,
    _object,
    _reject_constant,
    _string,
    _unique_keys,
    _utc_timestamp,
)

FIXTURE_TYPE = "authentication-correlation"
SCHEMA_VERSION = 1
RULE_ID = "auth-brute-force"
EVALUATOR_CONTRACT = "auth-brute-force-offline/v1"
FAILURE_THRESHOLD = 5
WINDOW = timedelta(minutes=5)
FAILURE_OUTCOMES = frozenset({"failure", "failed", "denied", "invalid"})
_EVENT_FIELDS = frozenset(
    {"event_id", "event_time", "event_type", "username", "source_ip", "outcome"}
)
_MIN_EVENT_TIME = datetime.min.replace(tzinfo=timezone.utc) + WINDOW


@dataclass(frozen=True, slots=True)
class AuthenticationEvent:
    event_id: str
    event_time: datetime
    recorded_event_time: str
    source_ordinal: int
    username: str
    source_ip: str
    outcome: str


@dataclass(frozen=True, slots=True)
class AuthenticationFixture:
    fixture_id: str
    source: str
    events: tuple[AuthenticationEvent, ...]
    content_sha256: str


@dataclass(frozen=True, slots=True)
class CorrelationMatch:
    group_ordinal: int
    trigger_event_id: str
    contributing_event_ids: tuple[str, ...]
    window_start: str
    window_end: str


@dataclass(frozen=True, slots=True)
class CorrelationResult:
    fixture_id: str
    input_sha256: str
    event_count: int
    matches: tuple[CorrelationMatch, ...]

    def canonical_json(self) -> bytes:
        payload = {
            **asdict(self),
            "schema_version": SCHEMA_VERSION,
            "rule_id": RULE_ID,
            "evaluator_contract": EVALUATOR_CONTRACT,
        }
        return _canonical_json(
            {**payload, "output_sha256": _sha256(_canonical_json(payload))}
        )


def _canonical_json(payload: dict) -> bytes:
    return json.dumps(
        payload, sort_keys=True, ensure_ascii=True, separators=(",", ":")
    ).encode("utf-8")


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _utc_text(value: datetime) -> str:
    return value.isoformat(timespec="microseconds").replace("+00:00", "Z")


def _fixture_digest(
    fixture_id: str, source: str, events: tuple[AuthenticationEvent, ...]
) -> str:
    return _sha256(
        _canonical_json(
            {
                "fixture_type": FIXTURE_TYPE,
                "schema_version": SCHEMA_VERSION,
                "fixture_id": fixture_id,
                "provenance": {"source": source},
                "events": [
                    {
                        "event_id": event.event_id,
                        "event_time": _utc_text(event.event_time),
                        "event_type": "authentication",
                        "source_ordinal": event.source_ordinal,
                        "username": event.username,
                        "source_ip": event.source_ip,
                        "outcome": event.outcome,
                    }
                    for event in events
                ],
            }
        )
    )


def _event(raw: object, ordinal: int) -> AuthenticationEvent:
    label = f"events[{ordinal}]"
    item = _object(raw, label, _EVENT_FIELDS)
    values = {
        key: _string(item[key], f"{label}.{key}", nonempty=True)
        for key in sorted(_EVENT_FIELDS)
    }
    if values["event_type"] != "authentication":
        raise FixtureError(f"{label}.event_type must be authentication.")
    if values["outcome"] not in FAILURE_OUTCOMES | {"success"}:
        raise FixtureError(f"{label}.outcome is unsupported.")
    try:
        if "%" in values["source_ip"]:
            raise ValueError
        ip_address(values["source_ip"])
    except ValueError:
        raise FixtureError(
            f"{label}.source_ip must be an unscoped IPv4 or IPv6 address."
        ) from None
    recorded = values["event_time"]
    event_time = _utc_timestamp(recorded, f"{label}.event_time")
    if event_time < _MIN_EVENT_TIME:
        raise FixtureError(
            f"{label}.event_time cannot represent a five-minute lookback."
        )
    return AuthenticationEvent(
        values["event_id"],
        event_time,
        recorded,
        ordinal,
        values["username"],
        values["source_ip"],
        values["outcome"],
    )


def load_authentication_fixture(path: Path) -> AuthenticationFixture:
    """Load the separate correlation fixture format from a bounded local file."""
    try:
        if path.as_posix().startswith("//"):
            raise FixtureError("Authentication fixture must be local.")
        path = path.resolve(strict=True)
        if path.as_posix().startswith("//") or not path.is_file():
            raise FixtureError("Authentication fixture must be a regular local file.")
        with path.open("rb") as stream:
            data = stream.read(MAX_FILE_BYTES + 1)
    except FixtureError:
        raise
    except (OSError, RuntimeError, ValueError):
        raise FixtureError("Unable to read authentication fixture.") from None
    if len(data) > MAX_FILE_BYTES:
        raise FixtureError("Authentication fixture exceeds maximum file size.")
    try:
        document = data.decode("utf-8")
        _check_depth(document)
        raw = json.loads(
            document, object_pairs_hook=_unique_keys, parse_constant=_reject_constant
        )
    except FixtureError:
        raise
    except (ValueError, RecursionError):
        raise FixtureError(
            "Malformed authentication fixture JSON or invalid UTF-8."
        ) from None
    root = _object(
        raw,
        "Authentication fixture",
        frozenset(
            {"fixture_type", "schema_version", "fixture_id", "provenance", "events"}
        ),
    )
    if (
        root["fixture_type"] != FIXTURE_TYPE
        or type(root["schema_version"]) is not int
        or root["schema_version"] != SCHEMA_VERSION
    ):
        raise FixtureError("Unsupported authentication fixture type or schema version.")
    fixture_id = _string(root["fixture_id"], "fixture_id", nonempty=True)
    provenance = _object(root["provenance"], "provenance", frozenset({"source"}))
    source = _string(provenance["source"], "provenance.source", nonempty=True)
    records = root["events"]
    if type(records) is not list or not 1 <= len(records) <= MAX_EVENTS:
        raise FixtureError(f"events must be an array of 1 to {MAX_EVENTS} records.")
    events = []
    seen = set()
    for ordinal, raw_event in enumerate(records):
        event = _event(raw_event, ordinal)
        if event.event_id in seen:
            raise FixtureError(f"events[{ordinal}] has a duplicate event ID.")
        seen.add(event.event_id)
        events.append(event)
    ordered = tuple(
        sorted(events, key=lambda event: (event.event_time, event.source_ordinal))
    )
    return AuthenticationFixture(
        fixture_id, source, ordered, _fixture_digest(fixture_id, source, ordered)
    )


def correlate_authentication(fixture: AuthenticationFixture) -> CorrelationResult:
    """Detect transitions from fewer than five failures to five in a closed window."""
    if (
        type(fixture) is not AuthenticationFixture
        or not 1 <= len(fixture.events) <= MAX_EVENTS
    ):
        raise FixtureError(
            "Expected a bounded, loader-normalized authentication fixture."
        )
    if fixture.content_sha256 != _fixture_digest(
        fixture.fixture_id, fixture.source, fixture.events
    ):
        raise FixtureError("Authentication fixture content SHA-256 mismatch.")
    groups: dict[tuple[str, str], tuple[int, deque[AuthenticationEvent]]] = {}
    matches = []
    for event in fixture.events:
        if event.outcome not in FAILURE_OUTCOMES:
            continue
        key = (event.username, event.source_ip)
        if key not in groups:
            groups[key] = (event.source_ordinal, deque())
        group_ordinal, failures = groups[key]
        window_start = event.event_time - WINDOW
        while failures and failures[0].event_time < window_start:
            failures.popleft()
        failures.append(event)
        if len(failures) == FAILURE_THRESHOLD:
            matches.append(
                CorrelationMatch(
                    group_ordinal,
                    event.event_id,
                    tuple(item.event_id for item in failures),
                    _utc_text(window_start),
                    _utc_text(event.event_time),
                )
            )
    return CorrelationResult(
        fixture.fixture_id, fixture.content_sha256, len(fixture.events), tuple(matches)
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("fixture", type=Path)
    args = parser.parse_args(argv)
    try:
        result = correlate_authentication(load_authentication_fixture(args.fixture))
    except FixtureError as exc:
        print(str(exc), file=sys.stderr)
        return 2
    sys.stdout.buffer.write(result.canonical_json())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
