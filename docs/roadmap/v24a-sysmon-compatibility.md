# v2.4-A Sysmon telemetry compatibility

## Source and integrity

The sample is derived from Splunk Attack Data's
`datasets/attack_techniques/T1564.004/ads_abuse/ads_abuse_sysmon.log` at
`5879f5423e6c08df2b22b63f7b36e84866f9c51c`. The descriptor credits Steven
Dick and identifies a Splunk Attack Range lab capture for NTFS alternate
data stream behavior, dataset ID `e18714c0-ab84-44f6-9117-5531e3eb3a0c`.
Its metadata date is 2023-10-30, while the records contain UTC event
times from 2023-11-10. The descriptor identifies the scenario and does
not provide per-event attack or benign labels.
[Pinned descriptor](https://raw.githubusercontent.com/splunk/attack_data/5879f5423e6c08df2b22b63f7b36e84866f9c51c/datasets/attack_techniques/T1564.004/ads_abuse/ads_abuse.yml)

The pinned dataset directory contains the descriptor and log. The
descriptor lists no separate dataset license, and the repository's
Apache-2.0 license applies. Attribution is to Splunk Attack Data and the
credited dataset author. The upstream license accompanies the modified
sample. [Upstream license](https://raw.githubusercontent.com/splunk/attack_data/5879f5423e6c08df2b22b63f7b36e84866f9c51c/LICENSE) · [Bundled license](../../backend/tests/fixtures/external/splunk-ads-abuse/LICENSE)

| Bytes | Size | SHA-256 |
|---|---:|---|
| Original Git LFS object | 22,450 | `6345b116bfd31b233a639a9699b2b9374e82cd9ef680e750b84b9d087fd9e2b1` |
| Sanitized fixture | 6,280 | `c164a062f6808e0121b476a335ebce1a7809b9b23f203c5afae8ae7951705094` |

The downloaded original was checked against the LFS pointer's size and
SHA-256. The sanitized copy preserves all 13 source records in their
original order, with their IDs and timestamps. It retains only the six
System elements and three named EventData fields described below,
removes the provider GUID, replaces the host with
`splunk-lab-host.invalid`, keeps only the Windows image basename, and
replaces all present command lines with empty XML elements. The retained
XML is serialized as UTF-8 with one event per LF-terminated line. The
fixture's Git attributes prevent line-ending conversion.
[Pinned LFS pointer](https://raw.githubusercontent.com/splunk/attack_data/5879f5423e6c08df2b22b63f7b36e84866f9c51c/datasets/attack_techniques/T1564.004/ads_abuse/ads_abuse_sysmon.log) · [Pinned download](https://media.githubusercontent.com/media/splunk/attack_data/5879f5423e6c08df2b22b63f7b36e84866f9c51c/datasets/attack_techniques/T1564.004/ads_abuse/ads_abuse_sysmon.log) · [Sanitized fixture](../../backend/tests/fixtures/external/splunk-ads-abuse/ads-abuse.sanitized.xml)

## Mapping contract

`splunk-sysmon-xml/v1` reads UTF-8 XML with one `Event` per physical
line in the namespace `http://schemas.microsoft.com/win/2004/08/events/event`.
The mapper accepts Sysmon Operational Event ID 1. Results contain the
input SHA-256, records in source order with zero-based ordinals and
bounded source fields, conversion diagnostics, and immutable replay
events sorted by UTC time and ordinal.
[Mapper](../../backend/app/services/sysmon_telemetry.py) · [Microsoft Sysmon event reference](https://learn.microsoft.com/en-us/sysinternals/downloads/sysmon#events)

| Observed XML field | Mapping |
|---|---|
| `System/Provider/@Name` | Requires `Microsoft-Windows-Sysmon`. Retained in source provenance. |
| `System/Channel` | Requires `Microsoft-Windows-Sysmon/Operational`. Becomes `source`. |
| `System/EventID` | `1` becomes `process_creation`. Other numeric IDs are unsupported. |
| `System/EventRecordID` | Positive decimal string used as the event ID within this single capture. Later duplicates are rejected. |
| `System/TimeCreated/@SystemTime` | Validates the observed UTC timestamp form with 7–9 fractional digits. Retains the original string for accepted records. |
| `System/Computer` | Optional `hostname`. |
| `EventData/Data[@Name="UtcTime"]` | Requires `YYYY-MM-DD HH:MM:SS.mmm`. Interprets it as UTC and retains the original spelling. No timestamp fallback. |
| `EventData/Data[@Name="Image"]` | Optional `process_name`, preserving the supplied image string. |
| `EventData/Data[@Name="CommandLine"]` | Optional inert `command_line`, preserving the decoded XML text. |

Missing optional fields stay absent and empty elements become null.
Both are reported as warnings. Required missing, null, malformed and
unsupported values produce per-record errors. File size (1 MiB), record
count (1,000), record size (16 KiB), mapped field length (4,096 UTF-8
bytes), and XML depth (8) are bounded. Invalid UTF-8 stops the import.
The mapper rejects ambiguous duplicate mapped fields, repeated named
data, duplicate record identities, and XML declarations, DTDs and
processing instructions. The XML input has no JSON object keys. Unknown
field values are omitted from normalized output and provenance.

Event ID 15, other Sysmon types, other export formats, and joins across
captures are outside v1. The adapter returns replay-compatible event
objects without publishing a hashed replay fixture. The sanitized file
is a mapping check. Its removed command lines and lack of per-event
ground truth preclude grading or accuracy claims.

## Verification and next gate

The mapper accepted five process-creation records from the verified
original and reported eight unsupported Event ID 15 records. All five
original process records had command-line text. The sanitized asset
produced the same event identities and five null-command-line warnings.
The existing synthetic proof reproduced its expected FAIL/PASS pair.
The focused suite passed 22 tests in 0.32 s. The database-free backend
replay regression suite passed 295 tests in 37.14 s, with one Starlette
test-client deprecation warning. Black passed for both new Python files.
[Focused tests](../../backend/tests/test_sysmon_telemetry.py)

v2.4-B should define how an accepted external mapping becomes a
replayable, content-addressed fixture while retaining source identity,
ordinals and conversion diagnostics. Add independently reviewed labels
where there is sufficient evidence, and define which conversion errors
block replay before grading external data. The narrow external rule
subset and multi-event correlation remain separate v2.4 gates.
