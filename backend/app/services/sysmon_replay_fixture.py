"""Build and verify an offline v1 replay fixture and Sysmon conversion report."""

import argparse
import hashlib
import json
import re
import sys
from dataclasses import asdict, dataclass
from pathlib import Path

from app.services.replay_fixtures import ReplayFixture, parse_replay_fixture
from app.services.sysmon_telemetry import (
    MAPPING_VERSION,
    SysmonDiagnostic,
    SysmonImportError,
    load_sysmon_telemetry,
)

SAMPLE_SHA256 = "c164a062f6808e0121b476a335ebce1a7809b9b23f203c5afae8ae7951705094"
FIXTURE_NAME = "fixture.json"
REPORT_NAME = "conversion.json"
_POLICY = "exclude-sysmon-event-id-15/v1"
_SAMPLE_PROVENANCE = {
    "repository": "splunk/attack_data",
    "commit": "5879f5423e6c08df2b22b63f7b36e84866f9c51c",
    "path": "datasets/attack_techniques/T1564.004/ads_abuse/ads_abuse_sysmon.log",
    "dataset_id": "e18714c0-ab84-44f6-9117-5531e3eb3a0c",
    "author": "Steven Dick",
    "license": "Apache-2.0",
    "original_sha256": "6345b116bfd31b233a639a9699b2b9374e82cd9ef680e750b84b9d087fd9e2b1",
    "sanitized": True,
}


class ConversionError(ValueError):
    """A source or artifact failed the conversion contract."""

    def __init__(self, message: str, diagnostics: tuple[SysmonDiagnostic, ...] = ()):
        super().__init__(message)
        self.diagnostics = diagnostics


@dataclass(frozen=True, slots=True)
class SysmonReplayArtifacts:
    fixture: ReplayFixture
    fixture_json: bytes
    report_json: bytes


def _json_bytes(payload: dict) -> bytes:
    return (
        json.dumps(payload, sort_keys=True, ensure_ascii=True, indent=2) + "\n"
    ).encode("utf-8")


def convert_sysmon_fixture(
    source: Path, *, expected_source_sha256: str = SAMPLE_SHA256
) -> SysmonReplayArtifacts:
    """Convert a local capture that matches an independently provided digest."""
    if type(expected_source_sha256) is not str or not re.fullmatch(
        r"[0-9a-f]{64}", expected_source_sha256
    ):
        raise ConversionError("Expected source digest must be lowercase SHA-256.")
    try:
        capture = load_sysmon_telemetry(source)
    except SysmonImportError as exc:
        raise ConversionError(str(exc)) from exc
    if capture.source_sha256 != expected_source_sha256:
        raise ConversionError("Source SHA-256 mismatch.")
    if capture.mapping_version != MAPPING_VERSION:
        raise ConversionError("Unsupported Sysmon mapping version.")

    excluded = {
        record.ordinal
        for record in capture.records
        if record.source_fields.get("System/EventID") == "15"
    }
    unsupported = {
        diagnostic.ordinal
        for diagnostic in capture.diagnostics
        if diagnostic.code == "unsupported_event_id" and diagnostic.ordinal in excluded
    }
    rejected = len(capture.records) - len(capture.events) - len(unsupported)
    if rejected:
        raise ConversionError(
            f"Conversion blocked by {rejected} rejected source record(s).",
            capture.diagnostics,
        )
    if not capture.events:
        raise ConversionError(
            "No eligible Sysmon process-creation records.", capture.diagnostics
        )

    fixture_id = f"external-sysmon-xml-v1-{capture.source_sha256}"
    fixture_json = _json_bytes(
        {
            "schema_version": 1,
            "fixture_id": fixture_id,
            "provenance": {
                "source": capture.mapping_version,
                "description": f"Sysmon capture SHA-256 {capture.source_sha256}; policy {_POLICY}.",
            },
            "events": [
                {
                    "event_id": event.event_id,
                    "event_time": event.event_time.isoformat(
                        timespec="microseconds"
                    ).replace("+00:00", "Z"),
                    "fields": dict(event.fields),
                }
                for event in capture.events
            ],
        }
    )
    fixture = parse_replay_fixture(fixture_json)
    replay_ordinals = {event.event_id: event.ordinal for event in fixture.events}
    report = {
        "schema_version": 1,
        "mapping_version": capture.mapping_version,
        "policy": _POLICY,
        "source_sha256": capture.source_sha256,
        "source_provenance": _SAMPLE_PROVENANCE
        if capture.source_sha256 == SAMPLE_SHA256
        else None,
        "fixture_id": fixture.fixture_id,
        "fixture_content_sha256": fixture.content_hash,
        "fixture_file_sha256": hashlib.sha256(fixture_json).hexdigest(),
        "counts": {
            "source": len(capture.records),
            "accepted": len(capture.events),
            "rejected": rejected,
            "unsupported": len(unsupported),
        },
        "records": [
            {
                "source_ordinal": record.ordinal,
                "source_record_id": record.source_fields.get("System/EventRecordID"),
                "source_event_id": record.source_fields.get("System/EventID"),
                "source_provider": record.source_fields.get("System/Provider/@Name"),
                "source_channel": record.source_fields.get("System/Channel"),
                "source_event_time": record.source_fields.get("EventData/UtcTime"),
                "source_system_time": record.source_fields.get(
                    "System/TimeCreated/@SystemTime"
                ),
                "replay_ordinal": replay_ordinals.get(record.event.event_id)
                if record.event
                else None,
                "status": "unsupported"
                if record.ordinal in unsupported
                else "accepted",
            }
            for record in capture.records
        ],
        "diagnostics": [asdict(diagnostic) for diagnostic in capture.diagnostics],
    }
    return SysmonReplayArtifacts(fixture, fixture_json, _json_bytes(report))


def _local_directory(path: Path) -> Path:
    if path.as_posix().startswith("//"):
        raise ConversionError("Artifact directory must be local.")
    path = path.resolve()
    if path.as_posix().startswith("//"):
        raise ConversionError("Artifact directory must be local.")
    return path


def verify_sysmon_artifacts(
    source: Path, directory: Path, *, expected_source_sha256: str = SAMPLE_SHA256
) -> ReplayFixture:
    """Rebuild from the trusted source digest and verify both exact artifact files."""
    expected = convert_sysmon_fixture(
        source, expected_source_sha256=expected_source_sha256
    )
    directory = _local_directory(directory)
    for name, content in (
        (FIXTURE_NAME, expected.fixture_json),
        (REPORT_NAME, expected.report_json),
    ):
        path = (directory / name).resolve()
        if path.as_posix().startswith("//") or not path.is_file():
            raise ConversionError(f"Missing or nonlocal artifact: {name}.")
        try:
            with path.open("rb") as stream:
                actual = stream.read(len(content) + 1)
        except OSError:
            raise ConversionError(f"Could not read artifact: {name}.") from None
        if actual != content:
            raise ConversionError(f"Artifact does not match regenerated bytes: {name}.")
    return expected.fixture


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("build", "verify"))
    parser.add_argument("source", type=Path)
    parser.add_argument("directory", type=Path)
    args = parser.parse_args(argv)
    try:
        if args.action == "build":
            artifacts = convert_sysmon_fixture(args.source)
            directory = _local_directory(args.directory)
            directory.mkdir()
            for name, content in (
                (FIXTURE_NAME, artifacts.fixture_json),
                (REPORT_NAME, artifacts.report_json),
            ):
                with (directory / name).open("xb") as stream:
                    stream.write(content)
            fixture = artifacts.fixture
        else:
            fixture = verify_sysmon_artifacts(args.source, args.directory)
    except (OSError, RuntimeError, ValueError) as exc:
        print(str(exc), file=sys.stderr)
        if isinstance(exc, ConversionError):
            for diagnostic in exc.diagnostics:
                print(json.dumps(asdict(diagnostic), sort_keys=True), file=sys.stderr)
        return 1
    print(fixture.content_hash)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
