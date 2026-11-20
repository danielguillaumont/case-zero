# v2.1-D4 production readiness checkpoint

**VERIFIED FROM SOURCE — Scope.** This offline checkpoint uses repository
baseline `e73faa2` (PR #8 merge). The [v3 master plan](CASE_ZERO_V3_MASTER_BUILD_PLAN.md)
and [baseline audit](v3-baseline-audit.md) establish the v2.1-D gate.
Provider-side facts require separate authorization and evidence.

## Evidence and release risks

| Status | Finding |
|---|---|
| **VERIFIED FROM SOURCE** | The documented production path is the Next.js frontend on Vercel → FastAPI on Render → PostgreSQL on Neon. The frontend's server-side API target is configured through `CASE_ZERO_API_URL`. [Deployment documentation](../../README.md#L1289) |
| **VERIFIED FROM SOURCE** | The Render blueprint sets `APP_ENV=production`, disables automatic deploys, and runs `alembic upgrade head && uvicorn ...` at startup. Alembic and the application use the same configured database URL. Alembic opens its own connection and uses a migration transaction context. There is no explicit migration lock or separate migration identity in the checked-in startup path. A migration error prevents Uvicorn startup. A migration can commit before a later startup failure, and concurrent starts can attempt migration against the same target. [Blueprint](../../render.yaml#L13) · [Alembic environment](../../backend/alembic/env.py#L79) · [Application database](../../backend/app/database.py#L15) |
| **VERIFIED FROM SOURCE** | The 12 checked-in revisions form one chain headed by `e6ab1b3d315d`. Some downgrades drop data-bearing tables, columns, or links. GitHub Actions defines backend migration and tests on a disposable PostgreSQL 18 service and a frontend build on pushes and PRs to main. [Revisions](../../backend/alembic/versions) · [CI workflow](../../.github/workflows/ci.yml) |
| **VERIFIED FROM SOURCE** | The README records a historical PostgreSQL-native restore from Render PostgreSQL to Neon. It supplies no evidence of a current Neon backup, retention window, restore permission, or recoverable point. [Historical migration](../../README.md#L894) |
| **VERIFIED BY EXISTING LOCAL EVIDENCE** | On November 20, 2026, disposable PostgreSQL 18 passed preflight, fresh and repeat upgrades to `e6ab1b3d315d`, upgrade from `67c33445e501`, custom-format restore into an independent target, and both manifest-scoped cleanups. The restore preserved the synthetic records and relationships and passed checks for all ten table inventories. The final recovery inventory was empty, and development container and volume metadata matched preflight. Docker and Alembic emitted diagnostics whose underlying text was unavailable. [Local rehearsal record](v21d3-recovery-rehearsal.md#local-verification--november-20-2026) |
| **UNVERIFIED** | The deployed frontend and backend revisions, effective release and startup settings, applied Alembic revision, target database identity, and runtime and migration grants. The checked-in head and local upgrade evidence establish no live revision. |
| **UNVERIFIED** | Current Neon backup availability, configured retention, point-in-time recovery availability and reachable window, restore permissions, and a usable recovery point. Production restore, cutover, acceptable downtime and data loss, and application rollback remain unproven. The local drill used synthetic data and omitted source ownership and ACLs. |

## Manual verification after separate authorization

Record the date, operator, source of evidence, and result for each check.
Keep credentials, connection strings, environment values, raw logs, and
database contents out of the record. Use sanitized target identifiers.

| Status | Operator check and evidence to retain |
|---|---|
| **UNVERIFIED** | In Vercel and Render, record active deployment commit IDs and confirm the frontend targets the intended API. Check Render's effective startup command, automatic deploy setting, health checks, approval and restart controls, and the exact previous app artifact eligible for rollback. Record outcomes without copying environment values. |
| **UNVERIFIED** | Cross-check the intended Neon database and branch against the authorized deployment inventory. Obtain the current Alembic revision from trusted evidence for that target. If unavailable, seek separate approval for an authorized operator to read only `version_num` from the verified target's Alembic version table. Compare it to the deployed commit's migration graph and record the result. Confirm effective runtime and migration grants without viewing credentials. |
| **UNVERIFIED** | Have the Neon recovery owner confirm backup or recovery-point availability, applicable retention, whether point-in-time recovery is enabled, and the earliest and latest usable recovery times. Confirm who can restore to a separate target and who approves cutover. Record permission evidence without initiating a restore. |
| **UNVERIFIED** | Name the release and recovery owners and agree recovery point and recovery time objectives. Identify the write cutoff, post-recovery-point reconciliation procedure, previous app artifact, and smoke checks. Require separately approved restore verification and a rollback rehearsal before a migration-bearing release. |

## Additive migration and v2.2 gates

| Status | Gate |
|---|---|
| **VERIFIED BY EXISTING LOCAL EVIDENCE** | Accept the D3 results as baseline evidence for the existing chain. They cover a representative upgrade and synthetic restore. |
| **UNVERIFIED** | Rehearse controlled migration failure and retry, and run the selected previous app against the expanded disposable schema. Application rollback changes the running artifact. Database rollback and restore require their own decisions. Check the schema and applied revision before retrying a failure or rolling back after a startup failure. |
| **UNVERIFIED** | Approve the additive Lab schema and access boundary. Keep operational tables and live alert behavior intact. Review grants, lock duration and compatibility with the previous app. Rehearse the candidate revision from the confirmed prior revision. Prove replay cannot read operational correlation history or write operational events, alerts, or cases before enabling persistence. [Proposed ADRs and ownership model](v21d-recovery-and-replay-safety.md) |
| **UNVERIFIED** | Assign a single approved migration executor and document the release sequence, restoration and cutover authority, and post-change checks. Stop on unknown or mismatched target or revision, missing recovery point or authority, failed rehearsal, or unsafe migration overlap. Production DDL stays on hold pending these checks. |
| **UNVERIFIED** | v2.2 entry still requires review of recovery evidence, approval of isolation and ownership, and agreement on ordering, provenance and workload bounds. The first proof should use one built-in rule, a bounded synthetic fixture, and repeatable results without a database connection. Persistence and production exposure require separate isolation and release evidence. [v2.1-D entry checklist](v21d-recovery-and-replay-safety.md#9-open-decisions-and-v22-entry-gate) |

**UNVERIFIED — Next checkpoint.** Obtain a separately authorized, sanitized
operator attestation covering the deployed revisions, effective migration
controls, and Neon recovery window and restore authority. Review that record
before authorizing any production verification beyond metadata or a schema change.
