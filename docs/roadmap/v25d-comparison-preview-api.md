# v2.5-D authenticated comparison preview API

`GET /api/lab/comparison-preview` returns the existing v1 comparison
for the bundled synthetic Encoded PowerShell fixture. It uses the same
development/test-only replay preview gate and administrator/analyst role
dependency as `POST /api/lab/replay-preview`. The gate requires the explicit
process environment opt-in `CASE_ZERO_REPLAY_PREVIEW=true`. Production
keeps the route absent even with that flag set. No assets are read at
registration. [Route](../../backend/app/api/routes/comparison_preview.py)

## Request and response

The route accepts an authenticated GET with no query parameters or body.
The existing authentication and authorization paths retain their 401 and
403 responses and existing audit events. Unexpected input returns 400.

The 200 response is the canonical comparison JSON. Its strict Pydantic
response contract for schema v1 rejects extra fields, including nested fields. The result
contains fixture and expectation digests, authoring identity, requested
and executed identities for both versions, grading totals and pass flags,
candidate-minus-baseline deltas, per-expectation changes, and comparison
SHA-256. Success and unavailable responses include `Cache-Control: no-store`.
[Response schema](../../backend/app/schemas/comparison_preview.py) · [Comparison semantics](v25c-rule-version-comparison.md)

| Synthetic rule version | TP | TN | FP | FN | Labeled satisfaction | Passed |
|---|---:|---:|---:|---:|---:|---|
| Weakened baseline | 0 | 2 | 0 | 1 | 2/3 | false |
| Corrected candidate | 1 | 2 | 0 | 0 | 3/3 | true |

`encoded-switch` improves from false negative to true positive. The
two benign controls are unchanged, with zero regressions and zero
inconclusive results. The comparison SHA-256 is
`537a653234548dca4490997a4c344c4cbaa1673c1314b95357eefda55e7136a2`.

## Execution and failure handling

The handler reads only the two fixed bundled assets, each capped at 16 KiB.
It checks filesystem metadata and the normalized fixture and expectation
digests before running either rule. Both rule versions consume the same
validated snapshots. The loaded-input entry points share the existing
parsers and grader with the path-based offline APIs. Existing services
build the summaries and comparison.

The handler validates the 16 KiB response bound, strict schema and pinned
digest of the full canonical response before emitting any bytes. A failed
asset read, validation, evaluation or response check returns a fixed 503
with `{"detail":{"code":"comparison_preview_unavailable"}}`. The handler
does not echo internal exceptions, raw telemetry or rule literals.

Authentication may look up the account and record the existing denial
audits. The comparison handler itself makes no database calls, writes,
or outbound requests. The packaged assets are trusted deployment files
and should be protected from local mutation. Hashes verify content
consistency with the pinned proof. They do not establish independent
evidence authenticity.

## Verify locally

From `backend`, using the documented Python 3.12 environment:

```powershell
.\.venv\Scripts\python.exe -m pytest -q --noconftest tests/test_replay_preview_api.py
```

The tests exercise development/test registration and production exclusion
in isolated processes. Request tests use real token and role dependencies
with a mocked identity lookup and audit recorder. They block SQLAlchemy
connection and statement activity and outbound socket operations on the
success path. They also test byte-repeatable results, early asset rejection,
and sanitized failures. The original replay preview assertions remain.
[Preview tests](../../backend/tests/test_replay_preview_api.py)

The focused preview suite passed **54 tests in 22.82 seconds**, with one
Starlette test-client deprecation warning. An additional database-free
security, RBAC, detection-engine and bootstrap unit run passed **31 tests
in 3.63 seconds**.
The broader database-free replay and compatibility suite passed **539
tests in 68.04 seconds**, with the same Starlette warning. Historical
replay evidence, the v2.3 proof, Sysmon artifacts, authentication
correlation, Sigma, traces, summaries and comparisons passed. Black
passed on the two new Python modules and shared grader. Targeted Flake8
and `git diff --check` passed. PostgreSQL integration and hosted CI were
outside the local run.

The preview covers this single synthetic comparison. A future Detection
Lab API needs independent authorization and integrity checks for persisted
or user-selected evidence. The external Sysmon sample remains unlabeled.
