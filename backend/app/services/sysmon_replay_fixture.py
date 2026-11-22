"""Build and verify an offline v1 replay fixture and Sysmon conversion report."""

import argparse
import errno
import hashlib
import json
import os
import re
import stat
import sys
from tempfile import TemporaryDirectory
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


def _is_link(info: os.stat_result) -> bool:
    return stat.S_ISLNK(info.st_mode) or bool(
        getattr(info, "st_file_attributes", 0) & stat.FILE_ATTRIBUTE_REPARSE_POINT
    )


def _artifact_path(path: Path) -> Path:
    if (
        path.as_posix().startswith("//")
        or ".." in path.parts
        or (path.anchor and not path.is_absolute())
    ):
        raise ConversionError(
            "Artifact path must be local and cannot contain parent traversal."
        )
    absolute = path.absolute()
    if absolute.as_posix().startswith("//"):
        raise ConversionError("Artifact path must be local.")
    return absolute


def _check_directory(path: Path) -> None:
    for directory in (*reversed(path.parents), path):
        try:
            info = directory.lstat()
        except OSError:
            raise ConversionError(
                "Artifact directory or parent is unavailable."
            ) from None
        if _is_link(info) or not stat.S_ISDIR(info.st_mode):
            raise ConversionError(
                "Artifact directory and parents must be real directories."
            )


def _pair(artifacts: SysmonReplayArtifacts) -> tuple[tuple[str, bytes], ...]:
    return (
        (FIXTURE_NAME, artifacts.fixture_json),
        (REPORT_NAME, artifacts.report_json),
    )


def _verify_pair(directory: Path, expected: SysmonReplayArtifacts) -> None:
    for name, content in _pair(expected):
        path = directory / name
        try:
            info = path.lstat()
            if _is_link(info) or not stat.S_ISREG(info.st_mode):
                raise ConversionError(f"Missing or nonlocal artifact: {name}.")
            with path.open("rb") as stream:
                actual = stream.read(len(content) + 1)
        except FileNotFoundError:
            raise ConversionError(f"Missing or nonlocal artifact: {name}.") from None
        except OSError:
            raise ConversionError(f"Could not read artifact: {name}.") from None
        if actual != content:
            raise ConversionError(f"Artifact does not match regenerated bytes: {name}.")


def _rename_noreplace(stage: Path, destination: Path) -> None:
    if os.name == "nt":
        os.rename(stage, destination)
        return
    if sys.platform == "linux":
        # Plain POSIX rename can replace an empty directory. Request Linux's
        # no-replace semantics in the same operation as publication.
        import ctypes

        libc = ctypes.CDLL(None, use_errno=True)
        renameat2 = getattr(libc, "renameat2", None)
        if renameat2 is not None:
            renameat2.argtypes = [
                ctypes.c_int,
                ctypes.c_char_p,
                ctypes.c_int,
                ctypes.c_char_p,
                ctypes.c_uint,
            ]
            renameat2.restype = ctypes.c_int
            if (
                renameat2(-100, os.fsencode(stage), -100, os.fsencode(destination), 1)
                == 0
            ):
                return
            error = ctypes.get_errno()
            if error == errno.EEXIST:
                raise FileExistsError(error, "Destination already exists.")
            raise OSError(error, os.strerror(error))
    raise ConversionError("Atomic no-replace directory publication is unavailable.")


def publish_sysmon_artifacts(source: Path, directory: Path) -> ReplayFixture:
    """Build privately and publish the verified pair at a new destination."""
    artifacts = convert_sysmon_fixture(source)
    destination = _artifact_path(directory)
    _check_directory(destination.parent)
    try:
        destination.lstat()
    except FileNotFoundError:
        pass
    else:
        raise ConversionError("Artifact destination already exists.")
    try:
        with TemporaryDirectory(
            prefix=".sysmon-stage-", dir=destination.parent
        ) as staging:
            stage = Path(staging)
            for name, content in _pair(artifacts):
                with (stage / name).open("xb") as stream:
                    stream.write(content)
            _verify_pair(stage, artifacts)
            _rename_noreplace(stage, destination)
    except FileExistsError:
        raise ConversionError("Artifact destination already exists.") from None
    except OSError:
        raise ConversionError(
            "Artifact publication failed during staging or atomic rename."
        ) from None
    return artifacts.fixture


def verify_sysmon_artifacts(
    source: Path, directory: Path, *, expected_source_sha256: str = SAMPLE_SHA256
) -> ReplayFixture:
    """Rebuild from the trusted source digest and verify both exact artifact files."""
    expected = convert_sysmon_fixture(
        source, expected_source_sha256=expected_source_sha256
    )
    directory = _artifact_path(directory)
    _check_directory(directory)
    _verify_pair(directory, expected)
    return expected.fixture


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("build", "verify"))
    parser.add_argument("source", type=Path)
    parser.add_argument("directory", type=Path)
    args = parser.parse_args(argv)
    try:
        if args.action == "build":
            fixture = publish_sysmon_artifacts(args.source, args.directory)
        else:
            fixture = verify_sysmon_artifacts(args.source, args.directory)
    except (RuntimeError, ValueError) as exc:
        print(str(exc), file=sys.stderr)
        if isinstance(exc, ConversionError):
            for diagnostic in exc.diagnostics:
                print(json.dumps(asdict(diagnostic), sort_keys=True), file=sys.stderr)
        return 1
    except OSError:
        print("Artifact filesystem operation failed.", file=sys.stderr)
        return 1
    print(fixture.content_hash)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
