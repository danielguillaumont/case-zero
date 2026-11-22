import hashlib
import json
from dataclasses import FrozenInstanceError, replace
from pathlib import Path
from types import MappingProxyType

import pytest

from app.services.replay_fixtures import (
    MAX_EVENTS,
    _fixture_content_hash,
    load_replay_fixture,
    parse_replay_fixture,
)
from app.services.sigma_replay import (
    SigmaCompatibilityError,
    evaluate_sigma_fixture,
    load_sigma_rule,
    trace_sigma_fixture,
)
from app.services.sysmon_replay_fixture import verify_sysmon_artifacts

FIXTURES = Path(__file__).with_name("fixtures")
BACKEND = Path(__file__).resolve().parents[1]
EXTERNAL = FIXTURES / "external/splunk-ads-abuse"


@pytest.fixture
def rule():
    return load_sigma_rule(FIXTURES / "sigma-encoded-powershell.yml")


@pytest.fixture
def synthetic():
    return load_replay_fixture(BACKEND / "app/replay_assets/encoded_powershell.json")


def variant(fixture, **fields):
    event = replace(fixture.events[0], fields=MappingProxyType(fields), ordinal=0)
    events = (event,)
    return replace(
        fixture,
        events=events,
        content_hash=_fixture_content_hash(
            fixture.schema_version, fixture.fixture_id, fixture.provenance, events
        ),
    )


def assert_decision_parity(fixture, rule):
    trace = trace_sigma_fixture(fixture, rule)
    direct = evaluate_sigma_fixture(fixture, rule)
    assert [(e.event_id, e.ordinal, e.outcome) for e in trace.events] == [
        (e.event_id, e.ordinal, e.outcome) for e in direct.decisions
    ]
    for traced, decided in zip(trace.events, direct.decisions, strict=True):
        assert [
            (f.field, f.status) for f in traced.fields if f.status != "present"
        ] == [(f.field, f.code) for f in decided.issues]
    return trace


def test_matching_and_benign_traces_have_the_actual_nested_condition_tree(
    synthetic, rule
):
    trace = assert_decision_parity(synthetic, rule)
    matched, benign, later = trace.events
    assert [e.outcome for e in trace.events] == ["match", "no_match", "no_match"]
    assert benign.condition.result is False
    assert later.condition.result is False
    root = matched.condition
    disjunction, command = root.children
    assert (root.operator, root.result, root.field) == ("and", True, None)
    assert (disjunction.operator, disjunction.result) == ("or", True)
    assert [(c.operator, c.field, c.result) for c in disjunction.children] == [
        ("endswith", "process_name", False),
        ("endswith", "process_name", True),
    ]
    assert (command.operator, command.field, command.result) == (
        "contains",
        "command_line",
        True,
    )
    assert [(f.field, f.status) for f in matched.fields] == [
        ("command_line", "present"),
        ("process_name", "present"),
    ]
    assert trace.version_id == (
        "6cd9859b-8f64-46bb-b0f7-aa3b059a605e",
        "36810a087ff6a569c6004178e9aa82207a4d34862495c723edc9764611849c4d",
    )
    assert trace.compiler_contract == rule.compiler_contract
    assert trace.evaluator_contract == rule.evaluator_contract
    assert (
        trace.fixture_sha256
        == "025c8bb93536b73227406c8c74e2f64d8592350b328792147a77f628357beb6d"
    )
    with pytest.raises(FrozenInstanceError):
        command.result = False


@pytest.mark.parametrize(
    ("operator", "literal"),
    [
        ("exact", "pwsh.exe"),
        ("contains", "wsh"),
        ("startswith", "PWSH"),
        ("endswith", ".EXE"),
    ],
)
def test_each_operator_is_recorded(synthetic, rule, operator, literal):
    rule = replace(rule, expression=(operator, "process_name", literal))
    leaf = assert_decision_parity(synthetic, rule).events[0].condition
    assert (leaf.operator, leaf.result, leaf.field, leaf.children) == (
        operator,
        True,
        "process_name",
        (),
    )


@pytest.mark.parametrize(
    ("command", "status", "outcome", "result"),
    [
        ({}, "missing", "indeterminate", None),
        ({"command_line": None}, "null", "indeterminate", None),
        ({"command_line": ""}, "present", "no_match", False),
        ({"command_line": 42}, "invalid", "error", None),
    ],
)
def test_evidence_states_preserve_missing_null_empty_and_invalid(
    synthetic, rule, command, status, outcome, result
):
    fixture = variant(
        synthetic,
        event_type="process_creation",
        source="synthetic",
        process_name="pwsh.exe",
        **command,
    )
    [event] = assert_decision_parity(fixture, rule).events
    assert event.outcome == outcome
    assert event.fields[0].status == status
    if outcome == "error":
        assert event.condition is None
    else:
        assert event.condition.result is result


@pytest.mark.parametrize(
    ("event_type", "source"),
    [("authentication", "synthetic"), ("process_creation", "unknown")],
)
def test_unsupported_events_never_emit_condition_results(
    synthetic, rule, event_type, source
):
    [event] = assert_decision_parity(
        variant(synthetic, event_type=event_type, source=source), rule
    ).events
    assert event.outcome == "unsupported_event"
    assert event.condition is None and event.fields == ()


@pytest.mark.parametrize(
    ("operator", "image", "outcome", "result"),
    [
        ("and", "other.exe", "no_match", False),
        ("and", "pwsh.exe", "indeterminate", None),
        ("or", "pwsh.exe", "match", True),
        ("or", "other.exe", "indeterminate", None),
    ],
)
def test_known_and_unknown_operands_are_all_visible(
    synthetic, rule, operator, image, outcome, result
):
    rule = replace(
        rule,
        expression=(
            operator,
            (
                ("exact", "process_name", "pwsh.exe"),
                ("contains", "command_line", " -enc "),
            ),
        ),
    )
    fixture = variant(
        synthetic, event_type="process_creation", source="synthetic", process_name=image
    )
    [event] = assert_decision_parity(fixture, rule).events
    assert event.outcome == outcome and event.condition.result is result
    assert [node.result for node in event.condition.children] == [
        image == "pwsh.exe",
        None,
    ]


def test_pinned_external_trace_reports_indeterminate_without_ground_truth(rule):
    fixture = verify_sysmon_artifacts(
        EXTERNAL / "ads-abuse.sanitized.xml", EXTERNAL / "replay-v1"
    )
    trace = assert_decision_parity(fixture, rule)
    assert (
        trace.fixture_sha256
        == "4433f943edf9a499d7b7319d94aa62328ab759ab91579d5af5c1ad9884106289"
    )
    assert [e.outcome for e in trace.events] == [
        "no_match",
        "no_match",
        "no_match",
        "indeterminate",
        "indeterminate",
    ]
    assert trace.events[-1].event_id == "362120"
    assert trace.events[-1].condition.children[-1].result is None


def test_trace_is_canonical_redacted_and_cryptographically_bound(synthetic, rule):
    marker = "TEST_ONLY_PRIVATE_VALUE"
    fixture = variant(
        synthetic,
        event_type="process_creation",
        source="synthetic",
        process_name="pwsh.exe",
        command_line=f"pwsh.exe -enc {marker}",
        hostname=marker,
    )
    rule = replace(rule, expression=("contains", "command_line", marker))
    first = trace_sigma_fixture(fixture, rule).canonical_json()
    assert first == trace_sigma_fixture(fixture, rule).canonical_json()
    assert marker.encode() not in first
    assert b"pwsh.exe" not in first
    payload = json.loads(first)
    digest = payload.pop("trace_sha256")
    assert payload["schema_version"] == 1
    assert (
        digest
        == hashlib.sha256(
            json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
        ).hexdigest()
    )
    assert digest != fixture.content_hash
    changed = variant(
        synthetic,
        event_type="process_creation",
        source="synthetic",
        command_line=marker,
    )
    assert first != trace_sigma_fixture(changed, rule).canonical_json()


def test_tampered_rule_and_stale_fixture_digest_are_rejected(synthetic, rule):
    with pytest.raises(SigmaCompatibilityError, match="fixture identity"):
        trace_sigma_fixture(replace(synthetic, fixture_id="stale"), rule)
    object.__setattr__(rule, "expression", ("exact", "process_name", "other.exe"))
    with pytest.raises(SigmaCompatibilityError, match="rule identity"):
        trace_sigma_fixture(synthetic, rule)


def test_trace_rejects_event_ids_that_could_echo_freeform_text(synthetic, rule):
    events = (replace(synthetic.events[0], event_id="private text", ordinal=0),)
    fixture = replace(
        synthetic,
        events=events,
        content_hash=_fixture_content_hash(
            synthetic.schema_version, synthetic.fixture_id, synthetic.provenance, events
        ),
    )
    with pytest.raises(SigmaCompatibilityError, match="bounded event ID"):
        trace_sigma_fixture(fixture, rule)
    assert evaluate_sigma_fixture(fixture, rule).decisions[0].outcome == "match"


def test_compiled_node_and_total_serialized_trace_limits_fail_closed(rule):
    leaf = ("exact", "process_name", "pwsh.exe")
    with pytest.raises(SigmaCompatibilityError, match="expression complexity"):
        replace(rule, expression=("or", (leaf,) * 64))
    rule = replace(rule, expression=("or", (leaf,) * 63))
    fixture = parse_replay_fixture(
        json.dumps(
            {
                "schema_version": 1,
                "fixture_id": "trace-bound",
                "provenance": {"source": "synthetic"},
                "events": [
                    {
                        "event_id": f"e{i}",
                        "event_time": "2026-11-20T12:00:00Z",
                        "fields": {
                            "event_type": "process_creation",
                            "source": "synthetic",
                            "process_name": "pwsh.exe",
                        },
                    }
                    for i in range(MAX_EVENTS)
                ],
            }
        ).encode()
    )
    assert len(evaluate_sigma_fixture(fixture, rule).decisions) == MAX_EVENTS
    with pytest.raises(SigmaCompatibilityError, match="output byte limit"):
        trace_sigma_fixture(fixture, rule)
