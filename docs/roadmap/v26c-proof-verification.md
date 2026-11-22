# v2.6-C independent offline proof verification

The verifier checks the two files produced by the [v2.6-B exporter](v26b-offline-proof-report.md).
It accepts export schema v1 and the pinned synthetic Encoded PowerShell
comparison v1. It reads fixed filenames from an existing local directory and
produces a verification status on the console.
[Verifier source](../../backend/app/services/replay_proof_verify.py)

## Verification sequence

1. Check the directory and its ancestors, reject links and reparse points, and
   read each regular file with a 16 KiB limit. Reject empty files and invalid
   UTF-8. JSON parsing also rejects duplicate keys, excessive nesting and
   nonstandard numeric constants.
2. Require the exact v1 envelope and canonical UTF-8 JSON. Recompute
   `proof_sha256` from sorted, compact, ASCII-escaped JSON with that field
   omitted. The canonical JSON has no trailing newline.
3. Use the strict synthetic comparison schema and the existing summary
   reconciliation in the comparison service. Check classifications, ordered
   expectation references, totals, labeled denominators and version identity
   relationships. Reconstruct the comparison and compare its canonical bytes,
   including the comparison digest computed by v1. At this stage, claimed grade
   digests are still untrusted.
4. Load the repository's fixture and authored labels and check their pins.
   Execute both built-in versions through existing grading, summary and
   comparison services. Check the reproduced comparison pin and compare the
   complete reproduced bytes with the supplied comparison. This also checks
   the grade digests and executed-version identities against the trusted run.
5. Render Markdown from the validated report using the v1 renderer and require
   byte equality, including line endings, limitations and all report text.

## Reproduce with Windows PowerShell 5.1

From `backend`, using the existing Python 3.12 virtual environment:

```powershell
$bundle = Join-Path $env:TEMP ('casezero-proof-' + [guid]::NewGuid())
.\.venv\Scripts\python.exe -m app.services.replay_proof_export --output-dir $bundle
if ($LASTEXITCODE -ne 0) { throw 'Export failed' }
.\.venv\Scripts\python.exe -m app.services.replay_proof_verify --bundle-dir $bundle
if ($LASTEXITCODE -ne 0) { throw 'Verification failed' }

$copy = Join-Path $env:TEMP ('casezero-copy-' + [guid]::NewGuid())
Copy-Item -LiteralPath $bundle -Destination $copy -Recurse
[IO.File]::AppendAllText((Join-Path $copy 'proof.md'), 'extra line')
.\.venv\Scripts\python.exe -m app.services.replay_proof_verify --bundle-dir $copy
if ($LASTEXITCODE -ne 1) { throw 'Expected tampering rejection' }
```

The fresh export verified with exit code 0. The modified copy returned exit
code 1 and `Proof verification failed: Markdown differs from verified JSON.`
Failures report a fixed category without including the supplied content. The
verifier opens files read-only and produces no output artifacts.

## Trust and limits

Self-declared hashes establish internal content consistency. Re-execution
against pinned assets provides reproducibility evidence relative to a trusted
checkout, interpreter and dependencies. A coherent fabrication with recomputed
hashes still fails if it differs from the reproduced comparison. Neither check
identifies the generator, verifies external provenance, or provides a digital
signature. The three synthetic labels establish no real-world accuracy metric.

Use a directory on a trusted local filesystem and keep it stable while
verifying. The path checks reject UNC paths and visible links or reparse
points. They do not detect every OS-level network mount or guarantee a snapshot
against a writer changing the files or ancestor paths concurrently. Verification
uses the bytes read during the invocation. The tool has no database, HTTP or
shell execution path for supplied content.

## Validation and CI handoff

The focused run passed 47 tests (33 verifier and 14 exporter). The combined
database-free run passed 173 tests across those modules and the existing
grading, summary, comparison, evidence and regression proof suites. Black,
targeted Flake8 and `git diff --check` passed.
[Verifier tests](../../backend/tests/test_replay_proof_verify.py)

A later CI slice can export to a runner-local directory, verify the pair
before upload, and retain only the sanitized artifacts with explicit retention
and access settings. Consumers should verify against a trusted revision.
CI artifact publication and independent signing are separate work.
