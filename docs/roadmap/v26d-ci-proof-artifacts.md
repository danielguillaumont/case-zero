# v2.6-D verified CI proof artifacts

CI previously ran the offline detection regression proof without generating,
independently verifying, or retaining the two-file report. The backend job now
does all three while preserving the existing backend and frontend checks.
[CI workflow](../../.github/workflows/ci.yml)

## Execution and publication

1. Run the existing migrations, backend tests, and offline regression proof.
2. Create a unique private staging parent under `RUNNER_TEMP` and run
   `python -m app.services.replay_proof_export --output-dir "$proof_dir"`.
   The exporter receives a previously unused `bundle` child, outside the checkout.
3. Run `python -m app.services.replay_proof_verify --bundle-dir "$PROOF_DIR"`
   against that same directory. The verifier reads the pair and reproduces the
   trusted bundled result.
4. Check that the directory contains exactly `proof.json` and `proof.md`, each
   a regular file between 1 byte and 16 KiB. The check uses link metadata to
   reject symlinks. Content checks remain in the exporter and verifier.
5. On a push to `refs/heads/main`, after all preceding backend steps succeed,
   upload only the two explicit file paths using `actions/upload-artifact@v7`.
   `case-zero-detection-proof` is retained for seven days. A missing match or
   an existing same-name artifact causes the upload to fail. The frontend job
   runs independently, so use a successful workflow run when downloading.

Pull requests run export, verification and staging checks as mandatory gates
and skip publication. This keeps the download policy restricted to results
from `main`. The official action declares the Node 24 action runtime for the
existing GitHub-hosted runner. The frontend still uses Node 22 and workflow
permissions remain `contents: read`.
[Action metadata](https://raw.githubusercontent.com/actions/upload-artifact/v7/action.yml) ·
[GitHub-hosted runners](https://docs.github.com/en/actions/how-tos/write-workflows/choose-where-workflows-run/choose-the-runner-for-a-job)

## Download and reproduce

In the repository's **Actions** tab, select **CASE//ZERO CI**, open a successful
`main` push run and download **case-zero-detection-proof** under **Artifacts**.
Sign in with repository read access and download before the seven-day expiry.
Extract both files to a local directory. From `backend` in a trusted checkout of
the run's revision, use the existing Python 3.12 environment in PowerShell:

```powershell
$bundle = 'C:\path\to\extracted-proof'
.\.venv\Scripts\python.exe -m app.services.replay_proof_verify --bundle-dir $bundle
```

[GitHub download instructions](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts) ·
[Local export instructions](v26b-offline-proof-report.md#reproduce-locally) ·
[Verification contract](v26c-proof-verification.md)

The files contain sanitized results for the three authored synthetic labels.
They establish no real-world detection accuracy. SHA-256 checks content
consistency and re-execution checks reproducibility against a trusted checkout.
These checks establish neither authorship nor external provenance and provide
no digital signature. Export and verification use no production data,
credentials, network calls, or operational database writes.

## Validation and outstanding CI checks

From `backend`, the following database-free command passed **59 tests**:

```powershell
.\.venv\Scripts\python.exe -m pytest -q --noconftest tests/test_replay_proof_export.py tests/test_replay_proof_verify.py tests/test_replay_regression_proof.py
```

Black and targeted Flake8 passed for the three proof modules and their tests.
Workflow YAML parsed successfully and matched the baseline after removing the
four new steps. Local Git Bash ran the exact export, verify, and staging scripts
with a temporary runner directory. The staging check rejected missing, extra,
empty, oversized and symlink entries. The verifier rejected modified Markdown.

Hosted acceptance requires a PR run where all three gates pass and upload is
skipped, then a successful `main` push run with one seven-day artifact containing
only the two files. Download and verify the hosted artifact to confirm packaging.
A failed export, verification, or staging check must fail the backend job and
skip upload. These hosted outcomes were not exercised locally. A re-run that
encounters an existing same-name artifact must preserve that original artifact.

Persistent scheduling and recovery, export ownership and authorization, metrics,
and load and resilience evidence remain part of the broader v2.6 roadmap.
