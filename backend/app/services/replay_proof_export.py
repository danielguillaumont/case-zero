"""Export the pinned synthetic detection proof as canonical JSON and Markdown."""

import argparse
import hashlib
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from tempfile import TemporaryDirectory

from app.services.replay_comparison import compare_replay_summaries
from app.services.replay_expectations import load_replay_expectations
from app.services.replay_fixtures import load_replay_fixture
from app.services.replay_grading import grade_loaded_replay
from app.services.replay_regression_proof import CORRECTED, WEAKENED
from app.services.replay_summary import summarize_replay_grade
from app.services.sysmon_replay_fixture import (
    _artifact_path,
    _check_directory,
    _rename_noreplace,
)

EXPORT_SCHEMA_VERSION = 1
MAX_ARTIFACT_BYTES = 16 * 1024
_ASSETS = Path(__file__).resolve().parents[1] / "replay_assets"
_FIXTURE = _ASSETS / "encoded_powershell.json"
_EXPECTATIONS = _FIXTURE.with_suffix(".expectations.json")
_FIXTURE_SHA256 = "025c8bb93536b73227406c8c74e2f64d8592350b328792147a77f628357beb6d"
_EXPECTATIONS_SHA256 = (
    "2b566489fdd31209b056c21a657749cef15467aaab61dff96261ff407ec42220"
)
# The independently recorded v2.5-D pin covers the full comparison envelope.
_COMPARISON_BYTES_SHA256 = (
    "61f50d1b4fc71f47092576afa32b133ad33b3d4d6949a1f2e808f41c4915cec9"
)
_LIMITATIONS = (
    "This bundled synthetic fixture contains three authored labels and exercises "
    "two built-in versions of one rule.",
    "The results measure satisfaction on those labels only and provide no estimate "
    "of real-world detection accuracy.",
    "SHA-256 identifies content. It does not authenticate the exporter or prove "
    "independent provenance.",
)
_TOTALS = (
    "true_positive",
    "true_negative",
    "false_positive",
    "false_negative",
    "evaluation_error",
    "unsupported",
)


@dataclass(frozen=True, slots=True)
class ProofArtifacts:
    json_bytes: bytes
    markdown_bytes: bytes


def _canonical(payload: dict) -> bytes:
    return json.dumps(
        payload, sort_keys=True, ensure_ascii=True, separators=(",", ":")
    ).encode("utf-8")


def _markdown(report: dict) -> bytes:
    comparison = report["comparison"]
    lines = [
        "# Offline detection proof",
        "",
        f"Scenario: `{comparison['fixture_id']}` (bundled synthetic fixture).",
        "",
        "Source: `app/replay_assets/encoded_powershell.json` and its authored",
        "`encoded_powershell.expectations.json` companion. Version-bound offline",
        "grading, validated summaries, and comparison produced these results.",
        "",
        f"Events: {comparison['total_events']} total, {comparison['labeled_events']} labeled, "
        f"{comparison['unlabeled_events']} unlabeled. Satisfaction uses all authored labels.",
        "",
        "| Version | Result | Labels satisfied | TP | TN | FP | FN | Errors | Unsupported |",
        "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ]
    for side, label in (
        ("baseline", "Weakened baseline"),
        ("candidate", "Corrected candidate"),
    ):
        run = comparison[side]
        status = "PASS" if run["passed"] else "FAIL"
        satisfaction = run["labeled_satisfaction"]
        fraction = f"{satisfaction['numerator']}/{satisfaction['denominator']}"
        totals = " | ".join(str(run["totals"][key]) for key in _TOTALS)
        lines.append(f"| {label} | {status} | {fraction} | {totals} |")

    lines.extend(("", "## Expectation results", ""))
    changes = comparison["change_totals"]
    lines.append(
        f"{changes['improved']} improved, {changes['regressed']} regressed, "
        f"{changes['unchanged']} unchanged, {changes['inconclusive']} inconclusive."
    )
    lines.extend(
        (
            "",
            "| Expectation | Event | Expected | Baseline | Candidate | Change |",
            "| --- | --- | --- | --- | --- | --- |",
        )
    )
    for row in comparison["expectations"]:
        lines.append(
            f"| `{row['expectation_id']}` | `{row['event_id']}` | `{row['expected_outcome']}` "
            f"| `{row['baseline_classification']}` | `{row['candidate_classification']}` "
            f"| `{row['change']}` |"
        )
    lines.extend(
        (
            "",
            "The baseline missed the authored match. The corrected rule matched it.",
            "Both rules correctly left the two benign controls unmatched.",
            "",
            "## Content identities",
            "",
            f"- Fixture SHA-256: `{comparison['fixture_sha256']}`",
            f"- Expectation set SHA-256: `{comparison['expectations_sha256']}`",
            f"- Comparison SHA-256: `{comparison['comparison_sha256']}`",
            f"- Export content SHA-256: `{report['proof_sha256']}`",
            f"- Authoring rule version: `{' @ '.join(comparison['authoring_version_id'])}`",
        )
    )
    for side in ("baseline", "candidate"):
        run = comparison[side]
        contract = report["evaluator_contracts"][side]
        lines.extend(
            (
                f"- {side.title()} evaluator contract: `{contract}`",
                f"- {side.title()} requested: `{' @ '.join(run['requested_version_id'])}`",
                f"- {side.title()} executed: `{' @ '.join(run['executed_version_id'])}`",
                f"- {side.title()} grade SHA-256: `{run['grade_sha256']}`",
            )
        )
    lines.extend(
        ("", "## Limitations", "", *(f"- {item}" for item in report["limitations"]))
    )
    lines.extend(
        (
            "",
            "## Reproduce",
            "",
            "From `backend`, choose a new local output directory under an existing parent.",
            "",
            "```powershell",
            "$output = Join-Path $env:TEMP ('casezero-proof-' + [guid]::NewGuid())",
            r".\.venv\Scripts\python.exe -m app.services.replay_proof_export"
            " --output-dir $output",
            "```",
            "",
        )
    )
    return "\n".join(lines).encode("utf-8")


def build_proof() -> ProofArtifacts:
    """Run the existing validated grading path and render the pinned comparison."""
    fixture = load_replay_fixture(_FIXTURE)
    if fixture.content_hash != _FIXTURE_SHA256:
        raise ValueError("Proof fixture digest mismatch.")
    expectations = load_replay_expectations(_EXPECTATIONS, fixture, CORRECTED)
    if expectations.content_sha256 != _EXPECTATIONS_SHA256:
        raise ValueError("Proof expectation-set digest mismatch.")
    summaries = tuple(
        summarize_replay_grade(
            grade_loaded_replay(fixture, expectations, version),
            fixture,
            expectations,
            version,
        )
        for version in (WEAKENED, CORRECTED)
    )
    comparison = compare_replay_summaries(*summaries).canonical_json()
    # This enforces the exact supported FAIL/PASS proof, including both executed
    # versions and every classification, before any source text reaches Markdown.
    if hashlib.sha256(comparison).hexdigest() != _COMPARISON_BYTES_SHA256:
        raise ValueError("Proof comparison differs from the pinned result.")
    report = {
        "schema_version": EXPORT_SCHEMA_VERSION,
        "comparison": json.loads(comparison),
        "evaluator_contracts": {
            "baseline": WEAKENED.definition.compatibility.evaluator_contract,
            "candidate": CORRECTED.definition.compatibility.evaluator_contract,
        },
        "limitations": _LIMITATIONS,
    }
    report["proof_sha256"] = hashlib.sha256(_canonical(report)).hexdigest()
    json_bytes = _canonical(report)
    markdown_bytes = _markdown(report)
    if max(len(json_bytes), len(markdown_bytes)) > MAX_ARTIFACT_BYTES:
        raise ValueError("Proof artifact exceeds its size limit.")
    return ProofArtifacts(json_bytes, markdown_bytes)


def export_proof(directory: Path) -> None:
    """Publish both artifacts together at a previously unused local path."""
    destination = _artifact_path(directory)
    if sys.platform == "win32" and any(
        Path(part).is_reserved() or ":" in part or part.endswith((" ", "."))
        for part in destination.parts[1:]
    ):
        raise ValueError("Unsafe Windows output path.")
    _check_directory(destination.parent)
    try:
        destination.lstat()
    except FileNotFoundError:
        pass
    else:
        raise FileExistsError("Proof destination already exists.")
    artifacts = build_proof()
    with TemporaryDirectory(prefix=".proof-stage-", dir=destination.parent) as staging:
        stage = Path(staging)
        for name, content in (
            ("proof.json", artifacts.json_bytes),
            ("proof.md", artifacts.markdown_bytes),
        ):
            with (stage / name).open("xb") as stream:
                stream.write(content)
        _rename_noreplace(stage, destination)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", required=True, type=Path)
    args = parser.parse_args(argv)
    try:
        export_proof(args.output_dir)
    except ValueError:
        print(
            "Proof export failed: invalid proof or unsafe output directory.",
            file=sys.stderr,
        )
        return 1
    except OSError:
        print(
            "Proof export failed: could not publish to a new output directory.",
            file=sys.stderr,
        )
        return 1
    print("Proof exported: proof.json and proof.md.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
