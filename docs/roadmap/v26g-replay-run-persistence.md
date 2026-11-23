# v2.6-G PostgreSQL replay run persistence

This slice implements the storage stage of [ADR 006](v26e-persistent-execution-design.md).
The store takes an async SQLAlchemy session factory and owns a short transaction
per call. It reconstructs validated v1 snapshots, delegates state transitions
to the existing contract, and persists the changes together. The caller must
finish `claim` before starting evaluation and open a separate transaction to
publish or fail the attempt. The slice has no API registration or executor.
[Store](../../backend/app/services/replay_run_store.py) ·
[State contract](v26f-replay-run-state-machine.md)

## Schema and transaction rules

Migration `c84d31ef7b26` follows `e6ab1b3d315d`. It seeds the singleton and
adds four tables. Downgrade removes those four tables and their indexes.
[Alembic revision](../../backend/alembic/versions/c84d31ef7b26_add_replay_run_persistence.py) ·
[Models](../../backend/app/models/replay_run.py)

| Table | Purpose and constraints |
| --- | --- |
| `replay_runs` | UUID, owner FK with `RESTRICT`, immutable request metadata and fingerprint, owner/schema/key uniqueness, lifecycle timestamps and deadlines. Partial unique index limits `RUNNING` to one row. |
| `replay_attempts` | Composite run UUID/number key, unique lease token, lease deadline and attempt timestamps. Attempt numbers are limited to 1 and 2. |
| `replay_results` | At most one result per run, composite FK to the producing attempt, executed identity, pass flag, grade and evidence hashes, and two nonempty byte payloads totaling at most 32 KiB. |
| `replay_execution_control` | Seeded row with `id = 1`, used as the lock that orders replay repository transactions. |

Mutations lock the control row first and target runs second. Reads take a
shared control lock so the run, attempts and evidence are consistent across
queries. The store sets `READ COMMITTED` before taking the lock so later
statements see the previous holder's commits. It gets execution time from
PostgreSQL `clock_timestamp()` and normalizes timestamps to fixed UTC.

Admission checks the active owner and handles idempotency before quotas. An
existing scoped key with the same fingerprint returns the original run. A
different fingerprint conflicts. A new admission checks two active runs per
owner, five new runs per owner in the preceding minute, ten queued runs, and
256 total retained records. If a run is active in the execution slot, admission
reserves a queue position so lease recovery or a transient failure can requeue
without exceeding ten queued runs. Maintenance can free expired entries in
batches of 64. Expired rows count toward retention capacity until purged.

Claims order eligible entries by creation time and UUID. Expired queued jobs
are expired and inactive-owner jobs cancelled without opening an attempt.
Publication locks the current run, applies the state machine's lease check,
and commits the attempt finish, result and terminal status in one transaction.
Pending cancellation wins over publication and retries. The store rechecks
owner activity on retry or reconciliation. There is no automatic reconciliation
or retry scheduler. Queued expiry is ten minutes. Terminal retention is seven
days, followed by a seven-day tombstone period recorded at expiry. Owner reads
hide evidence when retention ends, even before cleanup. Expiry deletes evidence
and attempt rows. The tombstone keeps owner and idempotency information and the
bounded, immutable request metadata needed to validate the fingerprint.

## Validation and safe rollback

Run the integration file alone from `backend`, with the existing venv and
`CASE_ZERO_RUN_V26G_INTEGRATION=1`. Follow the repository's [disposable PostgreSQL
guardrails](../../README.md#disposable-postgresql-tests-on-windows), using an
isolated Compose project named `case-zero-v26g-test` and service `postgres-test`.
If the documented port is occupied, leave it untouched and publish exactly one
verified free loopback port with a Compose override outside the repository. Set
`APP_ENV=test`, the exact bound `POSTGRES_PORT`, and the documented disposable
host, database and credentials. The fixture verifies Docker context, labels,
image, health, port and tmpfs mounts, then compares a read-only PostgreSQL
cluster identity probe from inside the container to the host endpoint. It
requires an empty public schema before any migration.

```powershell
.\.venv\Scripts\python.exe -m pytest -q --noconftest tests/test_replay_run_store.py
.\.venv\Scripts\python.exe -m pytest -q --noconftest tests/test_database_config_safety.py tests/test_replay_run_state.py tests/test_replay_evaluator.py tests/test_rule_versions.py tests/test_replay_rule_binding.py tests/test_replay_grading.py tests/test_replay_summary.py tests/test_replay_comparison.py tests/test_replay_evidence.py tests/test_replay_regression_proof.py tests/test_replay_proof_export.py tests/test_replay_proof_verify.py
```

The migration rehearsal upgrades to the prior head, applies the replay
revision, downgrades to the prior head and upgrades again. The integration
suite exercises owner scope and foreign keys, duplicate admission, concurrent
claims, quotas, lease fencing, cancellation, retry and expiry, payload limits,
and rollback after a result insert. The final run passed **9 integration tests**
on verified PostgreSQL 18 at `127.0.0.1:57564` in the disposable project,
with `APP_ENV=test` and database `casezero_test`. The container was stopped
afterward. The database-free run passed **340 tests**. Neither run reported
warnings or skips. Black and targeted Flake8 passed on the four new Python
files. Keep additive tables on application
rollback where possible. Downgrade destroys replay data and needs a verified
backup and explicit authorization outside this disposable rehearsal.

## Security and rollout boundary

The store is an internal interface. Owner-scoped lookups and active-user
checks complement future authentication and RBAC. Worker operations require a
valid lease but do not authenticate an external caller. `ResultPayload`
checks size and byte digests. A future trusted executor must validate replay
output, including grade correctness, source identity and redaction, before
constructing it. Application boundaries must sanitize database errors and must
never expose internal lease tokens, idempotency keys or unredacted output.
Privileged SQL writers are outside the repository lock protocol. Workspace
isolation, request throttling, evidence download authorization and process
supervision remain separate slices.

Review the checked-in Render startup migration behavior before merging this
migration-bearing change. A green test run does not authorize a merge,
deployment or production migration. A future rollout requires an approved
backup/restore drill, migration timing and a rollback plan.
[Deployment blueprint](../../render.yaml)
