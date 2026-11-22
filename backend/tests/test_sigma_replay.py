import hashlib
from dataclasses import FrozenInstanceError, replace
from pathlib import Path
from types import MappingProxyType

import pytest
import yaml

from app.services.replay_fixtures import load_replay_fixture
from app.services.sigma_replay import (
    MAX_RULE_BYTES,
    SigmaCompatibilityError,
    SigmaFieldIssue,
    compile_sigma_rule,
    evaluate_sigma_fixture,
    load_sigma_rule,
)
from app.services.sysmon_replay_fixture import verify_sysmon_artifacts

FIXTURES = Path(__file__).with_name("fixtures")
RULE_FILE = FIXTURES / "sigma-encoded-powershell.yml"
SYNTHETIC = (
    Path(__file__).resolve().parents[1] / "app/replay_assets/encoded_powershell.json"
)
EXTERNAL = FIXTURES / "external/splunk-ads-abuse"


def rule_document():
    return yaml.safe_load(RULE_FILE.read_bytes())


def compile_document(document):
    return compile_sigma_rule(yaml.safe_dump(document).encode("utf-8"))


def rule_with(detection):
    document = rule_document()
    document["detection"] = detection
    return compile_document(document)


def outcomes(result):
    return [decision.outcome for decision in result.decisions]


def test_real_and_or_evaluation_of_synthetic_replay_is_repeatable():
    fixture = load_replay_fixture(SYNTHETIC)
    rule = load_sigma_rule(RULE_FILE)
    result = evaluate_sigma_fixture(fixture, rule)
    assert result == evaluate_sigma_fixture(fixture, rule)
    assert result.version_id == rule.version_id
    assert result.fixture_sha256 == fixture.content_hash
    assert (
        result.rule_source_sha256 == hashlib.sha256(RULE_FILE.read_bytes()).hexdigest()
    )
    assert result.compiler_contract == rule.compiler_contract
    assert result.evaluator_contract == rule.evaluator_contract
    assert [(d.event_id, d.ordinal) for d in result.decisions] == [
        ("encoded", 1),
        ("benign-tie", 2),
        ("benign-later", 0),
    ]
    assert outcomes(result) == ["match", "no_match", "no_match"]


def test_verified_external_events_support_image_and_computer_but_keep_null_commands_visible():
    fixture = verify_sysmon_artifacts(
        EXTERNAL / "ads-abuse.sanitized.xml", EXTERNAL / "replay-v1"
    )
    result = evaluate_sigma_fixture(fixture, load_sigma_rule(RULE_FILE))
    assert outcomes(result) == [
        "no_match",
        "no_match",
        "no_match",
        "indeterminate",
        "indeterminate",
    ]
    assert all(
        d.issues == (SigmaFieldIssue("command_line", "null"),) for d in result.decisions
    )
    image_and_host = rule_with(
        {
            "selection": {"Image": "PoWeRsHeLl.ExE", "Computer|startswith": "SPLUNK-"},
            "condition": "selection",
        }
    )
    assert outcomes(evaluate_sigma_fixture(fixture, image_and_host)) == [
        "no_match",
        "no_match",
        "no_match",
        "match",
        "match",
    ]


@pytest.mark.parametrize(
    ("key", "value", "expected"),
    [
        ("Image", "PWSH.EXE", "match"),
        ("Image", "pwsh", "no_match"),
        ("Image|startswith", "PWSH", "match"),
        ("Image|endswith", ".EXE", "match"),
        ("CommandLine|contains", " -ENC ", "match"),
        ("CommandLine|contains", " -encX ", "no_match"),
    ],
)
def test_literal_operators_use_casefolding(key, value, expected):
    fixture = load_replay_fixture(SYNTHETIC)
    rule = rule_with({"s": {key: value}, "condition": "s"})
    assert evaluate_sigma_fixture(fixture, rule).decisions[0].outcome == expected


@pytest.mark.parametrize(
    ("value", "expected", "issues"),
    [
        (None, "indeterminate", (SigmaFieldIssue("command_line", "null"),)),
        ("", "no_match", ()),
        (25, "error", (SigmaFieldIssue("command_line", "invalid"),)),
    ],
)
def test_null_empty_and_invalid_fields_are_distinct(value, expected, issues):
    fixture = load_replay_fixture(SYNTHETIC)
    event = fixture.events[0]
    event = replace(
        event, fields=MappingProxyType({**event.fields, "command_line": value})
    )
    rule = load_sigma_rule(RULE_FILE)
    (decision,) = evaluate_sigma_fixture(
        replace(fixture, events=(event,)), rule
    ).decisions
    assert (decision.outcome, decision.issues) == (expected, issues)


def test_missing_evidence_does_not_override_a_decisive_or_and_unsupported_event_is_explicit():
    fixture = load_replay_fixture(SYNTHETIC)
    event = replace(
        fixture.events[0],
        fields=MappingProxyType(
            {
                "source": "synthetic",
                "event_type": "process_creation",
                "process_name": "pwsh.exe",
            }
        ),
    )
    other = replace(
        fixture.events[1],
        fields=MappingProxyType(
            {"source": "synthetic", "event_type": "network_connection"}
        ),
    )
    unrelated = replace(
        fixture.events[2],
        fields=MappingProxyType(
            {
                **fixture.events[2].fields,
                "source": "other",
            }
        ),
    )
    rule = rule_with(
        {"i": {"Image": "pwsh.exe"}, "c": {"CommandLine": "x"}, "condition": "i or c"}
    )
    result = evaluate_sigma_fixture(
        replace(fixture, events=(event, other, unrelated)), rule
    )
    assert outcomes(result) == ["match", "unsupported_event", "unsupported_event"]
    assert result.decisions[0].issues == (SigmaFieldIssue("command_line", "missing"),)


def test_source_digest_and_compiled_identity_are_distinct_and_rule_is_immutable():
    rule = load_sigma_rule(RULE_FILE)
    equivalent = compile_document(rule_document())
    assert rule.version_id == equivalent.version_id
    assert rule.source_sha256 != equivalent.source_sha256
    changed = rule_document()
    changed["detection"]["encoded"]["CommandLine|contains"] = " -encodedcommand "
    assert compile_document(changed).version_id != rule.version_id
    with pytest.raises(FrozenInstanceError):
        rule.expression = ()
    with pytest.raises(TypeError):
        rule.expression[1][0] = ()


@pytest.mark.parametrize(
    "field",
    [
        "compiler_contract",
        "evaluator_contract",
        "content_sha256",
        "rule_id",
        "expression",
    ],
)
def test_unsupported_or_tampered_compiled_rules_never_execute(field):
    rule = load_sigma_rule(RULE_FILE)
    object.__setattr__(rule, field, "tampered")
    with pytest.raises(SigmaCompatibilityError):
        evaluate_sigma_fixture(load_replay_fixture(SYNTHETIC), rule)


def test_local_rule_loader_rejects_nonlocal_and_nonregular_paths(tmp_path):
    for path in (
        tmp_path,
        tmp_path / "missing.yml",
        Path("//sigma.invalid/share/rule.yml"),
    ):
        with pytest.raises(SigmaCompatibilityError, match="local"):
            load_sigma_rule(path)
    oversized = tmp_path / "big.yml"
    oversized.write_bytes(b"a" * (MAX_RULE_BYTES + 1))
    with pytest.raises(SigmaCompatibilityError, match="16384 bytes"):
        load_sigma_rule(oversized)


def test_compiled_expression_depth_is_checked_before_hashing_or_evaluation():
    rule = load_sigma_rule(RULE_FILE)
    expression = ("exact", "process_name", "x")
    for _ in range(8):
        expression = ("or", (expression, ("exact", "process_name", "y")))
    with pytest.raises(SigmaCompatibilityError, match="expression complexity"):
        replace(rule, expression=expression)


@pytest.mark.parametrize(
    ("data", "message"),
    [
        (b"title: [", "well-formed"),
        (b"\xff", "UTF-8"),
        (b"---\na: 1\n---\nb: 2", "exactly one"),
        (b"title: first\ntitle: second", "Duplicate YAML key"),
        (b"detection:\n  s:\n    Image: a\n    Image: b", "Duplicate YAML key"),
        (b"a: &anchor x\nb: *anchor", "aliases, anchors"),
        (b"a: !!str 1", "explicit tags"),
        (b"<<: {x: y}", "Merge keys"),
        (b"[x, y]", "Require title"),
        (b"x: " + b"[" * 10 + b"0" + b"]" * 10, "nesting limit"),
        (b"x: [" + b"0, " * 130 + b"0]", "node or nesting limit"),
        (b" " * (MAX_RULE_BYTES + 1), "16384 bytes"),
    ],
    ids=[
        "malformed",
        "utf8",
        "multi",
        "duplicate-root",
        "duplicate-nested",
        "anchor",
        "tag",
        "merge",
        "sequence",
        "depth",
        "nodes",
        "bytes",
    ],
)
def test_yaml_limits_and_ambiguities_fail_closed(data, message):
    with pytest.raises(SigmaCompatibilityError, match=message):
        compile_sigma_rule(data)


def test_invalid_implicit_yaml_scalar_is_reported_as_a_compatibility_error():
    with pytest.raises(SigmaCompatibilityError, match="well-formed"):
        compile_sigma_rule(b"title: 2026-02-31")


@pytest.mark.parametrize(
    ("condition", "message"),
    [
        ("not s", "Unsupported condition"),
        ("1 of s", "Unsupported condition"),
        ("all of them", "Unsupported condition"),
        ("s | count()", "single condition"),
        ("s or missing", "undefined selection"),
        ("s and", "pySigma rejected"),
        ("(((((s)))))", "deeply nested"),
        (" or ".join(["s"] * 17), "token limit"),
        (["s", "t"], "single condition"),
    ],
)
def test_condition_allowlist_is_enforced(condition, message):
    with pytest.raises(SigmaCompatibilityError, match=message):
        rule_with({"s": {"Image": "x"}, "condition": condition})


@pytest.mark.parametrize(
    ("detection", "message"),
    [
        ({"s": {"Image|re": "x"}, "condition": "s"}, "Unsupported modifier"),
        ({"s": {"Image|contains|all": "x"}, "condition": "s"}, "Unsupported modifier"),
        (
            {"s": {"Image": "x", "Image|contains": "y"}, "condition": "s"},
            "cannot repeat",
        ),
        ({"s": {"User": "x"}, "condition": "s"}, "Unsupported Sigma field"),
        ({"s": {"Image": ["x", "y"]}, "condition": "s"}, "printable string"),
        ({"s": {"Image": True}, "condition": "s"}, "printable string"),
        ({"s": {"Image": "x*"}, "condition": "s"}, "Wildcards"),
        ({"s": {"Image": "%placeholder%"}, "condition": "s"}, "placeholders"),
        ({"s": {"Image": "x" * 257}, "condition": "s"}, "256 characters"),
        (
            {"s": {"Image": "x"}, "unused": {"Image": "y"}, "condition": "s"},
            "unreferenced",
        ),
        (
            {**{f"s{i}": {"Image": "x"} for i in range(9)}, "condition": "s0"},
            "named selections",
        ),
        (
            {
                "s": {
                    "Image": "x",
                    "Image|endswith": "x",
                    "Computer": "x",
                    "CommandLine": "x",
                },
                "condition": "s",
            },
            "distinct fields",
        ),
    ],
)
def test_selection_shape_and_bounds_fail_closed(detection, message):
    with pytest.raises(SigmaCompatibilityError, match=message):
        rule_with(detection)


@pytest.mark.parametrize(
    ("changes", "message"),
    [
        ({"id": "not-uuid"}, "canonical lowercase UUIDv4"),
        (
            {"logsource": {"product": "windows", "category": "process_creation"}},
            "windows/sysmon/process_creation",
        ),
        (
            {
                "logsource": {
                    "product": "windows",
                    "service": "sysmon",
                    "category": "network_connection",
                }
            },
            "windows/sysmon/process_creation",
        ),
        ({"correlation": {"type": "event_count"}}, "Only description and author"),
    ],
)
def test_metadata_and_logsource_are_explicit(changes, message):
    with pytest.raises(SigmaCompatibilityError, match=message):
        compile_document({**rule_document(), **changes})
