import hashlib
import json
import subprocess
import sys
from dataclasses import FrozenInstanceError, replace
from pathlib import Path

import pytest

from app.services.auth_correlation import (
    correlate_authentication,
    load_authentication_fixture,
)
from app.services.replay_fixtures import (
    MAX_EVENTS,
    MAX_FILE_BYTES,
    FixtureError,
    load_replay_fixture,
)

BACKEND = Path(__file__).resolve().parents[1]
DEMO = Path(__file__).with_name("fixtures") / "authentication-correlation.json"


def auth_event(index, time=None, **fields):
    return {
        "event_id": f"e{index}",
        "event_time": time if time is not None else f"2026-11-20T12:00:{index:02d}Z",
        "event_type": "authentication",
        "username": "test-user",
        "source_ip": "192.0.2.10",
        "outcome": "failure",
        **fields,
    }


def write_fixture(tmp_path, events, **fields):
    path = tmp_path / "authentication.json"
    path.write_text(
        json.dumps(
            {
                "fixture_type": "authentication-correlation",
                "schema_version": 1,
                "fixture_id": "test-auth",
                "provenance": {"source": "synthetic"},
                "events": events,
                **fields,
            }
        ),
        encoding="utf-8",
    )
    return path


def evaluate(tmp_path, events):
    return correlate_authentication(
        load_authentication_fixture(write_fixture(tmp_path, events))
    )


def test_demo_refs_threshold_inclusive_boundary_sorted_ties_and_private_group_identity():
    fixture = load_authentication_fixture(DEMO)
    result = correlate_authentication(fixture)
    [match] = result.matches
    assert result.event_count == 8
    assert fixture.events[0].source_ordinal == match.group_ordinal == 1
    assert match.trigger_event_id == "threshold"
    assert match.contributing_event_ids == (
        "first",
        "second",
        "third",
        "fourth",
        "threshold",
    )
    assert match.window_start == "2026-11-20T12:00:00.000000Z"
    assert match.window_end == "2026-11-20T12:05:00.000000Z"
    assert result.input_sha256 == fixture.content_sha256
    assert b"demo-user" not in result.canonical_json()
    assert b"192.0.2.8" not in result.canonical_json()
    assert b"case-zero-synthetic" not in result.canonical_json()
    with pytest.raises(FrozenInstanceError):
        match.trigger_event_id = "other"


def test_four_fifth_and_sixth_and_run_state_reset(tmp_path):
    events = [auth_event(i) for i in range(6)]
    assert evaluate(tmp_path, events[:4]).matches == ()
    [fifth] = evaluate(tmp_path, events[:5]).matches
    assert fifth.trigger_event_id == "e4"
    assert evaluate(tmp_path, events).matches == (fifth,)
    assert evaluate(tmp_path, events[:4]).matches == ()


@pytest.mark.parametrize(
    "difference",
    [
        {"username": "Test-user"},
        {"source_ip": "192.0.2.11"},
        {"outcome": "success"},
    ],
)
def test_groups_are_exact_and_success_neither_counts_nor_resets(tmp_path, difference):
    events = [auth_event(i) for i in (0, 1, 3, 4)] + [auth_event(2, **difference)]
    assert evaluate(tmp_path, events).matches == ()
    [match] = evaluate(tmp_path, [*events, auth_event(5)]).matches
    assert match.contributing_event_ids == ("e0", "e1", "e3", "e4", "e5")


def test_equivalent_ipv6_spellings_remain_separate_group_keys(tmp_path):
    events = [auth_event(i, source_ip="2001:db8::1") for i in range(4)]
    events.append(auth_event(4, source_ip="2001:0db8::1"))
    assert evaluate(tmp_path, events).matches == ()


def test_just_outside_closed_window_does_not_count(tmp_path):
    events = [auth_event(i) for i in range(4)]
    assert (
        evaluate(
            tmp_path, [*events, auth_event(4, "2026-11-20T12:05:00.000001Z")]
        ).matches
        == ()
    )


def test_threshold_rearms_when_expiration_drops_prior_count_below_five(tmp_path):
    events = [auth_event(i) for i in range(6)]
    events.extend(
        [
            auth_event(6, "2026-11-20T12:05:02.000001Z"),
            auth_event(7, "2026-11-20T12:05:03Z"),
        ]
    )
    first, second = evaluate(tmp_path, events).matches
    assert first.trigger_event_id == "e4"
    assert second.trigger_event_id == "e7"
    assert second.contributing_event_ids == ("e3", "e4", "e5", "e6", "e7")
    assert first.group_ordinal == second.group_ordinal


def test_tied_triggers_are_ordered_by_source_ordinal_across_groups(tmp_path):
    events = [auth_event(i) for i in range(4)]
    events += [
        auth_event(i, f"2026-11-20T12:00:0{i - 4}Z", username="other")
        for i in range(4, 8)
    ]
    events += [
        auth_event(8, "2026-11-20T12:00:09Z", username="other"),
        auth_event(9, "2026-11-20T12:00:09Z"),
    ]
    assert [m.trigger_event_id for m in evaluate(tmp_path, events).matches] == [
        "e8",
        "e9",
    ]


def test_input_identity_normalizes_utc_but_preserves_event_ordinals_and_content(
    tmp_path,
):
    records = [auth_event(0), auth_event(1)]
    original = load_authentication_fixture(write_fixture(tmp_path, records))
    alternative = {**records[0], "event_time": "2026-11-20T07:00:00-05:00"}
    equivalent = load_authentication_fixture(
        write_fixture(tmp_path, [alternative, records[1]])
    )
    assert original.content_sha256 == equivalent.content_sha256
    assert equivalent.events[0].recorded_event_time == alternative["event_time"]
    assert evaluate(tmp_path, records[::-1]).input_sha256 != original.content_sha256
    assert (
        evaluate(
            tmp_path, [{**records[0], "outcome": "success"}, records[1]]
        ).input_sha256
        != original.content_sha256
    )
    with pytest.raises(FixtureError, match="SHA-256 mismatch"):
        correlate_authentication(replace(original, source="tampered"))


@pytest.mark.parametrize(
    ("field", "value", "message"),
    [
        ("outcome", None, "outcome must be"),
        ("outcome", 401, "outcome must be"),
        ("outcome", "Failure", "outcome is unsupported"),
        ("outcome", "unknown", "outcome is unsupported"),
        ("username", "", "username must be"),
        ("source_ip", "host.invalid", "unscoped IPv4 or IPv6"),
        ("source_ip", "fe80::1%eth0", "unscoped IPv4 or IPv6"),
        ("event_time", "2026-11-20T12:00:00", "explicit known UTC offset"),
        ("event_time", "0001-01-01T00:00:00Z", "five-minute lookback"),
        ("event_type", "process_creation", "event_type must be authentication"),
    ],
)
def test_invalid_mandatory_values_fail_without_echoing_value(
    tmp_path, field, value, message
):
    path = write_fixture(tmp_path, [auth_event(0, **{field: value})])
    with pytest.raises(FixtureError, match=message):
        load_authentication_fixture(path)


def test_missing_outcome_and_duplicate_event_id_are_rejected(tmp_path):
    event = auth_event(0)
    del event["outcome"]
    with pytest.raises(FixtureError, match="missing required fields: outcome"):
        load_authentication_fixture(write_fixture(tmp_path, [event]))
    with pytest.raises(FixtureError, match="duplicate event ID"):
        load_authentication_fixture(
            write_fixture(tmp_path, [auth_event(0), auth_event(0)])
        )


@pytest.mark.parametrize(
    ("content", "message"),
    [
        (b"", "Malformed"),
        (b"{", "Malformed"),
        (b"\xff", "invalid UTF-8"),
        (b'{"x":1,"x":2}', "Duplicate JSON object key"),
        (b"[" * 10 + b"]" * 10, "nesting depth"),
        (b" " * (MAX_FILE_BYTES + 1), "maximum file size"),
    ],
    ids=["empty", "malformed", "utf8", "duplicate-key", "depth", "bytes"],
)
def test_malformed_documents_fail_closed(tmp_path, content, message):
    path = tmp_path / "bad.json"
    path.write_bytes(content)
    with pytest.raises(FixtureError, match=message):
        load_authentication_fixture(path)


def test_empty_oversized_and_wrong_schema_are_rejected(tmp_path):
    for records in ([], [auth_event(0)] * (MAX_EVENTS + 1)):
        with pytest.raises(FixtureError, match="array of 1 to"):
            load_authentication_fixture(write_fixture(tmp_path, records))
    with pytest.raises(FixtureError, match="Unsupported"):
        load_authentication_fixture(
            write_fixture(tmp_path, [auth_event(0)], schema_version=True)
        )
    with pytest.raises(FixtureError, match="unsupported fields"):
        load_replay_fixture(DEMO)


def test_cli_output_is_byte_identical_and_digest_covers_results():
    command = [
        sys.executable,
        "-I",
        "-B",
        "-c",
        "import sys; sys.path.insert(0, '.'); from app.services.auth_correlation import main; raise SystemExit(main(sys.argv[1:]))",
        str(DEMO),
    ]
    first, second = (
        subprocess.check_output(command, cwd=BACKEND, timeout=15) for _ in range(2)
    )
    assert first == second
    payload = json.loads(first)
    digest = payload.pop("output_sha256")
    # Recorded independently in the v2.4-D closeout before import hardening.
    assert (
        payload["input_sha256"]
        == "9ece53bac4e149ae2e6a13a81ed905a4092798db90a695238c11a4574fcf7cc9"
    )
    assert digest == "f3d44b088a3a1855e52ec9ce23834488842ba331f1ab50a23c1e5fb910cb1a0f"
    assert (
        digest
        == hashlib.sha256(
            json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
        ).hexdigest()
    )
    assert payload["rule_id"] == "auth-brute-force"
    assert payload["evaluator_contract"] == "auth-brute-force-offline/v1"
    assert payload["matches"][0]["trigger_event_id"] == "threshold"
