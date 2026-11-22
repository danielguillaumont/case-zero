"""Run the bundled offline comparison with `python -m app.services.replay_regression_proof`."""

import json
import sys
from dataclasses import asdict
from pathlib import Path

from app.services.replay_grading import GradeTotals, ReplayGrade, grade_replay
from app.services.rule_versions import (
    WEAKENED_EVALUATOR_CONTRACT,
    WEAKENED_PREDICATE_ID,
    RuleCompatibility,
    RuleDefinition,
    RuleVersion,
)

_FIXTURE = (
    Path(__file__).resolve().parents[1] / "replay_assets" / "encoded_powershell.json"
)
_EXPECTATIONS = _FIXTURE.with_suffix(".expectations.json")
CORRECTED = RuleVersion(RuleDefinition())
WEAKENED = RuleVersion(
    RuleDefinition(
        predicate_id=WEAKENED_PREDICATE_ID,
        compatibility=RuleCompatibility(evaluator_contract=WEAKENED_EVALUATOR_CONTRACT),
    )
)


def _summary(name: str, report: ReplayGrade) -> dict[str, object]:
    return {
        "name": name,
        "diagnostic": "PASS" if report.passed else "FAIL",
        "passed": report.passed,
        "executed_version_id": report.executed_version_id,
        "requested_version_id": report.requested_version_id,
        "classifications": {
            grade.expectation_id: grade.classification for grade in report.grades
        },
        "totals": asdict(report.totals),
    }


def main() -> int:
    try:
        weakened = grade_replay(_FIXTURE, _EXPECTATIONS, CORRECTED, WEAKENED)
        corrected = grade_replay(_FIXTURE, _EXPECTATIONS, CORRECTED, CORRECTED)
    except ValueError as exc:
        print(f"Regression proof failed validation: {exc}", file=sys.stderr)
        return 1

    proof_passed = (
        weakened.executed_version_id == WEAKENED.version_id
        and corrected.executed_version_id == CORRECTED.version_id
        and weakened.executed_version_id != corrected.executed_version_id
        and (weakened.fixture_id, weakened.fixture_sha256, weakened.expectations_sha256)
        == (
            corrected.fixture_id,
            corrected.fixture_sha256,
            corrected.expectations_sha256,
        )
        and not weakened.passed
        and corrected.passed
        and weakened.totals == GradeTotals(0, 2, 1, 0, 0, 0)
        and corrected.totals == GradeTotals(1, 2, 0, 0, 0, 0)
    )
    print(
        json.dumps(
            {
                "proof_passed": proof_passed,
                "fixture_id": corrected.fixture_id,
                "fixture_sha256": corrected.fixture_sha256,
                "expectations_sha256": corrected.expectations_sha256,
                "reports": [
                    _summary("weakened", weakened),
                    _summary("corrected", corrected),
                ],
            },
            sort_keys=True,
            separators=(",", ":"),
        )
    )
    if not proof_passed:
        print(
            "Regression proof did not reproduce the expected FAIL/PASS comparison.",
            file=sys.stderr,
        )
    return 0 if proof_passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
