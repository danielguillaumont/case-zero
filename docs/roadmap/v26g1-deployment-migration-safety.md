# v2.6-G1 deployment migration safety

The [Render blueprint](../../render.yaml) starts Uvicorn directly. Normal web
startup no longer runs Alembic. The bind address, port, app module, service
plan, environment declarations and `autoDeployTrigger: off` are unchanged.
This repository change does not establish the live service's effective
configuration. The [startup test](../../backend/tests/test_render_deployment_safety.py)
allows exactly the reviewed Uvicorn command and rejects composed commands and
migration wrappers.

## Controlled migration procedure

This procedure is for a separately authorized release. The blueprint patch,
PR approval, test success and merge each carry no permission to execute DDL.

1. **Record the intended release.** The release owner verifies the live service's
   effective DDL-free start command, tracked branch, deployed SHA, deployment
   triggers and manual deploy paths. Record the pinned candidate and rollback
   SHAs without credentials or connection strings. Confirm the rollback artifact
   can start through a DDL-free command.
2. **Verify target and recovery.** The database recovery owner independently
   verifies the approved Neon project, branch and database against the release
   inventory. A read-only probe on that target must show exactly Alembic revision
   `e6ab1b3d315d` for this change. Require a recent usable recovery point, retention
   window, named restore and cutover authority, and a successful restore to a
   separate isolated target. Record restored revision, schema, representative
   data and relationships, grants, app health, measured restore time, agreed
   recovery time and data-loss objectives, and the write reconciliation plan.
   The [earlier recovery rehearsal](v21d3-recovery-rehearsal.md) used synthetic data.
3. **Approve and execute once.** The release and database recovery owners approve
   the exact target, revision transition, pinned checkout, time window, lock and
   statement timeout bounds, and one named executor. Use a separate approved
   runner and dedicated least-privilege migration role. The Alembic environment
   reads the database target from its process configuration, so supply that
   role only to the one-shot runner. Keep Render startup and runtime credentials
   out of the migration path. Immediately recheck target and current revision,
   then run `python -m alembic upgrade c84d31ef7b26` from the pinned `backend`
   checkout in the approved window, with overlapping deploys and migrations
   blocked. The FK to `users` warrants a quiet window and a rehearsed lock budget.
   [Revision](../../backend/alembic/versions/c84d31ef7b26_add_replay_run_persistence.py)
4. **Verify before deploy.** Confirm the applied revision, the four replay tables,
   constraints and singleton `id = 1`, and representative operational service
   health with no unexpected changes. Separately approve deployment of the pinned
   DDL-free artifact, then repeat health and authenticated read smoke checks.
5. **Stop and recover.** Stop on target or revision mismatch, missing restore
   evidence or executor approval, a competing migration, a timeout, an unexpected
   schema outcome, or a failed smoke check. After failure, confirm the actual
   revision and transaction outcome before authorizing a retry. If DDL committed
   and the app fails, prefer the rehearsed application rollback with the additive
   schema intact. An older artifact with automatic Alembic startup can fail to
   recognize the expanded revision. Downgrade drops the replay tables and their
   contents. Downgrade, restore, and cutover each require separate approval.

## Compatibility and release gate

The current app registers no persistent replay route or executor. The new
revision adds replay tables and leaves the existing route tables structurally
intact. On verified disposable PostgreSQL 18 (`casezero_test`, loopback port
`51245`), the candidate at `cb58c0c` passed `/api/health` and authenticated
`/api/status` with revision `e6ab1b3d315d`. After a separately invoked disposable
upgrade, the previous repository app at `6b29d25` passed the same checks with
revision `c84d31ef7b26`. Each Uvicorn process left the revision and table list
unchanged. The Windows smoke harness explicitly used a selector event loop
for async psycopg and loopback binding. The disposable container was stopped.

Repository compatibility does not certify the actual deployed binary or prove
that a provider rollback uses the DDL-free command. Before merging PR #41, require a
sanitized live-configuration attestation and a rehearsed rollback for the exact
deployed artifact. Production DDL requires the additional approvals above.
[Production readiness audit](v21d4-production-readiness.md)

## PostgreSQL integration CI follow-up

The [current CI job](../../.github/workflows/ci.yml) upgrades a disposable
PostgreSQL 18 service and runs pytest. The [v2.6-G suite](../../backend/tests/test_replay_run_store.py)
is opt-in and verifies the Windows Docker Desktop named pipe, dedicated Compose
project and service, exact loopback endpoint, tmpfs, cluster identity and empty
schema. The default Linux job's already-migrated service cannot meet those
guards by setting the opt-in flag.

Use a separate CI slice to provision a fresh PostgreSQL 18 container with a
dedicated test project, tmpfs and a unique loopback port. Add a narrowly scoped
Linux preflight alongside the Windows guard. It must verify the hosted runner's
local Docker endpoint, unique container labels, image, health, port and storage,
read-only cluster identity equality between container and host, explicit test
environment and empty schema before any migration. Run the opt-in suite against
that target alone, assert its tests executed without skips, and tear down only
that verified test project. Leave the existing CI service, tests and proof
workflow intact. Never provide production credentials to either test job.

## Verification commands

From `backend` in the existing virtual environment:

```powershell
.\.venv\Scripts\python.exe -m pytest -q --noconftest tests/test_render_deployment_safety.py
.\.venv\Scripts\python.exe -m pytest -q --noconftest tests/test_render_deployment_safety.py tests/test_database_config_safety.py tests/test_replay_preview_api.py tests/test_replay_run_state.py tests/test_replay_proof_export.py tests/test_replay_proof_verify.py
black --check tests/test_render_deployment_safety.py
flake8 --max-line-length 95 tests/test_render_deployment_safety.py
```

The focused suite passed **5 tests**. The combined suite passed **236 tests**
with one Starlette HTTPX deprecation warning. Black, targeted Flake8, YAML
comparison and `git diff --check` passed. The v2.6-G persistence integration
suite and hosted CI were outside this rerun. No live provider settings or
production databases were accessed.
