import hashlib
import json
import subprocess
import sys
from pathlib import Path

import pytest

from app.services.replay_fixtures import load_replay_fixture
from app.services.replay_harness import run_replay
from app.services.sysmon_replay_fixture import (
    FIXTURE_NAME,
    REPORT_NAME,
    SAMPLE_SHA256,
    ConversionError,
    convert_sysmon_fixture,
    verify_sysmon_artifacts,
)

BACKEND = Path(__file__).resolve().parents[1]
ASSETS = Path(__file__).with_name("fixtures") / "external" / "splunk-ads-abuse"
SOURCE = ASSETS / "ads-abuse.sanitized.xml"
REFERENCE = ASSETS / "replay-v1"
FIXTURE_SHA256 = "4433f943edf9a499d7b7319d94aa62328ab759ab91579d5af5c1ad9884106289"


def test_reference_artifacts_are_reproducible_and_round_trip_through_file_loader():
    artifacts = convert_sysmon_fixture(SOURCE)
    assert artifacts == convert_sysmon_fixture(SOURCE)
    assert artifacts.fixture_json == (REFERENCE / FIXTURE_NAME).read_bytes()
    assert artifacts.report_json == (REFERENCE / REPORT_NAME).read_bytes()
    loaded = load_replay_fixture(REFERENCE / FIXTURE_NAME)
    assert loaded == artifacts.fixture == verify_sysmon_artifacts(SOURCE, REFERENCE)
    assert loaded.schema_version == 1
    assert loaded.content_hash == FIXTURE_SHA256
    assert loaded.fixture_id == f"external-sysmon-xml-v1-{SAMPLE_SHA256}"
    assert loaded.provenance["source"] == "splunk-sysmon-xml/v1"
    assert SAMPLE_SHA256 in loaded.provenance["description"]
    assert all(event.fields["command_line"] is None for event in loaded.events)
    manifest = run_replay(loaded, "encoded-powershell")
    assert manifest.input_sha256 == FIXTURE_SHA256
    assert (
        manifest.status,
        manifest.match_count,
        manifest.non_match_count,
        manifest.error_count,
    ) == ("completed", 0, 5, 0)


def test_report_accounts_for_every_ordinal_and_preserves_source_identity():
    artifacts = convert_sysmon_fixture(SOURCE)
    report = json.loads(artifacts.report_json)
    assert report["schema_version"] == 1
    assert report["policy"] == "exclude-sysmon-event-id-15/v1"
    assert report["mapping_version"] == "splunk-sysmon-xml/v1"
    assert report["source_sha256"] == SAMPLE_SHA256
    assert report["fixture_content_sha256"] == FIXTURE_SHA256
    assert (
        report["fixture_file_sha256"]
        == hashlib.sha256(artifacts.fixture_json).hexdigest()
    )
    assert report["counts"] == {
        "source": 13,
        "accepted": 5,
        "rejected": 0,
        "unsupported": 8,
    }
    assert report["source_provenance"]["license"] == "Apache-2.0"
    assert (
        report["source_provenance"]["commit"]
        == "5879f5423e6c08df2b22b63f7b36e84866f9c51c"
    )
    records = report["records"]
    assert [record["source_ordinal"] for record in records] == list(range(13))
    assert [
        (r["source_ordinal"], r["source_record_id"], r["replay_ordinal"])
        for r in records
        if r["status"] == "accepted"
    ] == [
        (0, "362120", 4),
        (1, "361146", 3),
        (2, "361131", 2),
        (3, "361080", 1),
        (12, "357234", 0),
    ]
    assert all(
        (r["status"], r["source_event_id"], r["replay_ordinal"])
        == ("unsupported", "15", None)
        for r in records[4:12]
    )
    assert records[0]["source_system_time"] == "2023-11-10T17:47:01.494649300Z"
    assert records[0]["source_event_time"] == "2023-11-10 17:47:01.481"
    assert [
        (d["ordinal"], d["severity"], d["code"]) for d in report["diagnostics"]
    ] == [
        (i, "error", "unsupported_event_id")
        if 4 <= i <= 11
        else (i, "warning", "null_field")
        for i in range(13)
    ]


def write_source(tmp_path, *records):
    content = b"\n".join(records) + b"\n"
    path = tmp_path / "source.xml"
    path.write_bytes(content)
    return path, hashlib.sha256(content).hexdigest()


def test_optional_missing_and_null_fields_stay_distinct(tmp_path):
    line = SOURCE.read_bytes().splitlines()[0]
    second = line.replace(b"362120", b"362119").replace(
        b'<Data Name="CommandLine" />', b""
    )
    source, digest = write_source(tmp_path, line, second)
    artifacts = convert_sysmon_fixture(source, expected_source_sha256=digest)
    assert [event.event_id for event in artifacts.fixture.events] == [
        "362120",
        "362119",
    ]
    assert artifacts.fixture.events[0].fields["command_line"] is None
    assert "command_line" not in artifacts.fixture.events[1].fields
    report = json.loads(artifacts.report_json)
    assert report["source_provenance"] is None
    assert [d["code"] for d in report["diagnostics"]] == ["null_field", "missing_field"]


@pytest.mark.parametrize(
    ("problem", "code"),
    [
        ("duplicate", "duplicate_record_id"),
        ("duplicate-excluded", "duplicate_record_id"),
        ("bad-timestamp", "invalid_timestamp"),
        ("bad-xml", "malformed_xml"),
        ("unlisted-id", "unsupported_event_id"),
    ],
)
def test_malformed_or_ambiguous_records_block_all_materialization(
    tmp_path, problem, code
):
    line = SOURCE.read_bytes().splitlines()[0]
    other = line.replace(b"362120", b"362119")
    rejected = {
        "duplicate": line,
        "duplicate-excluded": line.replace(
            b"<EventID>1</EventID>", b"<EventID>15</EventID>"
        ),
        "bad-timestamp": other.replace(
            b"2023-11-10 17:47:01.481", b"2023-02-30 17:47:01.481"
        ),
        "bad-xml": b"<Event",
        "unlisted-id": other.replace(b"<EventID>1</EventID>", b"<EventID>3</EventID>"),
    }[problem]
    source, digest = write_source(tmp_path, line, rejected)
    with pytest.raises(ConversionError, match="1 rejected source record") as exc:
        convert_sysmon_fixture(source, expected_source_sha256=digest)
    assert [
        (d.ordinal, d.code) for d in exc.value.diagnostics if d.severity == "error"
    ] == [(1, code)]


def test_only_unsupported_records_cannot_create_empty_fixture(tmp_path):
    source, digest = write_source(tmp_path, SOURCE.read_bytes().splitlines()[4])
    with pytest.raises(ConversionError, match="No eligible") as exc:
        convert_sysmon_fixture(source, expected_source_sha256=digest)
    assert exc.value.diagnostics[0].code == "unsupported_event_id"


def test_source_integrity_mismatch_blocks_conversion_and_verification(tmp_path):
    path = tmp_path / SOURCE.name
    path.write_bytes(SOURCE.read_bytes() + b" ")
    with pytest.raises(ConversionError, match="Source SHA-256 mismatch"):
        convert_sysmon_fixture(path)
    with pytest.raises(ConversionError, match="Source SHA-256 mismatch"):
        verify_sysmon_artifacts(path, REFERENCE)


@pytest.mark.parametrize("name", [FIXTURE_NAME, REPORT_NAME])
def test_verification_rejects_valid_json_tampering_and_missing_artifacts(
    tmp_path, name
):
    for item in (FIXTURE_NAME, REPORT_NAME):
        (tmp_path / item).write_bytes((REFERENCE / item).read_bytes())
    path = tmp_path / name
    altered = json.loads(path.read_bytes())
    if name == FIXTURE_NAME:
        altered["events"][0]["fields"]["process_name"] = "other.exe"
    else:
        altered["records"][0]["source_ordinal"] = 99
    path.write_text(json.dumps(altered), encoding="utf-8")
    with pytest.raises(ConversionError, match="does not match regenerated bytes"):
        verify_sysmon_artifacts(SOURCE, tmp_path)
    path.unlink()
    with pytest.raises(ConversionError, match="Missing or nonlocal artifact"):
        verify_sysmon_artifacts(SOURCE, tmp_path)


def test_cli_build_and_verify_are_reproducible_and_do_not_overwrite(tmp_path):
    command = [sys.executable, "-B", "-m", "app.services.sysmon_replay_fixture"]
    output = tmp_path / "output"
    for action in ("build", "verify"):
        result = subprocess.run(
            [*command, action, str(SOURCE), str(output)],
            cwd=BACKEND,
            capture_output=True,
            text=True,
            timeout=15,
            check=True,
        )
        assert result.stdout == f"{FIXTURE_SHA256}\n"
        assert result.stderr == ""
    repeat = subprocess.run(
        [*command, "build", str(SOURCE), str(output)],
        cwd=BACKEND,
        capture_output=True,
        text=True,
        timeout=15,
    )
    assert repeat.returncode == 1
    assert verify_sysmon_artifacts(SOURCE, output).content_hash == FIXTURE_SHA256
