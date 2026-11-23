# v2.6-G2 mandatory PostgreSQL persistence CI gate

`Replay Persistence (PostgreSQL 18)` runs on a separate Ubuntu GitHub-hosted
runner for the workflow's pull requests and pushes to `main`. It provisions a
fresh `postgres-test` service from the existing disposable Compose definition
and uses the separate `case-zero-v26g-test` project. The existing backend
job's already-migrated database, frontend checks and proof publication retain
their current behavior. The new job inherits `contents: read`, disables
checkout credential persistence and uses synthetic test settings only.
[Workflow](../../.github/workflows/ci.yml) · [Compose file](../../compose.test.yaml)

## Database identity and platform checks

- The Windows test path retains its Docker Desktop Linux engine and exact
  named-pipe checks. It accepts the verified disposable project's loopback
  port from the explicit test environment.
- The Linux path requires GitHub Actions, a GitHub-hosted Linux runner, the
  default Docker context, a real local `/var/run/docker.sock` socket and an
  Ubuntu engine. Provisioning stops if the project already has containers or
  networks or TCP port `55432` is occupied. Compose binds PostgreSQL only to
  `127.0.0.1:55432` on that dedicated runner.
- Both paths require explicit `APP_ENV=test`, exact synthetic database/user
  settings, healthy `postgres:18`, the expected Compose labels, the exact
  published loopback binding, a 512 MiB PostgreSQL tmpfs and no additional
  mounts. Linux also verifies the dedicated Compose bridge and its sole
  container. The fixture compares a read-only cluster identity read from
  inside the container with the host probe and requires an empty `public`
  schema. Every check precedes migration.
  [Fixture](../../backend/tests/test_replay_run_store.py) ·
  [GitHub runner variables](https://docs.github.com/en/actions/reference/workflows-and-actions/variables) ·
  [Docker contexts](https://docs.docker.com/engine/manage-resources/contexts/)

## Execution and skip prevention

The dedicated job installs the existing backend requirements and runs from
`backend` with `CASE_ZERO_RUN_V26G_INTEGRATION=1`:

```bash
report="$RUNNER_TEMP/replay-persistence-junit.xml"
python -m pytest -q --noconftest --junitxml="$report" tests/test_replay_run_store.py
```

Pytest failure stops the test step. After a successful pytest exit, the job
requires exactly nine JUnit test cases and rejects a skip, failure, error or
missing report. The fixture runs the prior-head upgrade, the replay revision,
downgrade to the prior head and re-upgrade. The tests cover concurrent
admission and claims, ownership and foreign keys, quotas and payload limits,
lease fencing, cancellation and retries, retention and expiry, and atomic
publication and rollback. Windows local reproduction uses the same file and
explicit opt-in with the existing verified setup. [v2.6-G test instructions](v26g-replay-run-persistence.md#validation-and-safe-rollback)

## Cleanup and limits

The provisioning step records the IDs of the new container and bridge before
starting the service. Cleanup runs even after a failed test or start if both
IDs are available. It rechecks the local Docker context and the exact resource
names and Compose labels before removing those IDs. It uses neither a broad
Compose teardown nor a prune command. Cleanup fails closed on unexpected
metadata. If creation fails before both IDs can be recorded, or the runner is
terminated before cleanup, the ephemeral GitHub-hosted VM is the final
containment boundary.

Runner variables and fixture checks constrain the supported test environment.
They are not independent attestation of third-party job code or production
configuration. The job has no production credentials. This migration rehearsal
does not establish production backup, lock-budget or rollback readiness.

## Local verification

The Windows integration run used the verified tmpfs project, PostgreSQL 18,
`casezero_test` and loopback port `57564`. It passed **9 tests with zero skips**
and the container was stopped. The database-free run passed **345 tests**.
Black, targeted Flake8, workflow YAML and Bash syntax checks passed. The JUnit
check accepted nine passes and rejected missing, skipped, failed and errored
cases. Mocked Linux checks rejected non-hosted, remote, non-Ubuntu and
non-socket Docker environments. Hosted Linux behavior remains unverified.

```powershell
.\.venv\Scripts\python.exe -m pytest -q --noconftest tests/test_database_config_safety.py tests/test_render_deployment_safety.py tests/test_replay_run_state.py tests/test_replay_evaluator.py tests/test_rule_versions.py tests/test_replay_rule_binding.py tests/test_replay_grading.py tests/test_replay_summary.py tests/test_replay_comparison.py tests/test_replay_evidence.py tests/test_replay_regression_proof.py tests/test_replay_proof_export.py tests/test_replay_proof_verify.py
black --check tests/test_replay_run_store.py
flake8 --max-line-length 95 tests/test_replay_run_store.py
```

## Merge acceptance

Observe the hosted job provision a fresh cluster, execute all nine tests with
zero skips and remove its resources. Require its check in the `main` branch
protection or ruleset for PR #41, alongside the existing backend and frontend
checks. The repository workflow fails on this job's failure. Whether GitHub
blocks a merge also depends on the effective branch ruleset, which this patch
does not change. Production startup and migration approvals remain separate.
[G1 release gates](v26g1-deployment-migration-safety.md)
