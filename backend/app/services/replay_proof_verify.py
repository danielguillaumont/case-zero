"""Verify a local synthetic detection proof without modifying its artifacts."""

import argparse
import hashlib
import json
import os
import stat
import sys
from pathlib import Path

from app.schemas.comparison_preview import ComparisonPreviewResponse
from app.services.replay_comparison import compare_replay_summaries
from app.services.replay_expectations import load_replay_expectations
from app.services.replay_fixtures import (
    _check_depth,
    _reject_constant,
    _unique_keys,
    load_replay_fixture,
)
from app.services.replay_grading import (
    GradeTotals,
    _CLASSIFICATIONS,
    grade_loaded_replay,
)
from app.services.replay_proof_export import (
    EXPORT_SCHEMA_VERSION,
    MAX_ARTIFACT_BYTES,
    _COMPARISON_BYTES_SHA256,
    _EXPECTATIONS,
    _EXPECTATIONS_SHA256,
    _FIXTURE,
    _FIXTURE_SHA256,
    _LIMITATIONS,
    _canonical,
    _markdown,
)
from app.services.replay_regression_proof import CORRECTED, WEAKENED
from app.services.replay_summary import (
    ExpectationReference,
    LabeledSatisfaction,
    ReplaySummary,
    summarize_replay_grade,
)
from app.services.sysmon_replay_fixture import (
    _artifact_path,
    _check_directory,
    _is_link,
)

_REPORT_FIELDS = {
    "schema_version",
    "comparison",
    "evaluator_contracts",
    "limitations",
    "proof_sha256",
}
_OBSERVED_OUTCOMES = {
    result[0]: observed for (_, observed), result in _CLASSIFICATIONS.items()
}
_OBSERVED_OUTCOMES.update(evaluation_error="error", unsupported=None)


class ProofVerificationError(ValueError):
    """Verification stopped at a fixed, safe diagnostic category."""


def _read_artifact(path: Path) -> bytes:
    info = path.lstat()
    if _is_link(info) or not stat.S_ISREG(info.st_mode):
        raise ValueError("Expected a regular file.")
    if not 0 < info.st_size <= MAX_ARTIFACT_BYTES:
        raise ValueError("Invalid artifact size.")
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_NONBLOCK", 0)
    flags |= getattr(os, "O_BINARY", 0)
    with os.fdopen(os.open(path, flags), "rb") as stream:
        opened = os.fstat(stream.fileno())
        if not stat.S_ISREG(opened.st_mode) or not os.path.samestat(info, opened):
            raise ValueError("Artifact changed while opening.")
        data = stream.read(MAX_ARTIFACT_BYTES + 1)
    if not 0 < len(data) <= MAX_ARTIFACT_BYTES:
        raise ValueError("Invalid artifact size.")
    return data


def _comparison_input(model: ComparisonPreviewResponse, side: str) -> ReplaySummary:
    """Project the artifact into the existing comparison validator's inputs."""
    run = getattr(model, side)
    totals = GradeTotals(**run.totals.model_dump())
    satisfaction = run.labeled_satisfaction
    references = []
    for row in model.expectations:
        classification = getattr(row, f"{side}_classification")
        references.append(
            ExpectationReference(
                row.expectation_id,
                row.event_id,
                row.expected_outcome,
                _OBSERVED_OUTCOMES[classification],
                classification,
            )
        )
    return ReplaySummary(
        fixture_id=model.fixture_id,
        fixture_sha256=model.fixture_sha256,
        expectations_sha256=model.expectations_sha256,
        grade_sha256=run.grade_sha256,
        authoring_version_id=model.authoring_version_id,
        requested_version_id=run.requested_version_id,
        executed_version_id=run.executed_version_id,
        total_events=model.total_events,
        labeled_events=model.labeled_events,
        unlabeled_events=model.unlabeled_events,
        decisive_labeled_events=model.labeled_events
        - totals.evaluation_error
        - totals.unsupported,
        totals=totals,
        passed=run.passed,
        labeled_satisfaction=(
            LabeledSatisfaction(**satisfaction.model_dump()) if satisfaction else None
        ),
        diagnostics=(),
        expectations=tuple(references),
    )


def _validate_report(data: bytes) -> tuple[dict, bytes]:
    document = data.decode("utf-8")
    _check_depth(document)
    report = json.loads(
        document, object_pairs_hook=_unique_keys, parse_constant=_reject_constant
    )
    if type(report) is not dict or set(report) != _REPORT_FIELDS:
        raise ValueError("Invalid export envelope.")
    version = report["schema_version"]
    if type(version) is not int or version != EXPORT_SCHEMA_VERSION:
        raise ProofVerificationError("unsupported export schema")
    if _canonical(report) != data:
        raise ProofVerificationError("noncanonical JSON")
    body = {key: value for key, value in report.items() if key != "proof_sha256"}
    if hashlib.sha256(_canonical(body)).hexdigest() != report["proof_sha256"]:
        raise ProofVerificationError("proof digest mismatch")
    if report["limitations"] != list(_LIMITATIONS) or report["evaluator_contracts"] != {
        "baseline": WEAKENED.definition.compatibility.evaluator_contract,
        "candidate": CORRECTED.definition.compatibility.evaluator_contract,
    }:
        raise ValueError("Invalid export metadata.")
    comparison = _canonical(report["comparison"])
    model = ComparisonPreviewResponse.model_validate_json(comparison)
    reconciled = compare_replay_summaries(
        _comparison_input(model, "baseline"), _comparison_input(model, "candidate")
    )
    if reconciled.canonical_json() != comparison:
        raise ProofVerificationError("comparison content or digest mismatch")
    return report, comparison


def _reproduce_comparison() -> bytes:
    fixture = load_replay_fixture(_FIXTURE)
    if fixture.content_hash != _FIXTURE_SHA256:
        raise ValueError("Trusted fixture digest mismatch.")
    expectations = load_replay_expectations(_EXPECTATIONS, fixture, CORRECTED)
    if expectations.content_sha256 != _EXPECTATIONS_SHA256:
        raise ValueError("Trusted expectation digest mismatch.")
    summaries = tuple(
        summarize_replay_grade(
            grade_loaded_replay(fixture, expectations, version),
            fixture,
            expectations,
            version,
        )
        for version in (WEAKENED, CORRECTED)
    )
    reproduced = compare_replay_summaries(*summaries).canonical_json()
    if hashlib.sha256(reproduced).hexdigest() != _COMPARISON_BYTES_SHA256:
        raise ValueError("Trusted comparison digest mismatch.")
    return reproduced


def verify_proof(directory: Path) -> None:
    """Raise a sanitized verification error unless the proof pair reproduces."""
    try:
        bundle = _artifact_path(directory)
        if sys.platform == "win32" and any(
            Path(part).is_reserved() or ":" in part or part.endswith((" ", "."))
            for part in bundle.parts[1:]
        ):
            raise ValueError("Unsafe Windows bundle path.")
        _check_directory(bundle)
        proof = _read_artifact(bundle / "proof.json")
        markdown = _read_artifact(bundle / "proof.md")
        markdown.decode("utf-8")
    except (OSError, ValueError):
        raise ProofVerificationError("invalid bundle path or artifact file") from None
    try:
        report, comparison = _validate_report(proof)
    except ProofVerificationError:
        raise
    except (ValueError, RecursionError):
        raise ProofVerificationError("invalid JSON or comparison schema") from None
    try:
        reproduced = _reproduce_comparison()
    except (OSError, ValueError):
        raise ProofVerificationError("trusted source reproduction failed") from None
    if comparison != reproduced:
        raise ProofVerificationError("comparison differs from trusted reproduction")
    if markdown != _markdown(report):
        raise ProofVerificationError("Markdown differs from verified JSON")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle-dir", type=Path, required=True)
    args = parser.parse_args(argv)
    try:
        verify_proof(args.bundle_dir)
    except ProofVerificationError as error:
        print(f"Proof verification failed: {error}.", file=sys.stderr)
        return 1
    print(
        "Proof verified: JSON and Markdown reproduce the trusted synthetic comparison."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
