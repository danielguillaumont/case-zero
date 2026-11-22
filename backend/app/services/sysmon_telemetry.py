"""Map Splunk Attack Data's line-delimited Sysmon XML to replay events.

Only Event ID 1 in the Sysmon Operational channel is supported. Record IDs
are scoped to the supplied capture. The result's source digest covers the
input bytes, independently of any replay fixture or grading identity.
"""

import hashlib
import re
import xml.etree.ElementTree as ET
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from types import MappingProxyType
from typing import Literal

from app.services.replay_fixtures import (
    MAX_EVENTS,
    MAX_FILE_BYTES,
    MAX_NESTING_DEPTH,
    FixtureError,
    ReplayEvent,
    _string,
    _utc_timestamp,
)

MAPPING_VERSION = "splunk-sysmon-xml/v1"
MAX_RECORD_BYTES = 16 * 1024
_NS = "{http://schemas.microsoft.com/win/2004/08/events/event}"
_PROVIDER = "Microsoft-Windows-Sysmon"
_CHANNEL = "Microsoft-Windows-Sysmon/Operational"
_UNSIGNED = re.compile(r"0|[1-9][0-9]{0,19}")
_UTC_TIME = re.compile(
    r"[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}"
)
_SYSTEM_TIME = re.compile(
    r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{7,9}Z"
)


class SysmonImportError(ValueError):
    """The document could not be read within the import contract."""


class _RecordError(ValueError):
    def __init__(self, code: str, field: str):
        self.code = code
        self.field = field


@dataclass(frozen=True, slots=True)
class SysmonDiagnostic:
    ordinal: int
    severity: Literal["warning", "error"]
    code: str
    field: str


@dataclass(frozen=True, slots=True)
class SysmonRecord:
    ordinal: int
    source_fields: Mapping[str, str | None]
    event: ReplayEvent | None


@dataclass(frozen=True, slots=True)
class SysmonImport:
    mapping_version: str
    source_sha256: str
    records: tuple[SysmonRecord, ...]
    events: tuple[ReplayEvent, ...]
    diagnostics: tuple[SysmonDiagnostic, ...]


def _read_local(path: Path) -> bytes:
    try:
        if path.as_posix().startswith("//"):
            raise SysmonImportError("Sysmon capture must be a local file.")
        path = path.resolve(strict=True)
        if path.as_posix().startswith("//") or not path.is_file():
            raise SysmonImportError("Sysmon capture must be a regular local file.")
        with path.open("rb") as stream:
            data = stream.read(MAX_FILE_BYTES + 1)
    except SysmonImportError:
        raise
    except (OSError, RuntimeError, ValueError):
        raise SysmonImportError("Unable to read Sysmon capture.") from None
    if not data or len(data) > MAX_FILE_BYTES:
        raise SysmonImportError(
            "Sysmon capture is empty or exceeds the file size limit."
        )
    return data


def _parse(line: str) -> ET.Element:
    if len(line.encode("utf-8")) > MAX_RECORD_BYTES:
        raise _RecordError("record_too_large", "Event")
    # The observed format has no XML declarations, DTDs, comments or PIs.
    if "<!" in line or "<?" in line:
        raise _RecordError("unsupported_xml_markup", "Event")
    try:
        root = ET.fromstring(line)
    except ET.ParseError:
        raise _RecordError("malformed_xml", "Event") from None
    if root.tag != _NS + "Event":
        raise _RecordError("unsupported_xml_root", "Event")
    nodes = [(root, 1)]
    while nodes:
        node, depth = nodes.pop()
        if depth > MAX_NESTING_DEPTH:
            raise _RecordError("nesting_limit", "Event")
        nodes.extend((child, depth + 1) for child in node)
    return root


def _element(parent: ET.Element, tag: str, field: str) -> ET.Element | None:
    nodes = parent.findall(_NS + tag)
    if len(nodes) > 1:
        raise _RecordError("duplicate_field", field)
    return nodes[0] if nodes else None


def _text(node: ET.Element, field: str) -> str | None:
    if len(node):
        raise _RecordError("malformed_field", field)
    return node.text


def _required(values: Mapping[str, str | None], field: str) -> str:
    if field not in values:
        raise _RecordError("missing_field", field)
    value = values[field]
    if value is None:
        raise _RecordError("null_field", field)
    try:
        return _string(value, field, nonempty=True)
    except FixtureError:
        raise _RecordError("malformed_field", field) from None


def _retain(values: dict[str, str | None], field: str, value: str | None) -> None:
    if value is not None:
        try:
            _string(value, field)
        except FixtureError:
            raise _RecordError("malformed_field", field) from None
    values[field] = value


def _system(root: ET.Element, source: dict[str, str | None]) -> None:
    system = _element(root, "System", "System")
    if system is None:
        raise _RecordError("missing_field", "System")
    for tag in ("EventID", "EventRecordID", "Channel", "Computer"):
        field = f"System/{tag}"
        node = _element(system, tag, field)
        if node is not None:
            _retain(source, field, _text(node, field))
    for tag, attribute in (("Provider", "Name"), ("TimeCreated", "SystemTime")):
        field = f"System/{tag}/@{attribute}"
        node = _element(system, tag, field)
        if node is not None and attribute in node.attrib:
            _retain(source, field, node.attrib[attribute] or None)


def _event_data(root: ET.Element, source: dict[str, str | None]) -> None:
    container = _element(root, "EventData", "EventData")
    if container is None:
        raise _RecordError("missing_field", "EventData")
    names = set()
    for node in container:
        name = node.get("Name")
        if node.tag != _NS + "Data" or not name or node.attrib.keys() != {"Name"}:
            raise _RecordError("malformed_field", "EventData/Data")
        try:
            _string(name, "EventData/Data/@Name", nonempty=True)
        except FixtureError:
            raise _RecordError("malformed_field", "EventData/Data/@Name") from None
        if name in names:
            raise _RecordError("duplicate_field", "EventData/Data")
        names.add(name)
        if name in ("UtcTime", "Image", "CommandLine"):
            field = f"EventData/{name}"
            _retain(source, field, _text(node, field))


def _convert(
    root: ET.Element,
    ordinal: int,
    source: dict[str, str | None],
    seen: set[str],
    diagnostics: list[SysmonDiagnostic],
) -> ReplayEvent:
    _system(root, source)
    if _required(source, "System/Provider/@Name") != _PROVIDER:
        raise _RecordError("unsupported_provider", "System/Provider/@Name")
    if _required(source, "System/Channel") != _CHANNEL:
        raise _RecordError("unsupported_channel", "System/Channel")
    record_id = _required(source, "System/EventRecordID")
    if not _UNSIGNED.fullmatch(record_id) or record_id == "0":
        raise _RecordError("malformed_field", "System/EventRecordID")
    if record_id in seen:
        raise _RecordError("duplicate_record_id", "System/EventRecordID")
    seen.add(record_id)
    event_id = _required(source, "System/EventID")
    if not _UNSIGNED.fullmatch(event_id):
        raise _RecordError("malformed_field", "System/EventID")
    if event_id != "1":
        raise _RecordError("unsupported_event_id", "System/EventID")
    field = "System/TimeCreated/@SystemTime"
    system_time = _required(source, field)
    if not _SYSTEM_TIME.fullmatch(system_time):
        raise _RecordError("invalid_timestamp", field)
    try:
        # Validate the date and time while retaining the full source precision.
        _utc_timestamp(system_time[:26] + "Z", field)
    except FixtureError:
        raise _RecordError("invalid_timestamp", field) from None

    _event_data(root, source)
    field = "EventData/UtcTime"
    recorded = _required(source, field)
    if not _UTC_TIME.fullmatch(recorded):
        raise _RecordError("invalid_timestamp", field)
    try:
        event_time = _utc_timestamp(recorded.replace(" ", "T") + "Z", field)
    except FixtureError:
        raise _RecordError("invalid_timestamp", field) from None

    fields: dict[str, str | None] = {
        "event_type": "process_creation",
        "source": _CHANNEL,
    }
    for key, source_field in (
        ("hostname", "System/Computer"),
        ("process_name", "EventData/Image"),
        ("command_line", "EventData/CommandLine"),
    ):
        if source_field not in source:
            diagnostics.append(
                SysmonDiagnostic(ordinal, "warning", "missing_field", source_field)
            )
            continue
        value = source[source_field]
        if value is None:
            diagnostics.append(
                SysmonDiagnostic(ordinal, "warning", "null_field", source_field)
            )
        fields[key] = value
    return ReplayEvent(
        record_id, event_time, recorded, ordinal, MappingProxyType(fields)
    )


def load_sysmon_telemetry(path: Path) -> SysmonImport:
    """Read one UTF-8 XML Event per physical line, preserving zero-based ordinals."""
    raw = _read_local(path)
    try:
        document = raw.decode("utf-8")
    except UnicodeDecodeError:
        raise SysmonImportError("Sysmon capture is not valid UTF-8.") from None
    lines = document.split("\n", MAX_EVENTS + 1)
    if lines[-1] == "":
        lines.pop()
    if len(lines) > MAX_EVENTS:
        raise SysmonImportError("Sysmon capture exceeds the event count limit.")

    diagnostics: list[SysmonDiagnostic] = []
    records: list[SysmonRecord] = []
    events: list[ReplayEvent] = []
    seen: set[str] = set()
    for ordinal, line in enumerate(lines):
        source: dict[str, str | None] = {}
        event = None
        try:
            event = _convert(_parse(line), ordinal, source, seen, diagnostics)
        except _RecordError as exc:
            diagnostics.append(SysmonDiagnostic(ordinal, "error", exc.code, exc.field))
        if event is not None:
            events.append(event)
        records.append(SysmonRecord(ordinal, MappingProxyType(source), event))
    return SysmonImport(
        MAPPING_VERSION,
        hashlib.sha256(raw).hexdigest(),
        tuple(records),
        tuple(sorted(events, key=lambda event: (event.event_time, event.ordinal))),
        tuple(diagnostics),
    )
