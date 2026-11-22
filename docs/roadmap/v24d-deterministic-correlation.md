# v2.4-D deterministic authentication correlation

The offline `auth-brute-force-offline/v1` evaluator reports five
qualifying authentication failures for the same username and source IP
within a five-minute event-time window. It uses a run-local deque per
group and emits immutable match records. [Implementation](../../backend/app/services/auth_correlation.py)

## Input contract

The separate JSON envelope requires `fixture_type: "authentication-correlation"`,
integer `schema_version: 1`, a nonblank `fixture_id`, `provenance` with a
nonblank `source`, and 1–1,000 `events`. Input is a local regular file
with at most 1 MiB of UTF-8 JSON, nesting depth 8, and string fields
bounded to 4,096 UTF-8 bytes. Duplicate keys and unexpected fields fail
validation. Historical ReplayFixture v1 keeps its existing contract.

| Required event field | Contract |
|---|---|
| `event_id` | Nonblank, case-sensitive ID, unique across the fixture |
| `event_time` | Explicit known UTC offset or Z, with up to six fractional digits and a representable five-minute UTC lookback |
| `event_type` | Exact string `authentication` |
| `username` | Nonblank string, grouped exactly as recorded |
| `source_ip` | Unscoped IPv4 or IPv6 address, grouped by the exact supplied spelling |
| `outcome` | Lowercase `failure`, `failed`, `denied` or `invalid` qualifies. `success` is accepted and ignored. |

Missing, null, invalid and unsupported required values reject the
fixture. The input array position defines a stable zero-based source
ordinal. The loader retains the source timestamp and sorts by
normalized UTC timestamp, then source ordinal.

## Window and triggering

At each qualifying failure at event time `t`, expire failures strictly
earlier than `t - 5 minutes` from that exact username/IP group. The
window is closed at both ends. At tied timestamps, only already
processed events and the current event can contribute. A success
neither counts nor resets the group.

Append the triggering event and emit a match if the count has risen
from four to five. A sixth in-window failure emits no second match.
Expiry rearms the rule once fewer than five prior failures remain,
including when that drop is first observed at the next qualifying
event. A single fixture bounds the number of retained failures and
groups. Every invocation starts with fresh state.

The live rule also uses the inclusive five-minute range and the same
four failure spellings. It lowercases operational event types and
stringified outcomes, queries the database for qualifying history, and
may create an alert when the count is exactly five. The offline rule
validates an explicit lowercase outcome and evaluates only its sorted
fixture prefix. Stable tie-breaking, fixture validation, suppression
and rearming are defined for this offline contract. [Operational reference](../../backend/app/services/detection_engine.py)

## Identity and output

The input SHA-256 covers the discriminator, schema version, fixture
ID, provenance source and all event fields, including normalized UTC
times and source ordinals. Equivalent timestamp offsets and JSON
presentation produce the same digest. Reordering source records or
changing a meaningful field changes it.

The output envelope records `auth-brute-force`, the evaluator contract,
fixture ID and input digest, event count and ordered matches. Each
match preserves the trigger ID, all five contributing event IDs in
evaluation order, and the closed UTC window. The group identifier is
the source ordinal of the group's first qualifying failure in this
fixture. It remains stable across rearming within that fixture.
Usernames, IPs, source metadata and raw event bodies are omitted from
the output. Fixture and event IDs should be non-sensitive because the
output retains them.

Both identities use sorted-key compact JSON with ASCII escapes encoded
as UTF-8. The output SHA-256 hashes the envelope before adding
`output_sha256`. The CLI emits one JSON document without a trailing
newline and exits 0 for successful evaluation. Invalid input exits 2
with a diagnostic on stderr.

## Reproduce offline

From `backend` using the documented Python 3.12 environment:

```powershell
.\.venv\Scripts\python.exe -B -m app.services.auth_correlation tests/fixtures/authentication-correlation.json
.\.venv\Scripts\python.exe -m pytest -q --noconftest tests/test_auth_correlation.py
```

The synthetic fixture has eight events. Its one match is triggered by
`threshold` at 12:05 UTC and references `first`, `second`, `third`,
`fourth`, and `threshold`. The first failure is exactly five minutes
before the trigger. The sixth failure shares the trigger's timestamp
and is processed later by source ordinal. The focused suite passed
**29 tests in 1.73 seconds**. [Synthetic fixture](../../backend/tests/fixtures/authentication-correlation.json) · [Tests](../../backend/tests/test_auth_correlation.py)

The database-free backend regression suite passed **395 tests in
55.77 seconds**, with one Starlette test-client deprecation warning.
It covered historical replay evidence and rule versions, the v2.3
regression proof, v2.4-A/B artifact verification, and the Sigma subset.
Black passed for both new Python files.

The observed input SHA-256 was
`9ece53bac4e149ae2e6a13a81ed905a4092798db90a695238c11a4574fcf7cc9`.
The output SHA-256 was
`f3d44b088a3a1855e52ec9ce23834488842ba331f1ab50a23c1e5fb910cb1a0f`.

The result demonstrates one fixed synthetic scenario. External
authentication mapping and labeled evidence, correlation grading,
streaming windows and general Sigma correlation remain future work.
