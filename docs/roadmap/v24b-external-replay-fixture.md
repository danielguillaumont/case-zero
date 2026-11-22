# v2.4-B external replay fixture integration

The offline converter reads the bounded v2.4-A Sysmon capture, verifies
its byte digest, applies the conversion policy, and emits a replay
fixture and a versioned conversion report. The fixture passes the same
v1 parser as historical fixtures. Verification rebuilds the pair from
the trusted source digest and compares both files byte-for-byte.
[Converter](../../backend/app/services/sysmon_replay_fixture.py) · [Fixture](../../backend/tests/fixtures/external/splunk-ads-abuse/replay-v1/fixture.json) · [Conversion report](../../backend/tests/fixtures/external/splunk-ads-abuse/replay-v1/conversion.json)

## Source and identities

The source is the checked-in sanitized Splunk Attack Data capture
`datasets/attack_techniques/T1564.004/ads_abuse/ads_abuse_sysmon.log`
at `5879f5423e6c08df2b22b63f7b36e84866f9c51c`, credited to Steven Dick.
The report retains the upstream file, commit, dataset ID, original
digest and Apache-2.0 license attribution. v2.4-A records the original
Git LFS verification and redactions. [Source and sanitization](v24a-sysmon-compatibility.md#source-and-integrity) · [Bundled license](../../backend/tests/fixtures/external/splunk-ads-abuse/LICENSE)

| Identity | Value |
|---|---|
| Sanitized XML SHA-256 | `c164a062f6808e0121b476a335ebce1a7809b9b23f203c5afae8ae7951705094` |
| Fixture ID | `external-sysmon-xml-v1-c164a062f6808e0121b476a335ebce1a7809b9b23f203c5afae8ae7951705094` |
| Normalized v1 fixture SHA-256 | `4433f943edf9a499d7b7319d94aa62328ab759ab91579d5af5c1ad9884106289` |
| Fixture JSON byte SHA-256 | `fa4d58a9b86d3a0c6319130581de9db715ea277c64d2dbe17af177f6ac4a336a` |

The fixture ID contains the source digest and the converter version.
The v1 fixture provenance also records the mapper and exclusion policy.
The v1 normalized digest follows the existing canonical rules, including
fixture array ordinals. The separate file digest covers the serialized
JSON bytes. Exact verification also detects formatting changes and
sidecar edits even if the normalized fixture digest is unchanged.

## Counts, ordering and policy

The conversion accounts for **13 source records, 5 accepted, 8
unsupported, and 0 rejected**. Accepted records are emitted in
normalized UTC order with source ordinal as the tie-breaker. The v1
loader assigns dense ordinals from the generated array. The report
retains each source ordinal and record ID, the available timestamp
provenance, and the replay ordinal or null for an excluded record.

| Source ordinal | Sysmon record ID | Replay ordinal |
|---:|---|---:|
| 0 | 362120 | 4 |
| 1 | 361146 | 3 |
| 2 | 361131 | 2 |
| 3 | 361080 | 1 |
| 12 | 357234 | 0 |

Policy `exclude-sysmon-event-id-15/v1` allows the mapper's
`unsupported_event_id` diagnostic only for Event ID 15. The report
retains all eight exclusions at source ordinals 4–11 and preserves
the mapper's original severity. The mapper checks their provider,
channel and unique identity before marking the type unsupported.
Their event payloads are outside the process-creation mapping.

Optional missing and null fields remain distinct and their warnings
carry source ordinals. A malformed record, duplicate identity, other
unsupported type, incompatible mapper, source integrity failure, or
empty accepted set blocks the build. Rejection diagnostics are returned
with the error and printed by the CLI when available. A build that
fails input validation publishes neither artifact. Verification rejects
an incomplete pair.

## Reproduce offline

From `backend`, using the documented Python 3.12 virtual environment,
choose a **new** output directory and run the following in PowerShell.

```powershell
$source = 'tests/fixtures/external/splunk-ads-abuse/ads-abuse.sanitized.xml'
$output = 'sysmon-replay-out'
.\.venv\Scripts\python.exe -B -m app.services.sysmon_replay_fixture build $source $output
.\.venv\Scripts\python.exe -B -m app.services.sysmon_replay_fixture verify $source $output
.\.venv\Scripts\python.exe -B -m app.services.replay_harness "$output/fixture.json"
```

The build and verifier print the normalized fixture SHA-256. The
existing replay harness completed with five non-matches and zero
errors. All five accepted events have null command lines in the
sanitized source. These outcomes demonstrate replay compatibility
with the available fields. The capture has no verified per-event
labels, so no external grading or benign classification was performed.

## Next gate

v2.4-C can investigate a narrow external rule subset with explicit
rejection of unsupported syntax. A later external grading proof needs
independently reviewed labels and preserved evidence for the fields
the rule evaluates. Multi-event correlation remains a separate gate.
