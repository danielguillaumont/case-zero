# v2.4-E import hardening and milestone closeout

Baseline `8496f3dbcaf37a3c2d7073bd0fbd07a1b48c7243`.
This slice hardens offline artifact publication and closes the bounded
v2.4 implementation. Published releases and hosted behavior are outside
this change.

## Existing protections and gaps

The importer already bounded UTF-8 input, XML depth, record size and
count, and mapped field lengths. It rejected unsafe XML markup,
ambiguous fields, duplicate identities, and invalid process-creation
timestamps. The converter checked the source digest, blocked rejected
records, and regenerated the fixture and conversion report to verify
their exact bytes. Replay, Sigma, and correlation already had separate
validated input contracts. [Sysmon mapping](v24a-sysmon-compatibility.md) · [Fixture integration](v24b-external-replay-fixture.md)

The original CLI created the final directory before writing two files.
A failure during the second write could expose an incomplete pair.
Path resolution also followed links. Event ID 15 records could be
classified as unsupported before their common System timestamp was
validated.

## Changes and publication guarantees

- [sysmon_replay_fixture.py](../../backend/app/services/sysmon_replay_fixture.py) writes and verifies both files in a private temporary sibling directory, then publishes the complete directory in one no-replace rename. It rejects existing destinations, parent traversal, UNC paths, and linked or reparse-point directories. Verification rejects linked or non-regular artifact files before reading.
- [sysmon_telemetry.py](../../backend/app/services/sysmon_telemetry.py) validates the common System timestamp before classifying an event as unsupported.
- [test_sysmon_import_hardening.py](../../backend/tests/test_sysmon_import_hardening.py) covers second-write failure and retry, staged corruption, destination conflicts, links, timestamp errors on excluded records, invalid source hashes, and XML length and Unicode boundaries.
- [test_auth_correlation.py](../../backend/tests/test_auth_correlation.py) pins the previously recorded v2.4-D input and output hashes alongside the existing independent digest recomputation.
- This note records the final supported scope and open gates.

Staging is on the destination filesystem. Windows uses a no-replace
directory rename. Linux requires `renameat2(RENAME_NOREPLACE)`.
Platforms or filesystems without the required operation fail closed.
The rename protects an existing destination even if it appears after
preflight. Handled failures clean up the current invocation's staging
directory. The output parent must be a trusted local directory whose
permissions prevent untrusted users from replacing its contents or
ancestors. On Windows, staging can inherit the parent's ACL.

The guarantee concerns visibility of the complete pair on filesystems
that provide the required rename semantics. A process crash before
rename can leave an unpublished staging directory. This path does
not fsync files or directories and establishes no crash or power-loss
durability. It also establishes **no PostgreSQL transaction safety**
for a future authenticated dataset import API.

## Counts and diagnostics

The unchanged sample reports **13 source records, 5 accepted, 8
unsupported, and 0 rejected**. Only Event ID 15 with a valid common
Sysmon envelope may be excluded. Duplicate identities and malformed
records block publication. The existing report preserves source
ordinals, mapping and provenance, counts, and diagnostic codes.

| Diagnostic codes | Meaning |
|---|---|
| `record_too_large`, `nesting_limit` | Record exceeded a parser bound |
| `malformed_xml`, `unsupported_xml_markup`, `unsupported_xml_root` | XML was invalid or used an unsupported envelope |
| `missing_field`, `null_field`, `malformed_field`, `duplicate_field` | Field validation failed. Missing or null optional fields are warnings. |
| `invalid_timestamp`, `duplicate_record_id` | Timestamp or identity failed validation |
| `unsupported_provider`, `unsupported_channel`, `unsupported_event_id` | Record falls outside mapper scope |

Diagnostics identify source ordinals and field names without echoing
command lines or raw values. A verification failure rejects a missing,
linked, incomplete, oversized or altered pair. Hashes establish
consistency with the trusted source digest and mapping, not authorship.

## Supported feature matrix and exit gate

| Area | Verified support | Limits |
|---|---|---|
| External telemetry | One pinned Splunk Sysmon XML capture, Event ID 1 mapping, source provenance and deterministic replay conversion | Event ID 15 is reported and excluded. Other exports, providers and event types are outside the mapper. |
| External rule format | One-event Windows/Sysmon Sigma subset with three mapped fields, literal comparisons and named AND/OR selections | No general Sigma, correlation, arbitrary predicates, or external rule coverage claims. The demonstrated rule is CASE//ZERO-authored. |
| Authentication correlation | Fixed offline five-failure rule with deterministic event-time windows, exact grouping and rearming | The example is synthetic. External authentication mapping, streaming, and labeled correlation grading remain open. |
| Artifact publication | Offline same-filesystem staging, exact verification and atomic no-replace rename on supported filesystems | No crash durability, persistent authenticated imports, or database transaction guarantees. |

**The external Sysmon sample has sanitized command lines and no verified
per-event attack labels. It is mapping evidence and must not be presented
as external detection accuracy evidence.** The bounded offline v2.4
compatibility, correlation, and hardening work is complete for this
slice. The broader roadmap gate of an independently sourced rule with
reviewed external event outcomes still lacks evidence.
[Sigma subset](v24c-constrained-sigma.md) · [Synthetic correlation](v24d-deterministic-correlation.md)

Before v2.5 presents external results, retain and display source,
fixture, compiler/evaluator, and rule identities. Distinguish
unsupported, indeterminate, and failed imports from valid misses.
Require an independently reviewed external rule and evidence-backed
labels before external grading claims. Any authenticated import or
case pivot also needs its own authorization, transaction and rollback
tests, with operational alert isolation.

## Reproduction and preserved identities

From `backend` in the local Python 3.12 environment:

```powershell
$source = 'tests/fixtures/external/splunk-ads-abuse/ads-abuse.sanitized.xml'
$output = 'sysmon-replay-out'
.\.venv\Scripts\python.exe -B -m app.services.sysmon_replay_fixture build $source $output
.\.venv\Scripts\python.exe -B -m app.services.sysmon_replay_fixture verify $source $output
.\.venv\Scripts\python.exe -B -m app.services.auth_correlation tests/fixtures/authentication-correlation.json
.\.venv\Scripts\python.exe -m pytest -q -rs --noconftest tests/test_sysmon_import_hardening.py
```

| Identity | SHA-256 |
|---|---|
| Sanitized Sysmon XML | `c164a062f6808e0121b476a335ebce1a7809b9b23f203c5afae8ae7951705094` |
| Normalized external replay fixture | `4433f943edf9a499d7b7319d94aa62328ab759ab91579d5af5c1ad9884106289` |
| External fixture file | `fa4d58a9b86d3a0c6319130581de9db715ea277c64d2dbe17af177f6ac4a336a` |
| Conversion report file | `a64a3b827b7195b21e072f1a291bef28bfd7ec41a1f19e7eb6d1c1ae79984a93` |
| Historical synthetic replay fixture | `025c8bb93536b73227406c8c74e2f64d8592350b328792147a77f628357beb6d` |
| Historical synthetic v1 CLI bytes | `f32268d29259b7cdb548573d3ef9985b4eddecdd5e4ad7f86fd8811bd29651a6` |
| Synthetic authentication fixture | `9ece53bac4e149ae2e6a13a81ed905a4092798db90a695238c11a4574fcf7cc9` |
| Synthetic authentication output digest | `f3d44b088a3a1855e52ec9ce23834488842ba331f1ab50a23c1e5fb910cb1a0f` |

The new focused suite passed **15 tests in 0.69 seconds**. The
database-free replay, import, Sigma, correlation, and configuration
safety suite passed **440 tests in 82.65 seconds**, with one Starlette
test-client deprecation warning. A separate database-free run of
security, RBAC, detection-engine and admin-bootstrap unit tests passed
**31 tests in 6.88 seconds**. Black, targeted Flake8 checks and
`git diff --check` passed. The native rename was exercised on Windows.
Linux publication and hosted CI were outside this local run.
