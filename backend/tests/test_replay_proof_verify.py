import hashlib
import json
import os
import socket
import subprocess
import sys
from pathlib import Path

import pytest

from app.services import replay_proof_export as export
from app.services import replay_proof_verify as verify


@pytest.fixture
def bundle(tmp_path):
    path = tmp_path / "proof"
    export.export_proof(path)
    return path


def canonical(payload):
    return json.dumps(
        payload, ensure_ascii=True, sort_keys=True, separators=(",", ":")
    ).encode()


def with_digest(payload, key):
    body = {k: v for k, v in payload.items() if k != key}
    return {**body, key: hashlib.sha256(canonical(body)).hexdigest()}


def reject(bundle, match):
    with pytest.raises(verify.ProofVerificationError, match=match):
        verify.verify_proof(bundle)


def test_generated_proof_verifies_in_separate_processes_without_writes(bundle):
    paths = sorted(bundle.iterdir())
    before = [(p.read_bytes(), p.stat().st_mtime_ns) for p in paths]
    for seed in (1, 2):
        process = subprocess.run(
            [sys.executable, "-m", verify.__name__, "--bundle-dir", str(bundle)],
            env={**os.environ, "PYTHONHASHSEED": str(seed)},
            capture_output=True,
            check=True,
            timeout=15,
        )
        assert process.stdout.strip() == (
            b"Proof verified: JSON and Markdown reproduce the trusted synthetic comparison."
        )
        assert not process.stderr
    assert sorted(bundle.iterdir()) == paths
    assert [(p.read_bytes(), p.stat().st_mtime_ns) for p in paths] == before


@pytest.mark.parametrize("filename", ["proof.json", "proof.md"])
@pytest.mark.parametrize("mutation", ["missing", "empty", "oversized", "invalid utf8"])
def test_invalid_files(bundle, filename, mutation):
    path = bundle / filename
    if mutation == "missing":
        path.unlink()
    else:
        path.write_bytes(
            {"empty": b"", "oversized": b"x" * 16385, "invalid utf8": b"\xff"}[mutation]
        )
    reject(bundle, "invalid bundle|invalid JSON|Markdown differs")


@pytest.mark.parametrize(
    "mutation,category",
    [
        ("duplicate", "invalid JSON"),
        ("nested duplicate", "invalid JSON"),
        ("noncanonical", "noncanonical JSON"),
        ("digest", "proof digest mismatch"),
        ("unsupported", "unsupported export schema"),
        ("extra", "invalid JSON"),
        ("depth", "invalid JSON"),
    ],
)
def test_untrusted_json_fails_before_source_reproduction(
    bundle, monkeypatch, mutation, category
):
    path = bundle / "proof.json"
    raw = path.read_bytes()
    if mutation == "duplicate":
        raw = b'{"schema_version":1,' + raw[1:]
    elif mutation == "nested duplicate":
        raw = raw.replace(
            b'"true_positive":0', b'"true_positive":0,"true_positive":0', 1
        )
    elif mutation == "noncanonical":
        raw += b"\n"
    elif mutation == "depth":
        raw = b"[" * 1500 + b"]" * 1500
    else:
        report = json.loads(raw)
        if mutation == "digest":
            report["proof_sha256"] = "0" * 64
        elif mutation == "unsupported":
            report["schema_version"] = 2
        else:
            report["unexpected"] = "sensitive marker"
        raw = canonical(report)
    path.write_bytes(raw)

    def should_not_run():
        pytest.fail("Untrusted JSON reached source reproduction")

    monkeypatch.setattr(verify, "_reproduce_comparison", should_not_run)
    reject(bundle, category)


@pytest.mark.parametrize(
    "mutation,category",
    [
        ("comparison digest", "comparison content or digest mismatch"),
        ("totals", "invalid JSON or comparison schema"),
        ("classification", "invalid JSON or comparison schema"),
        ("identity", "invalid JSON or comparison schema"),
        ("delta", "comparison content or digest mismatch"),
        ("fabricated grade", "comparison differs from trusted reproduction"),
    ],
)
def test_comparison_integrity(bundle, mutation, category):
    path = bundle / "proof.json"
    report = json.loads(path.read_bytes())
    comparison = report["comparison"]
    if mutation == "comparison digest":
        comparison["comparison_sha256"] = "0" * 64
    else:
        if mutation == "totals":
            comparison["baseline"]["totals"]["true_positive"] = 1
        elif mutation == "classification":
            comparison["expectations"][0]["candidate_classification"] = "true_positive"
        elif mutation == "identity":
            comparison["baseline"]["executed_version_id"][1] = "1" * 64
        elif mutation == "delta":
            comparison["change_totals"]["improved"] = 2
        else:
            comparison["baseline"]["grade_sha256"] = "1" * 64
        report["comparison"] = with_digest(comparison, "comparison_sha256")
    path.write_bytes(canonical(with_digest(report, "proof_sha256")))
    reject(bundle, category)


@pytest.mark.parametrize(
    "old,new",
    [
        (b"2/3", b"3/3"),
        (b"false_negative", b"true_positive"),
        (b"Baseline requested", b"Baseline ignored"),
        (b"three authored", b"four authored"),
        (b"", b"\nExtra text"),
        (b"## Limitations", b""),
    ],
)
def test_markdown_must_match_exactly(bundle, old, new):
    path = bundle / "proof.md"
    data = path.read_bytes()
    assert old in data
    path.write_bytes(data.replace(old, new, 1) if old else data + new)
    reject(bundle, "Markdown differs from verified JSON")


def test_unsafe_paths_and_symlinks(bundle):
    reject(bundle / ".." / bundle.name, "invalid bundle path")
    reject(Path("//example/share/proof"), "invalid bundle path")
    alias = bundle.with_name("alias")
    try:
        alias.symlink_to(bundle, target_is_directory=True)
    except OSError:
        pytest.skip("Creating a symlink requires OS privileges on this host.")
    reject(alias, "invalid bundle path")
    proof = bundle / "proof.json"
    target = bundle.with_name("alternate.json")
    proof.rename(target)
    proof.symlink_to(target)
    reject(bundle, "invalid bundle path or artifact file")


@pytest.mark.parametrize("asset", ["_FIXTURE", "_EXPECTATIONS"])
def test_source_asset_changes_fail_reproduction(bundle, tmp_path, monkeypatch, asset):
    original = getattr(verify, asset)
    path = tmp_path / original.name
    payload = json.loads(original.read_bytes())
    if asset == "_FIXTURE":
        payload["events"].reverse()
    else:
        payload["expectations"][0]["name"] += " modified"
    path.write_bytes(canonical(payload))
    monkeypatch.setattr(verify, asset, path)
    reject(bundle, "trusted source reproduction failed")


def test_verifier_uses_no_database_network_or_export_builder(bundle, monkeypatch):
    from sqlalchemy.engine import Engine
    from sqlalchemy.orm import Session

    def forbidden(*args, **kwargs):
        pytest.fail("Unexpected database, network, or export builder call")

    for owner, names in (
        (socket, ("socket", "getaddrinfo")),
        (Engine, ("connect",)),
        (Session, ("execute", "commit")),
        (export, ("build_proof",)),
    ):
        for name in names:
            monkeypatch.setattr(owner, name, forbidden)
    verify.verify_proof(bundle)


def test_cli_failure_is_sanitized_and_read_only(bundle, capsys):
    path = bundle / "proof.json"
    secret = b"private marker supplied by untrusted input"
    path.write_bytes(secret)
    assert verify.main(["--bundle-dir", str(bundle)]) == 1
    output = capsys.readouterr()
    assert (
        output.err == "Proof verification failed: invalid JSON or comparison schema.\n"
    )
    assert not output.out
    assert path.read_bytes() == secret
