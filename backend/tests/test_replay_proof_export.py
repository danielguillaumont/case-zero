import hashlib
import json
import os
import socket
import subprocess
import sys
from dataclasses import replace
from pathlib import Path

import pytest

from app.services import replay_proof_export as export
from app.services.replay_grading import GradeTotals
from app.services.replay_regression_proof import CORRECTED, WEAKENED


def test_proof_reports_real_pinned_results_and_canonical_identity():
    artifacts = export.build_proof()
    report = json.loads(artifacts.json_bytes)
    comparison = report["comparison"]
    assert report["schema_version"] == 1
    assert comparison["fixture_id"] == "synthetic-encoded-powershell"
    assert (
        comparison["fixture_sha256"]
        == "025c8bb93536b73227406c8c74e2f64d8592350b328792147a77f628357beb6d"
    )
    assert (
        comparison["expectations_sha256"]
        == "2b566489fdd31209b056c21a657749cef15467aaab61dff96261ff407ec42220"
    )
    assert (
        comparison["comparison_sha256"]
        == "537a653234548dca4490997a4c344c4cbaa1673c1314b95357eefda55e7136a2"
    )
    assert comparison["authoring_version_id"] == list(CORRECTED.version_id)
    assert [
        comparison[k] for k in ("total_events", "labeled_events", "unlabeled_events")
    ] == [3, 3, 0]
    for side, version, numerator, passed, counts in (
        ("baseline", WEAKENED, 2, False, [0, 2, 0, 1, 0, 0]),
        ("candidate", CORRECTED, 3, True, [1, 2, 0, 0, 0, 0]),
    ):
        run = comparison[side]
        assert (
            run["requested_version_id"]
            == run["executed_version_id"]
            == list(version.version_id)
        )
        assert (
            report["evaluator_contracts"][side]
            == version.definition.compatibility.evaluator_contract
        )
        assert run["passed"] is passed
        assert run["labeled_satisfaction"] == {"numerator": numerator, "denominator": 3}
        assert [
            run["totals"][k]
            for k in (
                "true_positive",
                "true_negative",
                "false_positive",
                "false_negative",
                "evaluation_error",
                "unsupported",
            )
        ] == counts
    assert comparison["change_totals"] == dict(
        improved=1, regressed=0, unchanged=2, inconclusive=0
    )
    rows = comparison["expectations"]
    assert [row["expectation_id"] for row in rows] == [
        "benign-get-date",
        "benign-get-service",
        "encoded-switch",
    ]
    assert [
        (r["baseline_classification"], r["candidate_classification"], r["change"])
        for r in rows
    ] == [
        ("true_negative", "true_negative", "unchanged"),
        ("true_negative", "true_negative", "unchanged"),
        ("false_negative", "true_positive", "improved"),
    ]

    def canonical(value):
        return json.dumps(
            value, sort_keys=True, separators=(",", ":"), ensure_ascii=True
        ).encode()

    assert artifacts.json_bytes == canonical(report)
    digest = report.pop("proof_sha256")
    assert hashlib.sha256(canonical(report)).hexdigest() == digest
    assert f"`{digest}`".encode() in artifacts.markdown_bytes
    assert (
        b"| Weakened baseline | FAIL | 2/3 | 0 | 2 | 0 | 1 | 0 | 0 |"
        in artifacts.markdown_bytes
    )
    assert (
        b"| Corrected candidate | PASS | 3/3 | 1 | 2 | 0 | 0 | 0 | 0 |"
        in artifacts.markdown_bytes
    )
    row = b" | ".join(
        [
            b"| `encoded-switch`",
            b"`encoded`",
            b"`match`",
            b"`false_negative`",
            b"`true_positive`",
            b"`improved` |",
        ]
    )
    assert row in artifacts.markdown_bytes
    for data in (artifacts.json_bytes, artifacts.markdown_bytes):
        assert 0 < len(data) <= export.MAX_ARTIFACT_BYTES
        for forbidden in (
            b"pwsh.exe",
            b"powershell.exe",
            b"Get-Date",
            b"Get-Service",
            b"command_line",
            b"hostname",
            b"password",
            b"token",
        ):
            assert forbidden not in data


def test_cli_is_deterministic_across_processes_and_refuses_overwrite(tmp_path):
    artifacts = export.build_proof()
    for seed in (1, 2):
        out = tmp_path / str(seed)
        command = [sys.executable, "-m", export.__name__, "--output-dir", str(out)]
        env = {**os.environ, "PYTHONHASHSEED": str(seed)}
        process = subprocess.run(
            command, env=env, capture_output=True, check=True, timeout=15
        )
        assert process.stdout.strip() == b"Proof exported: proof.json and proof.md."
        assert sorted(p.name for p in out.iterdir()) == ["proof.json", "proof.md"]
        assert (out / "proof.json").read_bytes() == artifacts.json_bytes
        assert (out / "proof.md").read_bytes() == artifacts.markdown_bytes
        existing = subprocess.run(command, env=env, capture_output=True, timeout=15)
        assert existing.returncode == 1
        assert (out / "proof.json").read_bytes() == artifacts.json_bytes
        assert (out / "proof.md").read_bytes() == artifacts.markdown_bytes


@pytest.mark.parametrize("kind", ["fixture", "expectations"])
def test_valid_but_changed_assets_fail_closed(tmp_path, monkeypatch, kind):
    if kind == "fixture":
        original, attribute = export._FIXTURE, "_FIXTURE"
    else:
        original, attribute = export._EXPECTATIONS, "_EXPECTATIONS"
    asset = tmp_path / original.name
    payload = json.loads(original.read_bytes())
    if kind == "fixture":
        payload["events"].reverse()
    else:
        payload["expectations"][0]["name"] += " altered"
    asset.write_text(json.dumps(payload), encoding="utf-8")
    monkeypatch.setattr(export, attribute, asset)
    with pytest.raises(ValueError, match="digest mismatch"):
        export.build_proof()


@pytest.mark.parametrize("mutation", ["identity", "totals", "unsupported", "injection"])
def test_invalid_comparison_cannot_be_exported(monkeypatch, tmp_path, capsys, mutation):
    compare = export.compare_replay_summaries

    def tamper(*args):
        comparison = compare(*args)
        if mutation == "identity":
            return replace(comparison, fixture_sha256="not a hash")
        if mutation == "injection":
            return replace(comparison, fixture_id="`|<script>secret</script>")
        if mutation == "unsupported":
            return replace(
                comparison,
                candidate=replace(
                    comparison.candidate,
                    executed_version_id=None,
                    passed=False,
                    totals=GradeTotals(0, 0, 0, 0, 0, 3),
                ),
            )
        return replace(comparison, total_events=4)

    monkeypatch.setattr(export, "compare_replay_summaries", tamper)
    out = tmp_path / "proof"
    assert export.main(["--output-dir", str(out)]) == 1
    assert not out.exists()
    error = capsys.readouterr().err
    assert "invalid proof" in error
    assert "secret" not in error


def test_size_limit_refuses_either_artifact(monkeypatch):
    artifacts = export.build_proof()
    for field in ("json_bytes", "markdown_bytes"):
        with monkeypatch.context() as patch:
            if field == "json_bytes":
                patch.setattr(export, "_markdown", lambda _: b"short")
            patch.setattr(
                export, "MAX_ARTIFACT_BYTES", len(getattr(artifacts, field)) - 1
            )
            with pytest.raises(ValueError, match="size limit"):
                export.build_proof()


def test_destinations_are_new_local_directories(tmp_path):
    occupied = tmp_path / "occupied"
    occupied.mkdir()
    foreign = occupied / "unrelated.txt"
    foreign.write_bytes(b"preserve")
    with pytest.raises(FileExistsError):
        export.export_proof(occupied)
    assert list(occupied.iterdir()) == [foreign]
    assert foreign.read_bytes() == b"preserve"
    for path in (
        tmp_path / "missing" / "proof",
        tmp_path / ".." / "proof",
        Path("//example/share/proof"),
    ):
        with pytest.raises(ValueError):
            export.export_proof(path)


def test_destination_symlinks_are_rejected(tmp_path):
    target = tmp_path / "target"
    target.mkdir()
    alias = tmp_path / "alias"
    try:
        alias.symlink_to(target, target_is_directory=True)
    except OSError:
        pytest.skip("Creating a symlink requires OS privileges on this host.")
    with pytest.raises(FileExistsError):
        export.export_proof(alias)
    with pytest.raises(ValueError):
        export.export_proof(alias / "proof")
    assert list(target.iterdir()) == []


def test_failed_second_write_leaves_no_published_pair(tmp_path, monkeypatch):
    original = Path.open

    def fail(path, mode="r", *args, **kwargs):
        if path.name == "proof.md" and mode == "xb":
            raise OSError("injected write error")
        return original(path, mode, *args, **kwargs)

    monkeypatch.setattr(Path, "open", fail)
    with pytest.raises(OSError):
        export.export_proof(tmp_path / "proof")
    assert not list(tmp_path.iterdir())


def test_destination_created_during_staging_is_not_replaced(tmp_path, monkeypatch):
    publish = export._rename_noreplace
    out = tmp_path / "proof"

    def compete(stage, destination):
        destination.mkdir()
        publish(stage, destination)

    monkeypatch.setattr(export, "_rename_noreplace", compete)
    with pytest.raises(FileExistsError):
        export.export_proof(out)
    assert list(tmp_path.iterdir()) == [out]
    assert not list(out.iterdir())


def test_export_does_not_access_network_or_database(tmp_path, monkeypatch):
    from sqlalchemy.engine import Engine
    from sqlalchemy.orm import Session

    def forbidden(*args, **kwargs):
        pytest.fail("unexpected network or database access")

    monkeypatch.setattr(socket, "socket", forbidden)
    monkeypatch.setattr(socket, "getaddrinfo", forbidden)
    monkeypatch.setattr(Engine, "connect", forbidden)
    monkeypatch.setattr(Session, "execute", forbidden)
    monkeypatch.setattr(Session, "commit", forbidden)
    export.export_proof(tmp_path / "proof")
