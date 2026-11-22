"""Run offline replay and emit a stable, versioned evidence manifest.

Run the demo from backend with:
    python -m app.services.replay_harness tests/fixtures/encoded_powershell.json

The manifest uses the fixture loader's JSON and UTC timestamp conventions.
The output digest covers the canonical manifest before output_sha256 is
added. Fixture provenance is retained. Event fields and recorded timestamp
spellings are omitted. An event error marks the run failed and retains its
ordered decisions for diagnosis. Invalid inputs raise without a manifest.

A future version-aware manifest needs a new schema and verifier. Its hash
must cover the identity returned by version-bound evaluation, and verification
must resolve and rerun that exact definition. Keep v1 serialization and
verification available for existing evidence.
"""

import argparse
import hashlib
import json
import sys
from collections.abc import Mapping
from dataclasses import asdict, dataclass, field
from pathlib import Path
from types import MappingProxyType
from typing import Literal

from app.services.replay_evaluator import (
    ENCODED_POWERSHELL_RULE_ID,
    EVALUATOR_CONTRACT,
    EvaluationResult,
    UnsupportedRuleError,
    evaluate_fixture,
)
from app.services.replay_fixtures import MAX_EVENTS, FixtureError, ReplayFixture, load_replay_fixture


MANIFEST_VERSION = 1


def _canonical_json(payload: dict[str, object]) -> bytes:
    return json.dumps(payload, sort_keys=True, ensure_ascii=True, separators=(",", ":")).encode("utf-8")


@dataclass(frozen=True, slots=True)
class ReplayEventResult:
    event_time: str
    decision: EvaluationResult


@dataclass(frozen=True, slots=True)
class ReplayManifest:
    manifest_version: int
    fixture_id: str
    provenance: Mapping[str, str]
    input_sha256: str
    rule_id: str
    evaluator_contract: str
    status: Literal["completed", "failed"]
    event_count: int
    match_count: int
    non_match_count: int
    error_count: int
    results: tuple[ReplayEventResult, ...]
    output_sha256: str = field(init=False)

    def __post_init__(self) -> None:
        object.__setattr__(self, "output_sha256", hashlib.sha256(_canonical_json(self._payload())).hexdigest())

    def _payload(self) -> dict[str, object]:
        return {
            "manifest_version": self.manifest_version,
            "fixture_id": self.fixture_id,
            "provenance": dict(self.provenance),
            "input_sha256": self.input_sha256,
            "rule_id": self.rule_id,
            "evaluator_contract": self.evaluator_contract,
            "status": self.status,
            "event_count": self.event_count,
            "match_count": self.match_count,
            "non_match_count": self.non_match_count,
            "error_count": self.error_count,
            "results": [
                {"event_time": result.event_time, **asdict(result.decision)}
                for result in self.results
            ],
        }

    def canonical_json(self) -> bytes:
        """Return the complete manifest as UTF-8 JSON without a trailing newline."""
        return _canonical_json({**self._payload(), "output_sha256": self.output_sha256})


def run_replay(fixture: ReplayFixture, rule_id: str) -> ReplayManifest:
    """Evaluate a fixture validated and ordered by load_replay_fixture."""
    if type(fixture.schema_version) is not int or fixture.schema_version != 1:
        raise FixtureError("Unsupported fixture schema version.")
    if not 1 <= len(fixture.events) <= MAX_EVENTS:
        raise FixtureError("Replay fixture event count is outside the loader bounds.")

    decisions = evaluate_fixture(fixture, rule_id)
    if len(decisions) != len(fixture.events):
        raise RuntimeError("Evaluator did not produce one decision per event.")

    counts = {"match": 0, "no_match": 0, "error": 0}
    results: list[ReplayEventResult] = []
    for event, decision in zip(fixture.events, decisions, strict=True):
        if (decision.rule_id, decision.source_event_id, decision.ordinal) != (rule_id, event.event_id, event.ordinal):
            raise RuntimeError("Evaluator decision does not refer to the expected rule and event.")
        counts[decision.outcome] += 1
        results.append(ReplayEventResult(
            event.event_time.isoformat(timespec="microseconds").replace("+00:00", "Z"),
            decision,
        ))

    return ReplayManifest(
        manifest_version=MANIFEST_VERSION,
        fixture_id=fixture.fixture_id,
        provenance=MappingProxyType(dict(fixture.provenance)),
        input_sha256=fixture.content_hash,
        rule_id=rule_id,
        evaluator_contract=EVALUATOR_CONTRACT,
        status="failed" if counts["error"] else "completed",
        event_count=len(results),
        match_count=counts["match"],
        non_match_count=counts["no_match"],
        error_count=counts["error"],
        results=tuple(results),
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Replay one local fixture offline.")
    parser.add_argument("fixture", type=Path)
    parser.add_argument("--rule", default=ENCODED_POWERSHELL_RULE_ID)
    args = parser.parse_args(argv)
    try:
        manifest = run_replay(load_replay_fixture(args.fixture), args.rule)
    except (FixtureError, UnsupportedRuleError) as exc:
        print(str(exc), file=sys.stderr)
        return 2
    sys.stdout.buffer.write(manifest.canonical_json())
    return 1 if manifest.status == "failed" else 0


if __name__ == "__main__":
    raise SystemExit(main())
