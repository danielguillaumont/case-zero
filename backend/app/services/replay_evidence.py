"""Verify local v1 replay evidence against a separately supplied fixture.

Verification checks consistency with the supported evaluator. It establishes
neither authorship nor authenticity if both files can be replaced.
"""

import hashlib
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from app.services.replay_evaluator import ENCODED_POWERSHELL_RULE_ID
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
    load_replay_fixture,
)
from app.services.replay_harness import EVALUATOR_CONTRACT, MANIFEST_VERSION, _canonical_json, run_replay


# ASCII escaping can expand fixture strings. Allow six bytes per input byte
# plus room for the fixed per-event and manifest metadata.
MAX_MANIFEST_BYTES = 6 * MAX_FILE_BYTES + 512 * MAX_EVENTS + 4096
_MANIFEST_KEYS = frozenset({
    "manifest_version", "fixture_id", "provenance", "input_sha256", "rule_id",
    "evaluator_contract", "status", "event_count", "match_count", "non_match_count",
    "error_count", "results", "output_sha256",
})
_RESULT_KEYS = frozenset({"source_event_id", "ordinal", "event_time", "rule_id", "outcome", "error"})
_SHA256 = re.compile(r"[0-9a-f]{64}")


@dataclass(frozen=True, slots=True)
class VerificationResult:
    status: Literal["verified", "mismatch", "invalid"]
    reason: str | None = None


def _validate_manifest(raw: object) -> dict[str, object]:
    manifest = _object(raw, "Manifest", _MANIFEST_KEYS)
    _string(manifest["fixture_id"], "fixture_id", nonempty=True)
    provenance = _object(manifest["provenance"], "provenance", frozenset({"source"}), frozenset({"description"}))
    for key, value in provenance.items():
        _string(value, "provenance", nonempty=key == "source")
    for key in ("input_sha256", "output_sha256"):
        if not _SHA256.fullmatch(_string(manifest[key], key)):
            raise FixtureError("Invalid SHA-256 digest.")
    if type(manifest["manifest_version"]) is not int:
        raise FixtureError("Invalid manifest version type.")
    for key in ("rule_id", "evaluator_contract"):
        _string(manifest[key], key, nonempty=True)
    if manifest["status"] not in ("completed", "failed"):
        raise FixtureError("Invalid manifest status.")
    for key in ("event_count", "match_count", "non_match_count", "error_count"):
        count = manifest[key]
        minimum = 1 if key == "event_count" else 0
        if type(count) is not int or not minimum <= count <= MAX_EVENTS:
            raise FixtureError("Invalid manifest count.")

    results = manifest["results"]
    if not isinstance(results, list) or not 1 <= len(results) <= MAX_EVENTS:
        raise FixtureError("Invalid manifest results.")
    ids: set[str] = set()
    ordinals: set[int] = set()
    for item in results:
        result = _object(item, "Result", _RESULT_KEYS)
        event_id = _string(result["source_event_id"], "source_event_id", nonempty=True)
        ordinal = result["ordinal"]
        if type(ordinal) is not int or not 0 <= ordinal < MAX_EVENTS or ordinal in ordinals or event_id in ids:
            raise FixtureError("Invalid or duplicate event reference.")
        ids.add(event_id)
        ordinals.add(ordinal)
        timestamp = _string(result["event_time"], "event_time")
        normalized = _utc_timestamp(timestamp, "event_time").isoformat(timespec="microseconds").replace("+00:00", "Z")
        if normalized != timestamp:
            raise FixtureError("Result timestamp is not canonical.")
        _string(result["rule_id"], "rule_id", nonempty=True)
        if result["outcome"] == "error":
            error = _object(result["error"], "Error", frozenset({"code", "field"}))
            if error["code"] not in ("missing_field", "invalid_field") or error["field"] not in (
                "event_type", "process_name", "command_line",
            ):
                raise FixtureError("Invalid evaluation error.")
        elif result["outcome"] not in ("match", "no_match") or result["error"] is not None:
            raise FixtureError("Invalid evaluation outcome.")
    return manifest


def verify_replay_evidence(manifest_path: Path, fixture_path: Path, rule_id: str) -> VerificationResult:
    """Check saved UTF-8 JSON and reproduce it from an independent local fixture."""
    if rule_id != ENCODED_POWERSHELL_RULE_ID:
        return VerificationResult("invalid", "unsupported_rule")
    try:
        if manifest_path.as_posix().startswith("//"):
            return VerificationResult("invalid", "manifest_unreadable")
        path = manifest_path.resolve(strict=True)
        if path.as_posix().startswith("//") or not path.is_file():
            return VerificationResult("invalid", "manifest_unreadable")
        with path.open("rb") as stream:
            data = stream.read(MAX_MANIFEST_BYTES + 1)
    except (OSError, RuntimeError, ValueError):
        return VerificationResult("invalid", "manifest_unreadable")
    if len(data) > MAX_MANIFEST_BYTES:
        return VerificationResult("invalid", "manifest_too_large")
    try:
        text = data.decode("utf-8")
        _check_depth(text)
        manifest = _validate_manifest(json.loads(text, object_pairs_hook=_unique_keys, parse_constant=_reject_constant))
    except (ValueError, RecursionError):
        return VerificationResult("invalid", "invalid_manifest")

    if manifest["manifest_version"] != MANIFEST_VERSION:
        return VerificationResult("invalid", "unsupported_manifest_version")
    if manifest["evaluator_contract"] != EVALUATOR_CONTRACT:
        return VerificationResult("invalid", "unsupported_evaluator_contract")
    if manifest["rule_id"] != rule_id:
        return VerificationResult("invalid", "unsupported_rule")

    payload = {key: value for key, value in manifest.items() if key != "output_sha256"}
    if hashlib.sha256(_canonical_json(payload)).hexdigest() != manifest["output_sha256"]:
        return VerificationResult("mismatch", "output_hash_mismatch")
    try:
        fixture = load_replay_fixture(fixture_path)
    except FixtureError:
        return VerificationResult("invalid", "invalid_fixture")
    if fixture.content_hash != manifest["input_sha256"]:
        return VerificationResult("mismatch", "input_hash_mismatch")

    reproduced = run_replay(fixture, rule_id)
    if reproduced.canonical_json() != _canonical_json(manifest):
        return VerificationResult("mismatch", "replay_mismatch")
    return VerificationResult("verified")
