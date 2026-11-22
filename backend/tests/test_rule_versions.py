import hashlib
import json
import subprocess
import sys
from dataclasses import FrozenInstanceError, replace
from pathlib import Path

import pytest

from app.services.replay_evaluator import ENCODED_POWERSHELL_RULE_ID
from app.services.replay_fixtures import load_replay_fixture
from app.services.replay_harness import EVALUATOR_CONTRACT
from app.services.rule_versions import RuleCompatibility, RuleDefinition, RuleVersion


def test_canonical_definition_and_version_identity():
    first = RuleVersion(RuleDefinition())
    second = RuleVersion(RuleDefinition())
    canonical = (
        b'{"compatibility":{"evaluator_contract":"encoded-powershell/v1","fixture_schema_version":1},'
        b'"definition_schema_version":1,"predicate_id":"encoded-powershell-switch/v1",'
        b'"rule_id":"encoded-powershell","title":"Encoded PowerShell"}'
    )
    assert first.definition.canonical_json() == canonical
    assert first.content_sha256 == second.content_sha256 == hashlib.sha256(canonical).hexdigest()
    assert first.version_id == (ENCODED_POWERSHELL_RULE_ID, first.content_sha256)
    assert first.definition.compatibility.evaluator_contract == EVALUATOR_CONTRACT
    fixture = load_replay_fixture(Path(__file__).with_name("fixtures") / "encoded_powershell.json")
    assert first.definition.compatibility.fixture_schema_version == fixture.schema_version


def test_content_identity_ignores_json_presentation_and_includes_title():
    original = RuleVersion(RuleDefinition(title="Détection PowerShell"))
    payload = json.loads(original.definition.canonical_json())
    reordered = dict(reversed(list(payload.items())))
    presentation = json.dumps(reordered, indent=2, ensure_ascii=False)
    fields = json.loads(presentation)
    fields["compatibility"] = RuleCompatibility(**fields["compatibility"])
    assert RuleVersion(RuleDefinition(**fields)).version_id == original.version_id

    renamed = RuleVersion(replace(original.definition, title="Encoded PowerShell"))
    assert renamed.definition.rule_id == original.definition.rule_id
    assert renamed.content_sha256 != original.content_sha256
    assert renamed.version_id != original.version_id


def test_version_and_nested_definition_are_frozen():
    version = RuleVersion(RuleDefinition())
    with pytest.raises(FrozenInstanceError):
        version.content_sha256 = "0" * 64
    with pytest.raises(FrozenInstanceError):
        version.definition.title = "Changed"
    with pytest.raises(FrozenInstanceError):
        version.definition.compatibility.fixture_schema_version = 2
    exported = json.loads(version.definition.canonical_json())
    exported["compatibility"]["fixture_schema_version"] = 2
    assert version.definition.compatibility.fixture_schema_version == 1
    assert version.content_sha256 == hashlib.sha256(version.definition.canonical_json()).hexdigest()


@pytest.mark.parametrize(("factory", "fields", "message"), [
    (RuleDefinition, {"rule_id": "other"}, "Unsupported rule_id"),
    (RuleDefinition, {"predicate_id": "encoded-powershell-switch/v2"}, "Unsupported predicate_id"),
    (RuleDefinition, {"predicate_id": "__import__('os')"}, "Unsupported predicate_id"),
    (RuleDefinition, {"title": ""}, "title must"),
    (RuleDefinition, {"title": " padded"}, "title must"),
    (RuleDefinition, {"title": "x" * 121}, "title must"),
    (RuleDefinition, {"title": "\ncontrol"}, "title must"),
    (RuleDefinition, {"title": []}, "title must"),
    (RuleDefinition, {"compatibility": {}}, "compatibility must"),
    (RuleDefinition, {"definition_schema_version": True}, "must be an integer"),
    (RuleDefinition, {"definition_schema_version": 2}, "Unsupported definition schema version"),
    (RuleCompatibility, {"evaluator_contract": None}, "must be a string"),
    (RuleCompatibility, {"evaluator_contract": "encoded-powershell/v2"}, "Unsupported evaluator contract"),
    (RuleCompatibility, {"fixture_schema_version": 1.0}, "must be an integer"),
    (RuleCompatibility, {"fixture_schema_version": 2}, "Unsupported fixture schema version"),
    (RuleVersion, {"definition": {}}, "definition must"),
])
def test_invalid_definitions_and_unsupported_versions_fail_explicitly(factory, fields, message):
    with pytest.raises(ValueError, match=message):
        factory(**fields)


def test_canonical_digest_is_stable_in_fresh_processes_and_text_stays_inert():
    title = "__import__('os').system('echo inert')"
    program = """
import sys
sys.path.insert(0, sys.argv[1])
from app.services.rule_versions import RuleDefinition, RuleVersion

def reject_side_effects(event, args):
    if event in {"compile", "exec", "open"} or event.startswith(("os.", "socket.", "subprocess.")):
        raise AssertionError(event)

sys.addaudithook(reject_side_effects)
print(RuleVersion(RuleDefinition(title=sys.argv[2])).content_sha256)
"""
    backend = Path(__file__).resolve().parents[1]
    command = [sys.executable, "-I", "-B", "-c", program, str(backend), title]
    expected = RuleVersion(RuleDefinition(title=title)).content_sha256
    for _ in range(2):
        result = subprocess.run(command, capture_output=True, text=True, timeout=15, check=True)
        assert result.stdout == expected + "\n"
        assert result.stderr == ""
