from dataclasses import FrozenInstanceError, replace
from pathlib import Path
from unittest.mock import Mock

import pytest

from app.services import replay_evaluator
from app.services.replay_evaluator import UnsupportedRuleError, evaluate_fixture_version
from app.services.replay_fixtures import FixtureError, load_replay_fixture
from app.services.rule_versions import RuleDefinition, RuleVersion


@pytest.fixture
def fixture():
    return load_replay_fixture(Path(__file__).with_name("fixtures") / "encoded_powershell.json")


def test_selected_version_executes_existing_matcher_and_returns_its_identity(fixture, monkeypatch):
    matcher = Mock(wraps=replay_evaluator.matches_encoded_powershell)
    monkeypatch.setattr(replay_evaluator, "matches_encoded_powershell", matcher)
    original = RuleVersion(RuleDefinition())
    selected = RuleVersion(replace(original.definition, title="__import__('os')"))

    result = evaluate_fixture_version(fixture, selected)
    assert result.version_id == selected.version_id != original.version_id
    assert [decision.outcome for decision in result.decisions] == ["match", "no_match", "no_match"]
    assert [call.args for call in matcher.call_args_list] == [
        tuple(event.fields.get(key) for key in ("event_type", "process_name", "command_line"))
        for event in fixture.events
    ]
    assert evaluate_fixture_version(fixture, selected) == result
    assert replay_evaluator.evaluate_fixture(fixture, original.definition.rule_id) == result.decisions
    with pytest.raises(FrozenInstanceError):
        result.version_id = original.version_id


def test_evaluation_failure_cannot_return_a_versioned_result(fixture, monkeypatch):
    matcher = Mock(side_effect=RuntimeError("predicate interrupted"))
    monkeypatch.setattr(replay_evaluator, "matches_encoded_powershell", matcher)
    with pytest.raises(RuntimeError, match="predicate interrupted"):
        evaluate_fixture_version(fixture, RuleVersion(RuleDefinition()))
    matcher.assert_called_once()


@pytest.mark.parametrize(("target", "field", "value"), [
    ("definition", "rule_id", "ENCODED-POWERSHELL"),
    ("definition", "predicate_id", "__import__('os')"),
    ("definition", "definition_schema_version", True),
    ("definition", "definition_schema_version", 2),
    ("definition", "title", ""),
    ("compatibility", "evaluator_contract", "encoded-powershell/v2"),
    ("compatibility", "fixture_schema_version", 2),
])
def test_unsupported_definition_fails_even_with_a_matching_digest(fixture, target, field, value):
    definition = RuleDefinition()
    changed = definition if target == "definition" else definition.compatibility
    # Simulate a caller bypassing normal frozen construction and rehashing the content.
    object.__setattr__(changed, field, value)
    version = RuleVersion(definition)
    with pytest.raises(UnsupportedRuleError, match="Invalid or unsupported replay rule definition"):
        evaluate_fixture_version(replace(fixture, events=None), version)


def test_unrecognized_version_type_and_wrong_content_digest_fail_before_events(fixture):
    unreadable_events = replace(fixture, events=None)
    with pytest.raises(UnsupportedRuleError, match="Expected a RuleVersion"):
        evaluate_fixture_version(unreadable_events, RuleDefinition())
    version = RuleVersion(RuleDefinition())
    object.__setattr__(version, "content_sha256", "0" * 64)
    with pytest.raises(UnsupportedRuleError, match="digest does not match"):
        evaluate_fixture_version(unreadable_events, version)


@pytest.mark.parametrize("schema_version", [True, 1.0, "1", 2])
def test_incompatible_fixture_fails_before_events(fixture, schema_version):
    incompatible = replace(fixture, schema_version=schema_version, events=None)
    with pytest.raises(FixtureError, match="Unsupported fixture schema version"):
        evaluate_fixture_version(incompatible, RuleVersion(RuleDefinition()))
