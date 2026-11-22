# v2.5-E evidence investigation preview

`GET /api/lab/comparison-preview/expectations/{expectation_id}/evidence`
returns evidence for one authored expectation in the pinned synthetic
Encoded PowerShell comparison. The existing comparison preview gate
registers both routes in explicitly opted-in development and test
processes. Production keeps both routes absent. The existing
administrator/analyst dependency checks authorization before any asset
read or expectation lookup and retains denial auditing.
[Route](../../backend/app/api/routes/comparison_preview.py)

## Request and response

The request accepts an exact, case-sensitive expectation ID with no
query parameters or request body. Supported IDs are `encoded-switch`,
`benign-get-date` and `benign-get-service`. An authorized request for
an unknown ID receives a fixed 404 with `expectation_not_found`
before rule evaluation. Invalid assets or inconsistent evidence return
a fixed 503 with `evidence_preview_unavailable`. Success, unknown-ID
and unavailable responses use `Cache-Control: no-store`.

The strict evidence response schema v1 contains:

- Fixture ID and normalized SHA-256, and authored expectation-set SHA-256.
- Expectation ID, source event ID and original fixture array ordinal,
  canonical UTC event timestamp with six fractional digits, and authored outcome.
- For both the baseline and candidate, requested and executed version
  identities, grade SHA-256, observed outcome, classification and a fixed
  diagnostic code.
- Change classification, parent comparison SHA-256 and evidence SHA-256.

The route reads the same two bounded bundled assets and uses the same
grading, summary and comparison path as v2.5-D. It checks that the
selected expectation, source event, and observed results agree with
the verified parent comparison and its rule and grade identities.
The parent retains its exact canonical bytes. The new response is
bounded to 16 KiB. Its evidence digest covers sorted-key compact
UTF-8 JSON with ASCII escapes, excluding `evidence_sha256` itself.
[Response schema](../../backend/app/schemas/comparison_preview.py) · [Parent contract](v25d-comparison-preview-api.md)

## What the explanation supports

For `encoded-switch`, event `encoded` at
`2026-11-20T12:00:00.000000Z` is expected to match. The weakened
baseline observed `no_match` and recorded `false_negative` with
`expected_detection_missed`. The corrected candidate observed
`match` and recorded `true_positive` with `expected_match_observed`.
The parent comparison records `improved`. Both benign controls record
`no_match` and `true_negative` on both versions and remain `unchanged`.

These codes describe the actual version-bound outcomes relative to
authored expectations. The built-in evaluator did not record a
condition tree, so this response supplies no condition nodes and uses
no Sigma trace. It omits command lines, usernames, hostnames, rationale,
and raw event fields. This is one synthetic comparison. Its digests
prove content consistency with the pinned artifacts, not independent
evidence authenticity or real-world detection accuracy.

Authentication can perform the existing user lookup and denial audit.
The evidence handler performs no database queries, writes, or outbound
network operations. The synthetic comparison has no persisted replay
run or authorized case association. A future case pivot needs persisted
evidence references and per-object access checks before exposing links.

## Reproduce locally

From `backend`, in the documented Python 3.12 virtual environment:

```powershell
.\.venv\Scripts\python.exe -m pytest -q --noconftest tests/test_replay_preview_api.py
```

The suite covers feature registration, role and audit checks, all three
expectation lookups, digest recomputation, raw-data exclusion, malformed
requests and assets, and exact parent response compatibility. It uses
an identity-only session and blocks SQLAlchemy and outbound socket
activity during the successful request.
[Tests](../../backend/tests/test_replay_preview_api.py)

The focused preview suite passed **82 tests in 36.78 seconds**.
The database-free regression suite passed **567 tests in 73.92
seconds**. Each run reported one Starlette test-client deprecation
warning. The additional security, RBAC, detection-engine and
bootstrap unit run passed **31 tests in 3.38 seconds**. Black on the
route and schema, targeted Flake8, and `git diff --check` passed.
PostgreSQL integration and hosted CI were outside this run.
