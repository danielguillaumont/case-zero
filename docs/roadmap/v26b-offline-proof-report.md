# v2.6-B offline detection proof report

The exporter loads the bundled [fixture](../../backend/app/replay_assets/encoded_powershell.json)
and [authored labels](../../backend/app/replay_assets/encoded_powershell.expectations.json)
once using the bounded replay loaders. It verifies their pinned digests, grades
the weakened and corrected versions on the same inputs, reconciles the summaries,
and compares them with the existing engine. It verifies the complete canonical
comparison against the v2.5-D pin before rendering either artifact. Changed
results, malformed identities, and incomplete or unsupported execution fail the
export. The expected baseline FAIL is part of the successful demonstration.
[Export service](../../backend/app/services/replay_proof_export.py)

## Export contract v1

- `proof.json` contains `schema_version`, the complete validated comparison v1,
  `evaluator_contracts` for the two executed versions, `limitations`, and
  `proof_sha256`. The comparison preserves fixture and label digests, authoring,
  requested and executed versions, grade digests, total/labeled/unlabeled event
  counts, grade counts, pass flags, labeled satisfaction, deltas, change totals,
  and per-expectation classifications. Errors and unsupported results are distinct
  grade fields. This pinned demonstration requires zero of each.
- `proof.md` renders the same export data with an explanation of the changed
  classification and instructions to reproduce it. The same three authored
  labels yield 2/3 satisfaction for the weakened baseline and 3/3 for the corrected
  candidate, with one improved expectation and two unchanged benign controls.
- JSON uses UTF-8 with ASCII escapes, sorted object keys, compact separators,
  stable comparison ordering, and no trailing newline. `proof_sha256` covers
  the canonical object with that field omitted. It binds the embedded source
  comparison but does not cover the separate Markdown bytes. Markdown uses UTF-8
  with LF line endings. Neither file carries run timestamps or workstation paths.
- Each output is capped at 16 KiB. Fixed text and the pinned comparison prevent
  arbitrary telemetry and untrusted Markdown from entering the report.

## Reproduce locally

From `backend`, using the existing Python 3.12 virtual environment in Windows
PowerShell 5.1:

```powershell
$output = Join-Path $env:TEMP ('casezero-proof-' + [guid]::NewGuid())
.\.venv\Scripts\python.exe -m app.services.replay_proof_export --output-dir $output
if ($LASTEXITCODE -ne 0) { throw 'Proof export failed' }
Get-ChildItem -LiteralPath $output
```

Choose a new output directory under an existing trusted local parent. The CLI
rejects existing destinations, parent traversal, UNC paths and symlink or
reparse-point parents. It stages `proof.json` and `proof.md` together, then
publishes the directory with a no-replace rename on Windows and Linux. Unsupported
platforms or filesystems fail closed. The parent must be controlled by the caller.
This protects against ordinary write failures and competing creation at the final
path. It does not guarantee crash durability or defend against concurrent
privileged changes to the parent path. A crash may leave a staging directory.

The observed export was 2,908 JSON bytes and 3,132 Markdown bytes. Its content
SHA-256 was `acaa024b355cb3bd2a71c42b0cd5bbe6952ab596c15378ed38096cb951dc3507`.
The embedded comparison SHA-256 was
`537a653234548dca4490997a4c344c4cbaa1673c1314b95357eefda55e7136a2`.
[Focused tests](../../backend/tests/test_replay_proof_export.py)

## Verification

The focused suite passed 14 tests database-free. It verifies cross-process byte
stability, recomputes the export digest, and exercises asset tampering, malformed
comparisons, output limits, redaction, filesystem conflicts and blocked database
and network access. The combined replay suite passed 321 tests, including the
focused tests and existing grading, summary, comparison, evidence, regression
proof, fixture, expectation, rule-version and preview API tests. The combined
run emitted one Starlette HTTPX deprecation warning. Black and targeted Flake8
passed for both added Python files.

## Scope and handoff

This export measures satisfaction for three synthetic labels only. It makes no
real-world detection accuracy claim. Local filesystem permissions control access.
The CLI has no application authentication, API, database, or network interaction.
SHA-256 supports reproducibility and content consistency. A separate verifier
could recompute the payload digest and reproduce the comparison against a trusted
bundle. Independent authenticity requires a separate trust mechanism.

Before web export, define persisted run and export ownership, retention, and
per-object authorization. Test unauthorized export, redaction, size limits and
repeatability. Persistent scheduling and recovery remain separate from this
offline publication step. [v2.5 handoff](../releases/v2.5.md#v26-handoff-in-priority-order)
