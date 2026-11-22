# v2.6-F replay run state machine

The database-free v1 contract implements the first slice of
[ADR 006](v26e-persistent-execution-design.md). Each transition consumes a
current immutable snapshot and returns a new snapshot. Callers supply clocks,
UUIDs, and the owner eligibility decision used for retry.
[Implementation](../../backend/app/services/replay_run_state.py)

## Identity and admission

`RunRequest` freezes the owner UUID, idempotency key, fixture ID and schema,
fixture and expectation-set digests, authoring and requested rule version IDs,
evaluator contract, and limits profile. V1 admits the pinned synthetic Encoded
PowerShell bundle and the two existing built-in versions. The state contract
matches those identities. A future executor must still load and verify the
actual assets and execution output. Fixture order and grade ordering remain
owned by the existing replay services.

The SHA-256 request fingerprint covers owner, schema, pinned source and rule
identities, evaluator contract and limits profile. It uses sorted-key compact
JSON with ASCII escapes encoded as UTF-8. The client key is excluded from the
fingerprint and is scoped separately by owner and schema version. Keys are 1–64
ASCII letters, digits, `.`, `_`, or `-`, with an alphanumeric first character.
The pure decision returns `CREATE` for no scoped match, `EXISTING` for the same
fingerprint, and `CONFLICT` for a different fingerprint. Passing a stored
request outside the scope is a caller error. The caller must enforce uniqueness
and decide reuse before quotas. Keys and lease tokens are excluded from reprs
and diagnostics. The records are internal persistence inputs and must not be
serialized directly to HTTP or audit logs.

## Transition matrix

| Current | Permitted next state | Condition |
| --- | --- | --- |
| New | `QUEUED` | Valid admission identities and caller admission checks |
| `QUEUED` | `RUNNING` | Claim strictly before the queue deadline with a fresh lease token |
| `QUEUED` | `CANCELLED`, `EXPIRED` | Explicit cancellation or observed inactive owner, or expiry at/after the queue deadline |
| `RUNNING` | `COMPLETED` | Valid current lease and evidence for the requested version, with no cancellation pending |
| `RUNNING` | `FAILED`, `CANCELLED` | A terminal failure, ineligible retry, or cancellation resolved by the current executor or lease reconciliation |
| `RUNNING` | `QUEUED` | Classified transient infrastructure failure or expired-lease recovery, with active owner, remaining attempt budget and time before the queue deadline |
| `COMPLETED`, `FAILED`, `CANCELLED` | `EXPIRED` | At or after the retention deadline, with evidence references removed |
| `EXPIRED` | None | Tombstone purge is a separate repository operation |

Other edges fail. A cancellation request on an already terminal snapshot returns
that snapshot unchanged. A queued cancellation selects the cancellation edge
while the run is still queued. A running cancellation records intent without
releasing the lease. Pending intent wins over unpublished results and retry.
Completion accepted first remains terminal. Cancellation, failure and expiry
carry no partial evidence. A completed run may legitimately have `passed=False`
in its grade. The evidence reference binds the executed version, grade schema,
grade SHA-256 and evidence SHA-256. The state machine validates identities and
does not verify bytes, grade correctness or execution authenticity.

## Attempts, clocks and failures

Attempts are numbered 1 and 2 and retain their original run UUID, attempt
number, lease token and start time. A lease lasts 30 seconds from claim. At
the exact lease deadline the executor loses authority and explicit recovery
becomes eligible. Recovery closes the current attempt before a later claim
can create a second one. The 10-second execution target is metadata for a
future supervisor. A claim just before the 10-minute queue deadline can
finish under its lease after that queue deadline. New claims and retries at
the queue deadline are blocked.

Time comes from injected `datetime` values with Python's fixed zero-offset
`timezone` (typically `datetime.UTC`). Transitions reject earlier times than
recorded history. Terminal records have a retention deadline seven days after
finish. Expiry records a tombstone date, with purge eligibility seven
days after expiry. The snapshot keeps bounded history for validation. The
repository must define its minimal tombstone projection, purge data and enforce
read expiry even when a reconciliation process has not yet run.

| Codes | Meaning |
| --- | --- |
| `TRANSIENT_INFRASTRUCTURE`, `LEASE_LOST` | Retryable attempt outcomes, subject to owner, time and attempt guards |
| `RETRY_EXHAUSTED`, `QUEUE_DEADLINE` | Run-level rejection of a retry after the budget or admission window closes |
| `EXECUTION_TIMEOUT`, `INVALID_INPUT`, `UNSUPPORTED_EXECUTION`, `EVALUATION_ERROR` | Terminal execution failures |
| `CANCEL_REQUESTED`, `OWNER_INACTIVE` | Cancellation reasons |

## Persistence handoff

The module does no database, network, process or operational I/O. Pure lease
validation only fences against the snapshot supplied. A stale stored snapshot
can still appear valid in isolation. PostgreSQL must load the latest snapshot
under lock, enforce the owner/version/key uniqueness and global/owner quotas,
source the transaction clock, atomically commit attempts/results and apply
expiry. Authentication, object authorization, process timeouts, lease recovery
invocation and verified evidence storage all need separate implementation tests.

## Verification

From `backend`, using the existing Python virtual environment:

```powershell
.\.venv\Scripts\python.exe -m pytest -q --noconftest tests/test_replay_run_state.py
.\.venv\Scripts\python.exe -m pytest -q --noconftest tests/test_replay_evaluator.py tests/test_rule_versions.py tests/test_replay_rule_binding.py tests/test_replay_grading.py tests/test_replay_summary.py tests/test_replay_comparison.py tests/test_replay_evidence.py tests/test_replay_regression_proof.py tests/test_replay_proof_export.py tests/test_replay_proof_verify.py
black --check app/services/replay_run_state.py tests/test_replay_run_state.py
flake8 --max-line-length 95 app/services/replay_run_state.py tests/test_replay_run_state.py
```

The focused suite passed 72 tests, including the transition matrix and a
fresh-process determinism and side-effect check. The existing offline suite
passed 238 tests. Neither run reported warnings or skips. Black and targeted
Flake8 passed. PostgreSQL and Docker were outside this slice.
[Focused tests](../../backend/tests/test_replay_run_state.py)
