import hashlib
import json
from dataclasses import FrozenInstanceError, replace
from pathlib import Path

import pytest

from app.services.replay_evaluator import evaluate_fixture_version
from app.services.replay_expectations import ExpectationError, load_replay_expectations
from app.services.replay_fixtures import MAX_FILE_BYTES, load_replay_fixture
from app.services.rule_versions import RuleDefinition, RuleVersion


BUNDLE = Path(__file__).resolve().parents[1] / "app" / "replay_assets" / "encoded_powershell.json"
ASSET = BUNDLE.with_suffix(".expectations.json")
AUTHORING_VERSION = RuleVersion(RuleDefinition())
EXPECTATIONS = load_replay_expectations(ASSET, load_replay_fixture(BUNDLE), AUTHORING_VERSION)
POSITIVE, NEGATIVE, _ = EXPECTATIONS.expectations


def test_bundled_labels_target_the_expected_events_and_current_rule():
    fixture = load_replay_fixture(BUNDLE)
    version = RuleVersion(RuleDefinition())
    EXPECTATIONS.validate_target(fixture, version.definition.rule_id)
    assert {
        label.expectation_id: (label.event_id, label.expected_outcome)
        for label in EXPECTATIONS.expectations
    } == {
        "encoded-switch": ("encoded", "match"),
        "benign-get-date": ("benign-tie", "no_match"),
        "benign-get-service": ("benign-later", "no_match"),
    }
    result = evaluate_fixture_version(fixture, version)
    assert {item.source_event_id: item.outcome for item in result.decisions} == {
        label.event_id: label.expected_outcome for label in EXPECTATIONS.expectations
    }


def test_target_validation_rejects_stale_content_and_exact_id_mismatches(tmp_path):
    fixture = load_replay_fixture(BUNDLE)
    with pytest.raises(ExpectationError, match="different rule ID"):
        EXPECTATIONS.validate_target(fixture, "ENCODED-POWERSHELL")
    with pytest.raises(ExpectationError, match="different fixture revision"):
        EXPECTATIONS.validate_target(replace(fixture, fixture_id="other"), EXPECTATIONS.rule_id)

    data = json.loads(BUNDLE.read_bytes())
    data["provenance"]["description"] = "Updated fixture"
    changed = tmp_path / BUNDLE.name
    changed.write_text(json.dumps(data), encoding="utf-8")
    changed_fixture = load_replay_fixture(changed)
    with pytest.raises(ExpectationError, match="different fixture revision"):
        EXPECTATIONS.validate_target(changed_fixture, EXPECTATIONS.rule_id)
    with pytest.raises(ExpectationError, match="different fixture revision"):
        load_replay_expectations(ASSET, changed_fixture, AUTHORING_VERSION)


def test_partial_ground_truth_is_valid_but_unknown_event_ids_are_rejected():
    fixture = load_replay_fixture(BUNDLE)
    partial = replace(EXPECTATIONS, expectations=(POSITIVE,))
    partial.validate_target(fixture, EXPECTATIONS.rule_id)
    unknown = replace(partial, expectations=(replace(POSITIVE, event_id="Encoded"),))
    with pytest.raises(ExpectationError, match="unknown event ID"):
        unknown.validate_target(fixture, EXPECTATIONS.rule_id)


def test_set_and_nested_labels_are_immutable():
    with pytest.raises(FrozenInstanceError):
        EXPECTATIONS.expectations = ()
    with pytest.raises(FrozenInstanceError):
        POSITIVE.expected_outcome = "no_match"


@pytest.mark.parametrize(("fields", "message"), [
    ({"expectation_id": "Invalid ID"}, "expectation_id"),
    ({"event_id": " "}, "event_id"),
    ({"expected_outcome": "error"}, "expected_outcome"),
    ({"source": None}, "source"),
    ({"rationale": "x" * 4097}, "rationale"),
    ({"rationale": "\ud800"}, "valid Unicode"),
])
def test_invalid_labels_fail_explicitly(fields, message):
    with pytest.raises(ExpectationError, match=message):
        replace(POSITIVE, **fields)


@pytest.mark.parametrize(("fields", "message"), [
    ({"fixture_id": ""}, "fixture_id"),
    ({"fixture_sha256": "0" * 63}, "fixture_sha256"),
    ({"rule_id": ""}, "rule_id"),
    ({"expectations": ()}, "nonempty tuple"),
    ({"expectations": [POSITIVE]}, "nonempty tuple"),
    ({"expectations": ({},)}, "DetectionExpectation"),
    ({"expectations": (POSITIVE, replace(NEGATIVE, expectation_id=POSITIVE.expectation_id))}, "Duplicate"),
    ({"expectations": (POSITIVE, replace(NEGATIVE, event_id=POSITIVE.event_id))}, "same event"),
])
def test_invalid_sets_fail_explicitly(fields, message):
    with pytest.raises(ExpectationError, match=message):
        replace(EXPECTATIONS, **fields)


def test_authoring_version_is_exact_but_applicability_allows_an_alternate_version():
    fixture = load_replay_fixture(BUNDLE)
    alternate = RuleVersion(replace(AUTHORING_VERSION.definition, title="Alternate PowerShell rule"))
    assert EXPECTATIONS.authoring_version_id == AUTHORING_VERSION.version_id
    assert EXPECTATIONS.authoring_version_id != alternate.version_id
    EXPECTATIONS.validate_target(fixture, alternate.definition.rule_id)
    with pytest.raises(ExpectationError, match="Authoring rule version"):
        load_replay_expectations(ASSET, fixture, alternate)
    object.__setattr__(alternate, "content_sha256", AUTHORING_VERSION.content_sha256)
    with pytest.raises(ExpectationError, match="Authoring rule version"):
        load_replay_expectations(ASSET, fixture, alternate)


def test_canonical_bytes_and_digest_are_independent_of_json_presentation(tmp_path):
    source = json.loads(ASSET.read_bytes())
    source["expectations"].sort(key=lambda label: label["expectation_id"])
    canonical = json.dumps(source, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode()
    assert EXPECTATIONS.canonical_json() == canonical
    assert EXPECTATIONS.content_sha256 == hashlib.sha256(canonical).hexdigest()

    source["expectations"].reverse()
    alternate_path = tmp_path / ASSET.name
    alternate_path.write_text(json.dumps(source, indent=4), encoding="utf-8")
    alternate = load_replay_expectations(alternate_path, load_replay_fixture(BUNDLE), AUTHORING_VERSION)
    assert alternate.canonical_json() == canonical
    assert alternate.content_sha256 == EXPECTATIONS.content_sha256

    changed = replace(EXPECTATIONS, expectations=(replace(POSITIVE, name="New name"), *EXPECTATIONS.expectations[1:]))
    assert changed.content_sha256 != EXPECTATIONS.content_sha256


@pytest.mark.parametrize(("document", "message"), [
    (b"{", "Malformed"),
    (b"\xff", "invalid UTF-8"),
    (b'{"schema_version":1,"schema_version":1}', "Duplicate JSON"),
    (b'{"expectations":[{"name":"a","name":"b"}]}', "Duplicate JSON"),
    (b'{"schema_version":NaN}', "non-finite"),
    (b'{"schema_version":1}', "missing required fields"),
    (b"[" * 9 + b"]" * 9, "nesting depth"),
    (b" " * (MAX_FILE_BYTES + 1), "maximum size"),
], ids=["malformed", "utf8", "duplicate-root", "duplicate-label", "nonfinite", "missing-field", "depth", "size"])
def test_invalid_documents_are_rejected(tmp_path, document, message):
    path = tmp_path / ASSET.name
    path.write_bytes(document)
    with pytest.raises(ExpectationError, match=message):
        load_replay_expectations(path, load_replay_fixture(BUNDLE), AUTHORING_VERSION)


def test_missing_and_nonregular_documents_are_rejected(tmp_path):
    fixture = load_replay_fixture(BUNDLE)
    for path in (tmp_path / "missing.json", tmp_path):
        with pytest.raises(ExpectationError):
            load_replay_expectations(path, fixture, AUTHORING_VERSION)


@pytest.mark.parametrize(("target", "updates", "message"), [
    ("root", {"schema_version": 2}, "Unsupported expectation schema"),
    ("root", {"schema_version": True}, "Unsupported expectation schema"),
    ("root", {"extra": "field"}, "unsupported fields"),
    ("root", {"fixture_id": "other"}, "different fixture revision"),
    ("root", {"fixture_sha256": "0" * 64}, "different fixture revision"),
    ("root", {"authoring_version_id": ["other", "0" * 64]}, "authoring_version_id"),
    ("root", {"authoring_version_id": ["encoded-powershell", "0" * 64]}, "Authoring rule version"),
    ("label", {"extra": "field"}, "unsupported fields"),
    ("label", {"name": ""}, "name"),
    ("label", {"event_id": "missing"}, "unknown event ID"),
    ("label", {"expectation_id": "benign-get-date"}, "Duplicate expectation ID"),
    ("label", {"polarity": "negative"}, "polarity contradicts"),
])
def test_asset_schema_rejects_invalid_fields(tmp_path, target, updates, message):
    payload = json.loads(ASSET.read_bytes())
    (payload if target == "root" else payload["expectations"][0]).update(updates)
    path = tmp_path / ASSET.name
    path.write_text(json.dumps(payload), encoding="utf-8")
    with pytest.raises(ExpectationError, match=message):
        load_replay_expectations(path, load_replay_fixture(BUNDLE), AUTHORING_VERSION)
