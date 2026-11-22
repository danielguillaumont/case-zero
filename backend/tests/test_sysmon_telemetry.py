from dataclasses import FrozenInstanceError
from datetime import datetime, timezone
from pathlib import Path

import pytest

from app.services.replay_fixtures import MAX_EVENTS, MAX_FILE_BYTES
from app.services.sysmon_telemetry import (
    MAX_RECORD_BYTES,
    SysmonDiagnostic,
    SysmonImportError,
    load_sysmon_telemetry,
)

CAPTURE = (
    Path(__file__).with_name("fixtures")
    / "external/splunk-ads-abuse/ads-abuse.sanitized.xml"
)


def write_capture(tmp_path, *lines):
    path = tmp_path / "capture.xml"
    path.write_bytes(b"\n".join(lines) + b"\n")
    return path


def test_pinned_external_sample_maps_with_source_integrity_and_provenance():
    result = load_sysmon_telemetry(CAPTURE)
    assert result == load_sysmon_telemetry(CAPTURE)
    assert result.mapping_version == "splunk-sysmon-xml/v1"
    assert CAPTURE.stat().st_size == 6280
    assert (
        result.source_sha256
        == "c164a062f6808e0121b476a335ebce1a7809b9b23f203c5afae8ae7951705094"
    )
    assert tuple(record.ordinal for record in result.records) == tuple(range(13))
    assert [event.ordinal for event in result.events] == [12, 3, 2, 1, 0]
    assert [event.event_id for event in result.events] == [
        "357234",
        "361080",
        "361131",
        "361146",
        "362120",
    ]
    event = result.events[-1]
    record = result.records[0]
    assert record.event is event
    assert record.source_fields["System/EventRecordID"] == event.event_id
    assert record.source_fields["System/Provider/@Name"] == "Microsoft-Windows-Sysmon"
    assert (
        record.source_fields["System/TimeCreated/@SystemTime"]
        == "2023-11-10T17:47:01.494649300Z"
    )
    assert (
        record.source_fields["EventData/UtcTime"]
        == event.recorded_event_time
        == "2023-11-10 17:47:01.481"
    )
    assert event.event_time == datetime(
        2023, 11, 10, 17, 47, 1, 481000, tzinfo=timezone.utc
    )
    assert event.fields == {
        "event_type": "process_creation",
        "source": "Microsoft-Windows-Sysmon/Operational",
        "hostname": "splunk-lab-host.invalid",
        "process_name": "powershell.exe",
        "command_line": None,
    }
    assert result.diagnostics == tuple(
        SysmonDiagnostic(i, "error", "unsupported_event_id", "System/EventID")
        if 4 <= i <= 11
        else SysmonDiagnostic(i, "warning", "null_field", "EventData/CommandLine")
        for i in range(13)
    )
    assert result.records[4].source_fields["System/EventID"] == "15"
    assert result.records[4].event is None
    with pytest.raises(TypeError):
        record.source_fields["EventData/Image"] = "changed"
    with pytest.raises(TypeError):
        event.fields["process_name"] = "changed"
    with pytest.raises(FrozenInstanceError):
        result.records = ()


def test_command_line_is_inert_and_timestamp_ties_preserve_input_order(tmp_path):
    line = CAPTURE.read_bytes().splitlines()[0]
    first = line.replace(
        b'<Data Name="CommandLine" />',
        b'<Data Name="CommandLine">pwsh.exe Get-Date &amp; literal</Data>',
    )
    second = first.replace(b"362120", b"362119").replace(
        b"<Computer>splunk-lab-host.invalid</Computer>", b""
    )
    result = load_sysmon_telemetry(write_capture(tmp_path, first, second, first))
    assert [event.event_id for event in result.events] == ["362120", "362119"]
    assert result.events[0].fields["command_line"] == "pwsh.exe Get-Date & literal"
    assert (
        result.records[0].source_fields["EventData/CommandLine"]
        == result.events[0].fields["command_line"]
    )
    assert "hostname" not in result.events[1].fields
    assert result.diagnostics == (
        SysmonDiagnostic(1, "warning", "missing_field", "System/Computer"),
        SysmonDiagnostic(2, "error", "duplicate_record_id", "System/EventRecordID"),
    )


@pytest.mark.parametrize(
    ("original", "replacement", "code", "field"),
    [
        (b"<EventID>1</EventID>", b"", "missing_field", "System/EventID"),
        (b"<EventID>1</EventID>", b"<EventID />", "null_field", "System/EventID"),
        (
            b"<EventID>1</EventID>",
            b"<EventID>one</EventID>",
            "malformed_field",
            "System/EventID",
        ),
        (
            b"<EventID>1</EventID>",
            b"<EventID>2</EventID>",
            "unsupported_event_id",
            "System/EventID",
        ),
        (
            b"<EventID>1</EventID>",
            b"<EventID>1</EventID><EventID>1</EventID>",
            "duplicate_field",
            "System/EventID",
        ),
        (
            b'Name="Microsoft-Windows-Sysmon"',
            b'Name="other"',
            "unsupported_provider",
            "System/Provider/@Name",
        ),
        (
            b"Microsoft-Windows-Sysmon/Operational",
            b"other",
            "unsupported_channel",
            "System/Channel",
        ),
        (
            b"2023-11-10 17:47:01.481",
            b"2023-02-30 17:47:01.481",
            "invalid_timestamp",
            "EventData/UtcTime",
        ),
        (
            b"2023-11-10 17:47:01.481",
            b"2023-11-10T17:47:01.481",
            "invalid_timestamp",
            "EventData/UtcTime",
        ),
        (
            b"2023-11-10T17:47:01.494649300Z",
            b"2023-11-10T17:47:01.494649300",
            "invalid_timestamp",
            "System/TimeCreated/@SystemTime",
        ),
        (
            b'<Data Name="UtcTime">2023-11-10 17:47:01.481</Data>',
            b"",
            "missing_field",
            "EventData/UtcTime",
        ),
        (
            b'<Data Name="CommandLine" />',
            b'<Data Name="Image" />',
            "duplicate_field",
            "EventData/Data",
        ),
        (b"powershell.exe", b"x" * 4097, "malformed_field", "EventData/Image"),
    ],
    ids=[
        "missing",
        "null",
        "malformed",
        "unsupported",
        "duplicate",
        "provider",
        "channel",
        "invalid-date",
        "invalid-format",
        "invalid-system-time",
        "missing-time",
        "duplicate-data",
        "field-limit",
    ],
)
def test_invalid_records_are_rejected_with_structured_diagnostics(
    tmp_path, original, replacement, code, field
):
    line = CAPTURE.read_bytes().splitlines()[0]
    assert original in line
    result = load_sysmon_telemetry(
        write_capture(tmp_path, line.replace(original, replacement))
    )
    assert result.events == ()
    assert result.records[0].event is None
    assert result.diagnostics == (SysmonDiagnostic(0, "error", code, field),)


def test_xml_safety_checks_do_not_hide_later_valid_records(tmp_path):
    line = CAPTURE.read_bytes().splitlines()[0]
    path = write_capture(
        tmp_path,
        b'<!DOCTYPE Event [<!ENTITY sample "text">]>' + line,
        b"<Event",
        line.replace(b"</Event>", b"<x>" * 9 + b"</x>" * 9 + b"</Event>"),
        b"x" * (MAX_RECORD_BYTES + 1),
        line,
    )
    result = load_sysmon_telemetry(path)
    assert [item.code for item in result.diagnostics] == [
        "unsupported_xml_markup",
        "malformed_xml",
        "nesting_limit",
        "record_too_large",
        "null_field",
    ]
    assert [event.ordinal for event in result.events] == [4]


@pytest.mark.parametrize(
    ("data", "message"),
    [
        (b"", "empty"),
        (b"\xff", "UTF-8"),
        (b"x" * (MAX_FILE_BYTES + 1), "file size"),
        (b"x\n" * (MAX_EVENTS + 1), "event count"),
        (b"\n" * (MAX_EVENTS + 1), "event count"),
    ],
    ids=["empty", "utf8", "bytes", "records", "blank-records"],
)
def test_invalid_documents_cannot_bypass_global_limits(tmp_path, data, message):
    path = tmp_path / "capture.xml"
    path.write_bytes(data)
    with pytest.raises(SysmonImportError, match=message):
        load_sysmon_telemetry(path)


def test_import_rejects_nonlocal_and_nonregular_files(tmp_path):
    for path in (
        tmp_path,
        tmp_path / "missing.xml",
        Path("//sysmon.invalid/share/capture.xml"),
    ):
        with pytest.raises(SysmonImportError):
            load_sysmon_telemetry(path)
