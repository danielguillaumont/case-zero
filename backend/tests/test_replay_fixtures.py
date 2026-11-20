import json
from dataclasses import FrozenInstanceError
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path

import pytest

from app.services import replay_fixtures as fixtures


def event(event_id, timestamp="2026-11-20T12:00:00Z", **fields):
    return {
        "event_id": event_id,
        "event_time": timestamp,
        "fields": {"event_type": "process_creation", "source": "synthetic", **fields},
    }


def manifest(*events):
    return {
        "schema_version": 1,
        "fixture_id": "synthetic-processes",
        "provenance": {"source": "synthetic", "description": "Local test fixture"},
        "events": list(events),
    }


def write_fixture(tmp_path, payload):
    path = tmp_path / "fixture.json"
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


def test_repeated_load_preserves_input_and_matches_documented_hash(tmp_path):
    payload = manifest(event("evt-original", command_line="echo café"))
    path = write_fixture(tmp_path, payload)
    original_bytes = path.read_bytes()
    first = fixtures.load_replay_fixture(path)
    second = fixtures.load_replay_fixture(path)

    assert first == second
    canonical = (
        r'{"events":[{"event_id":"evt-original","event_time":"2026-11-20T12:00:00.000000Z",'
        r'"fields":{"command_line":"echo caf\u00e9","event_type":"process_creation","source":"synthetic"},'
        r'"ordinal":0}],"fixture_id":"synthetic-processes",'
        r'"provenance":{"description":"Local test fixture","source":"synthetic"},"schema_version":1}'
    )
    assert first.content_hash == second.content_hash == sha256(canonical.encode("utf-8")).hexdigest()
    assert first.provenance == payload["provenance"]
    assert path.read_bytes() == original_bytes
    assert json.loads(original_bytes) == payload


def test_key_order_whitespace_and_equivalent_offsets_do_not_change_hash(tmp_path):
    payload = manifest(event("evt-1"))
    path = write_fixture(tmp_path, payload)
    first = fixtures.load_replay_fixture(path)
    path.write_text(json.dumps(payload, sort_keys=True, indent=2), encoding="utf-8")
    assert fixtures.load_replay_fixture(path) == first

    payload["events"][0]["event_time"] = "2026-11-20T07:00:00-05:00"
    path.write_text(json.dumps(payload, sort_keys=True, indent=2), encoding="utf-8")

    second = fixtures.load_replay_fixture(path)
    assert second.content_hash == first.content_hash
    assert second.events[0].event_time == first.events[0].event_time
    assert second.events[0].recorded_event_time == "2026-11-20T07:00:00-05:00"


def test_sorting_uses_utc_then_input_ordinal_and_preserves_ids(tmp_path):
    first = event("last", "2026-11-20T12:00:01Z")
    second = event("z-tie", "2026-11-20T14:00:00+02:00")
    third = event("early", "2026-11-20T06:59:59.999999-05:00")
    fourth = event("a-tie", "2026-11-20T12:00:00Z")
    result = fixtures.load_replay_fixture(write_fixture(tmp_path, manifest(first, second, third, fourth)))

    assert [(item.event_id, item.ordinal) for item in result.events] == [
        ("early", 2), ("z-tie", 1), ("a-tie", 3), ("last", 0),
    ]
    assert result.events[1].event_time == result.events[2].event_time == datetime(
        2026, 11, 20, 12, tzinfo=timezone.utc,
    )
    assert all(item.event_time.tzinfo is timezone.utc for item in result.events)
    reordered = fixtures.load_replay_fixture(write_fixture(tmp_path, manifest(third, second, fourth, first)))
    assert reordered.content_hash != result.content_hash


def test_loaded_metadata_and_fields_are_read_only_and_commands_inert(tmp_path):
    marker = tmp_path / "executed"
    command = f'echo "{{[[[{marker}]]]}}" > "{marker}"'
    path = write_fixture(tmp_path, manifest(event("evt-1", command_line=command, hostname=None)))
    result = fixtures.load_replay_fixture(path)

    assert result.events[0].fields["command_line"] == command
    assert result.events[0].fields["hostname"] is None
    assert not marker.exists()
    with pytest.raises(TypeError):
        result.provenance["source"] = "changed"
    with pytest.raises(TypeError):
        result.events[0].fields["command_line"] = "changed"
    with pytest.raises(FrozenInstanceError):
        result.events[0].ordinal = 9
    assert fixtures.load_replay_fixture(path) == result


def test_duplicate_ids_are_rejected_even_at_different_times(tmp_path):
    payload = manifest(event("same"), event("same", "2026-11-20T12:01:00Z"))
    with pytest.raises(fixtures.FixtureError, match=r"events\[1\].*duplicate event ID"):
        fixtures.load_replay_fixture(write_fixture(tmp_path, payload))


@pytest.mark.parametrize("timestamp", [
    None, 1, "2026-11-20T12:00:00", "2026-11-20", "2026-11-20 12:00:00Z",
    "2026-11-20T12:00:00-00:00", "2026-11-20T12:00:00+00:60", "2026-11-20T12:00:00+24:00",
    "2026-11-20T12:00:00.1234567Z", "2026-02-30T12:00:00Z", "0001-01-01T00:00:00+01:00",
])
def test_invalid_timestamps(tmp_path, timestamp):
    with pytest.raises(fixtures.FixtureError, match=r"events\[0\]\.event_time"):
        fixtures.load_replay_fixture(write_fixture(tmp_path, manifest(event("evt-1", timestamp))))


def test_missing_timestamp_is_rejected(tmp_path):
    recorded = event("evt-1")
    del recorded["event_time"]
    with pytest.raises(fixtures.FixtureError, match="missing required fields: event_time"):
        fixtures.load_replay_fixture(write_fixture(tmp_path, manifest(recorded)))


@pytest.mark.parametrize(("version", "message"), [
    (2, "Unsupported fixture schema version"),
    (True, "schema_version must be an integer"),
    (1.0, "schema_version must be an integer"),
    ("1", "schema_version must be an integer"),
])
def test_schema_version_validation(tmp_path, version, message):
    payload = manifest(event("evt-1"))
    payload["schema_version"] = version
    with pytest.raises(fixtures.FixtureError, match=message):
        fixtures.load_replay_fixture(write_fixture(tmp_path, payload))


@pytest.mark.parametrize(("payload", "message"), [
    ([], "Fixture must be an object"),
    (manifest(), "events must be a nonempty array"),
    ({**manifest(event("evt-1")), "provenance": {}}, "provenance is missing required fields: source"),
    (manifest(event("")), "event_id must be a nonempty string"),
    (manifest(event("evt-1", event_type=None)), "event_type must be a nonempty string"),
    (manifest(event("evt-1", command_line=["text"])), "command_line must be a string"),
    (manifest(event("evt-1", unknown="value")), "fields contains unsupported fields"),
    (manifest({**event("evt-1"), "ordinal": 0}), r"events\[0\] contains unsupported fields"),
])
def test_rejects_bad_contract(tmp_path, payload, message):
    with pytest.raises(fixtures.FixtureError, match=message):
        fixtures.load_replay_fixture(write_fixture(tmp_path, payload))


@pytest.mark.parametrize(("data", "message"), [
    (b'{"events":', "Malformed fixture JSON"),
    (b'\xff', "invalid UTF-8"),
    (b'{"fixture_id":"a","fixture_id":"b"}', "Duplicate JSON object key"),
    (b'{"schema_version":NaN}', "non-finite number"),
])
def test_bad_json(tmp_path, data, message):
    path = tmp_path / "fixture.json"
    path.write_bytes(data)
    with pytest.raises(fixtures.FixtureError, match=message):
        fixtures.load_replay_fixture(path)


@pytest.mark.parametrize(("data", "message"), [
    pytest.param(b" " * (fixtures.MAX_FILE_BYTES + 1), "maximum file size", id="file-size"),
    pytest.param(
        b"[" * (fixtures.MAX_NESTING_DEPTH + 1) + b"]" * (fixtures.MAX_NESTING_DEPTH + 1),
        "maximum nesting depth",
        id="nesting-depth",
    ),
])
def test_byte_and_depth_bounds_apply_before_json_parsing(tmp_path, monkeypatch, data, message):
    path = tmp_path / "fixture.json"
    path.write_bytes(data)

    def unexpected_parser(*args, **kwargs):
        pytest.fail("JSON parsing should not start")

    monkeypatch.setattr(fixtures.json, "loads", unexpected_parser)
    with pytest.raises(fixtures.FixtureError, match=message):
        fixtures.load_replay_fixture(path)


def test_event_count_bounds(tmp_path):
    events = [event(str(index)) for index in range(fixtures.MAX_EVENTS + 1)]
    with pytest.raises(fixtures.FixtureError, match="maximum event count"):
        fixtures.load_replay_fixture(write_fixture(tmp_path, manifest(*events)))


def test_field_size_is_measured_in_utf8_bytes(tmp_path):
    max_value = "é" * (fixtures.MAX_FIELD_BYTES // 2)
    payload = manifest(event("evt-1", command_line=max_value))
    result = fixtures.load_replay_fixture(write_fixture(tmp_path, payload))
    assert result.events[0].fields["command_line"] == max_value
    payload["events"][0]["fields"]["command_line"] += "x"
    with pytest.raises(fixtures.FixtureError, match="maximum field size"):
        fixtures.load_replay_fixture(write_fixture(tmp_path, payload))


def test_rejects_nonregular_and_unc_paths(tmp_path):
    with pytest.raises(fixtures.FixtureError, match="regular local file"):
        fixtures.load_replay_fixture(tmp_path)
    with pytest.raises(fixtures.FixtureError, match="local file"):
        fixtures.load_replay_fixture(Path("//fixture-test.invalid/share/fixture.json"))
