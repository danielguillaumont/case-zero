# v2.1-D recovery and replay safety decisions

Source checkpoint: `af8a44f` (PR #6 merge). ADR-003 through ADR-007 and ADR-009
are **PROPOSED**. The release controls and D3 rehearsal below also require
approval. This document records source findings and the supplied v2.1 baseline.
[V3 master plan](CASE_ZERO_V3_MASTER_BUILD_PLAN.md) · [Baseline audit](v3-baseline-audit.md)

## 1. Verified architecture baseline

| Area | Source finding |
|---|---|
| Deployment | The documented path is Vercel → Render FastAPI → Neon PostgreSQL. The Render blueprint disables automatic deploys and starts with `alembic upgrade head && uvicorn ...`. Every invocation of that start command attempts migration before serving. [Deployment documentation](../../README.md#L1289) · [Render blueprint](../../render.yaml#L13) |
| Database configuration | The app and Alembic use the same `DATABASE_URL`, built from `POSTGRES_*`. Alembic uses its own async connection and wraps online migration in a transaction context. The current startup path has no separate migration credential or explicit migration lock. [Config](../../backend/app/config.py#L383) · [Runtime session](../../backend/app/database.py#L15) · [Alembic environment](../../backend/alembic/env.py#L79) |
| Local and CI tests | Explicit test mode bypasses dotenv, requires loopback and `casezero_test`, and rejects named libpq overrides. Windows Compose uses PostgreSQL 18 on `127.0.0.1:55432` with a 512 MiB tmpfs. CI uses its own PostgreSQL 18 service on port `5432` and migrates before testing. PR #6's reported baseline is 12 migrations and 163 passing backend tests on the disposable environment. [Test guard](../../backend/app/config.py#L49) · [Test Compose](../../compose.test.yaml) · [CI](../../.github/workflows/ci.yml) |
| Live ingestion | The request session adds and flushes the event, evaluates rules against the same session, adds generated alerts, and commits once before refreshing and returning the event. Live authentication correlation reads operational history. The pure PowerShell module takes field values and returns booleans. [Event route](../../backend/app/api/routes/events.py#L31) · [Evaluator](../../backend/app/services/single_event_evaluator.py) · [Detection contract](v21c-detection-contract.md) |

The checked-in Alembic graph is one chain of 12 revisions with head
`e6ab1b3d315d`. [Migration sources](../../backend/alembic/versions)

```text
eea5adb9d01c → 7569ef061300 → c1a516f709f9 → 197022cc8170
→ 06612ab28a83 → 940cff539727 → a6cf4ba02c3a → 0095cb51a35d
→ 8641d2165e62 → 67c33445e501 → 4748431cbcbf → e6ab1b3d315d
```

**Production unknowns.** The deployed revisions, effective startup configuration,
applied Alembic revision, actual database role grants, backup retention, recovery
point availability, and restore permissions require separate verification. The
README's historical Render-to-Neon restore documents a past migration.
[Historical migration](../../README.md#L894)

## 2. Recovery and release safety

| Responsibility | Evidence required before approval |
|---|---|
| Release owner | Confirm target identity, deployed app and schema revisions, expected revision path, deployment controls, a single migration executor, and smoke checks. Own the go/stop and application rollback decisions. |
| Database recovery owner | Confirm a usable recovery point and retention window, authority to restore to a separate target, and a tested procedure for verification and cutover. Agree recovery point and recovery time objectives with the release owner. |
| Migration reviewer | Review the revision diff, permissions, lock and runtime expectations, and compatibility with the previous app. Require disposable upgrade, failure, and restore evidence. |

Name the people filling these roles in the release record. Prefer additive
schema changes that the previous app tolerates, including during overlap or
rollback. Application rollback restores the app revision. Migration rollback
reverses a schema change and may drop tables, columns, or links. Treat restoring
a recovery point as a separate decision with a write cutoff and a plan to
reconcile post-point writes.

**Proposed release sequence**

1. Inventory the effective production configuration under separate authorization.
   Review the migration and rehearse it, restore, and app rollback on disposable
   targets. Record the intended revision, owners, and decision criteria.
2. Verify recovery-point availability immediately before release. Approve a
   single migration execution path and serialize migration attempts. A future
   deployment change can give DDL to a controlled migration step and limit the
   app to runtime grants. The current Render command remains in place.
3. Verify the resulting revision and data invariants, then verify startup and
   operational smoke checks before declaring success. If migration fails, inspect
   actual schema and version state before retrying. If startup fails after a
   successful migration, use the rehearsed app rollback against the expanded
   schema when compatible. Escalate any restore decision to the recovery owner.

**Stop conditions:** unknown or mismatched target or revision, unverified
recovery point or restore authority, failed rehearsal, unapproved destructive
DDL, uncontrolled concurrent migration attempts, or failed post-change checks.
[Release strategy](CASE_ZERO_V3_MASTER_BUILD_PLAN.md#151-deployment-strategy)

## 3. PROPOSED ADR-003 — Replay isolation

Reusing SOC tables with a replay flag would require every live query and
write path to enforce that flag. A separate database gives a stronger physical
boundary at the cost of another database lifecycle. Prefer a dedicated Lab
schema and restricted runtime identity within PostgreSQL for the initial
persistence design, subject to permission tests. Revisit a separate database
if grants or shared resource limits cannot enforce the required boundary.

- Give replay repositories access only to datasets, normalized telemetry, run
  state, results, and evidence within Lab storage. Keep the runner free of SOC
  repositories, the operational session factory, ingestion routes, and alert
  builders. Replay must never ingest operational events, query operational
  correlation history, create operational alerts, or mutate cases or activities.
- Use a non-owner replay identity with explicitly granted Lab privileges.
  Use a separate migration identity for DDL. Review grants, role inheritance,
  and default privileges. Schema separation still shares database resources.
- Require import-boundary tests, denied operational reads and writes using
  the actual replay identity, and unchanged operational rows and foreign-key
  links after replay. Seed operational history that would change a match if
  it leaked into the run. Confirm the result is the same with or without it.

These are proposed controls. The current evaluator has no I/O, and the live
dispatcher and correlation query retain their operational responsibilities.

## 4. PROPOSED ADR-004 — Rule representation

Start with one versioned adapter around an existing pure PowerShell predicate.
Retain the stable built-in rule ID and record the adapter and evaluator versions.
Bind each run to immutable rule content or a built-in definition identifier with
a content hash, and to an immutable dataset revision and mapping version.

Introduce a constrained internal AST only when a second concrete rule
representation needs common Boolean or operator semantics, and fixtures can
prove equivalence and explicit rejection. A general rule engine adds parser and
execution surface before the first built-in rule needs it.

## 5. PROPOSED ADR-005 — External rule compatibility

Defer Sigma import to the external compatibility milestone. Start with a
published allowlist of field equality and simple Boolean combinations over
mapped scalar fields. Treat this as a candidate subset pending fixture review.
Reject unsupported modifiers, operators, or correlation constructs explicitly.
Keep unsupported syntax and parse or mapping errors distinct from a valid miss.

Record source, license, format/version, content hash, field mapping version,
and any lossy conversions. Treat uploaded telemetry, commands, scripts, and
rule expressions as data. Evaluate only the supported declarative operators.
Require positive and negative fixtures, missing-field and type tests,
unsupported and malformed-input checks, and mapping/provenance round-trip
checks before accepting an external format.

## 6. PROPOSED ADR-006 — Replay execution and recovery

Begin with bounded synchronous local execution over synthetic fixtures.
Set explicit caps on input bytes, records, field sizes, elapsed time, state
size, and result bytes before running. Derive a reproducibility fingerprint
from the ordered dataset identity, mapping, rule, evaluator, and configuration.
Keep execution attempt identity separate so repeated attempts can share a
fingerprint while retaining their own outcome.

Return a terminal completed or failed result for the first proof. Limit
breaches produce explicit terminal errors. Partial evidence may aid diagnosis
and must never count as a completed run. Before durable execution, specify
atomic state transitions, idempotency, cancellation, restart recovery, stale
attempt handling, and atomic publication of completed results. A production
worker requires a demonstrated workload need, hosting approval, and failure
and recovery tests.

- **PROPOSED ADR-007 — Timestamps.** Normalize to UTC and sort by event time
  plus stable original ordinal. Define invalid-time and duplicate policies.
  For later authentication replay, specify grouping, window bounds, trigger
  inclusion, and expiry. Keep state local to one run and bound it per group
  and across the run. Test ties, duplicates, and exact boundaries independently
  of live arrival-order behavior.
- **PROPOSED ADR-009 — Evidence integrity.** Bind results to dataset, mapping,
  rule and evaluator versions and stable input event references. Bound traces
  and record provenance and redaction rules. Compare normalized outputs on
  repeat runs, excluding attempt-specific timestamps and identifiers.

## 7. Authorization and demo isolation

Reuse the active authenticated user and role checks, then enforce an explicit
Lab object scope in queries. The current SOC role checks authorize shared
operational access. [Authentication and role checks](../../backend/app/auth.py#L35)

| Resource or action | Proposed policy |
|---|---|
| Datasets, scenarios, and rule versions | Private by default, with ownership assigned server-side. Authorize every referenced version independently, including scenario inputs. |
| Runs, results, and reports | Authorize each input at run creation. Scope lists, details, nested evidence, exports, and both sides of comparisons to the caller's grant. Guessing an ID grants no access. Exports must respect the scope of their underlying evidence. |
| Analyst, administrator, viewer | Analysts and administrators may mutate authorized Lab objects. Operational administrator status alone grants no cross-owner access. Viewers may read expressly shared objects and may not import, edit, or start runs. Test denied cross-user reads and writes using two same-role users, plus viewer mutation and administrator cross-owner denial. |
| Public demo | Publish sanitized, read-only fixtures and precomputed results in a separate public scope without links to private records or shared privileged credentials. Defer anonymous execution. |

## 8. Disposable recovery rehearsal plan

**D3 is a future authorized rehearsal.** Verify local Docker context, bindings,
container ownership, temporary storage, and both database identities before
running database commands. Use distinct disposable source and restore targets
and synthetic data. Keep the persistent development container and volume
outside the test projects. Record their metadata before and after and confirm
that no command targeted development or production.

| Step | Acceptance evidence |
|---|---|
| Fresh migration | Empty target reaches the expected Alembic head. Repeating upgrade is a no-op. Required tables, indexes, constraints, and foreign keys are present. |
| Prior-schema upgrade | Select and justify a representative prior revision. Apply to that revision, seed synthetic rows and links for the tables present, then upgrade. Record before/after revision, row counts, representative values, and event/alert/case relationships. Verify relevant FK actions. |
| Backup and restore | Dump the seeded database and restore into the independently verified second target. Compare revision state, schema and constraints, synthetic rows, and links. Record elapsed time and artifact integrity. Keep the dump scoped to the drill. |
| Migration failure and recovery | Inject a controlled failure on a throwaway target. Record failure output, schema/version state, and preserved data before retry. Verify a corrected retry reaches head, or demonstrate recovery to the verified restore target if rollback is insufficient. |
| Previous app compatibility | Run the previous application revision against the upgraded disposable schema. Verify representative authenticated reads and synthetic ingestion/case writes, then exercise switching back to the candidate revision. Document any incompatibility as a release blocker. |

Capture the source commit, image and tool versions, exact commands, exit codes,
sanitized target verification, elapsed times, and observed assertions. Provider
restore permissions and production recovery objectives still require separate
evidence even when the local drill succeeds.

## 9. Open decisions and v2.2 entry gate

- **Confirmed:** the pure PowerShell evaluator exists, the live transaction
  remains intact, and the checked-in chain has a single head.
- **Pending approval:** ADRs above, Lab grants and ownership, execution limits,
  timestamp and duplicate policy, evidence contract, and recovery ownership.
- **Disposable evidence required:** tested fresh and prior-schema upgrades,
  restore, migration failure/retry, and previous-app compatibility.
- **Separate production evidence required:** deployed and applied revisions,
  effective release controls, grants, retention and recovery point,
  restore authority, and agreed recovery objectives. Production schema changes
  remain blocked until the release prerequisites and recovery evidence pass.
- **First local v2.2 proof after entry approval:** one built-in rule, one bounded
  synthetic fixture, immutable inputs, stable event order, repeatable decisions
  and evidence references, and explicit failure on exceeded limits. Use no
  database connection, live ingestion, or operational persistence. Prove runtime
  database isolation separately before introducing persisted replay.
