# ADR 006 — Persistent replay execution

**Status:** Proposed for review at `b6ac9bdaf7976bbbb7b0db00d06fa4f007b57db9`.
This document records a local-first design. Runtime acceptance and hosted
activation each require separate evidence and approval.
[Master plan](CASE_ZERO_V3_MASTER_BUILD_PLAN.md#v26--operationalization-cicd-and-proof-exports)

## Repository baseline

- Replay uses bounded fixture and expectation loaders, version-bound grading,
  deterministic comparison, and local proof export and verification. The fixed
  replay, comparison and evidence previews are opt-in in development/test. Their
  handlers process bundled inputs without operational writes. Existing auth
  can query users and write denial audits. There is no persisted replay queue,
  worker, workspace membership, or run-to-case association in this checkout.
  [Grader](../../backend/app/services/replay_grading.py) ·
  [Registration](../../backend/app/main.py) ·
  [Replay preview](../../backend/app/api/routes/replay_preview.py) ·
  [Comparison and evidence](../../backend/app/api/routes/comparison_preview.py) ·
  [v2.5 acceptance](../releases/v2.5.md)
- PostgreSQL access uses an async SQLAlchemy engine, `pool_pre_ping`, a
  two-second connection timeout and a session per database dependency. These
  settings do not provide execution leases or retry semantics. The 12 shipped
  migrations form a single chain with repository head `e6ab1b3d315d`. Models
  include `users`, `alerts`, `security_events`, `cases`, `case_notes`,
  `case_activities`, `threat_indicators`, `login_throttles` and
  `security_audit_events`. The live deployed revision was outside this review.
  [Engine](../../backend/app/database.py) ·
  [Metadata registration](../../backend/alembic/env.py) ·
  [Repository head](../../backend/alembic/versions/e6ab1b3d315d_add_security_audit_events.py)
- Auth checks the active user and role. Roles are administrator, analyst and
  viewer. The security audit service commits in a separate session and logs
  audit failures. This is useful for request denial auditing. Atomic run history
  needs its own persisted state and attempt records.
  [Auth](../../backend/app/auth.py) · [User model](../../backend/app/models/user.py) ·
  [Security audit](../../backend/app/services/security_audit.py)
- The checked-in Render blueprint declares one free web service in Ohio, runs
  migrations before Uvicorn starts, and disables automatic deploys. It declares
  no background worker. It documents Neon for production PostgreSQL. Live
  budgets, quotas, connection limits, service uptime and backup capabilities
  remain unverified. CI already provisions disposable PostgreSQL 18 and runs
  migrations and backend tests. Existing tests cover preview auth, operational
  data isolation, database configuration safety and audit events.
  [Blueprint](../../render.yaml) · [CI](../../.github/workflows/ci.yml) ·
  [Preview integration](../../backend/tests/test_replay_preview_integration.py) ·
  [Database safety tests](../../backend/tests/test_database_config_safety.py) ·
  [Audit tests](../../backend/tests/test_security_audit_api.py)

v2.6 already covers [frontend gates](v26a-frontend-ci-gates.md),
[offline export](v26b-offline-proof-report.md), [independent verification](v26c-proof-verification.md),
and [CI proof publication](v26d-ci-proof-artifacts.md). These establish a bounded
synthetic proof path. Durable execution requires its own failure and permission tests.

## Decision and alternatives

| Strategy | Transactions, crash and duplication | Capacity, cancellation and testing | Hosting and cost |
| --- | --- | --- | --- |
| A. Bounded synchronous persistence | Commit admission first, evaluate outside SQL, commit outcome separately. Unique owner/key prevents duplicate runs. A request or web process crash leaves a stale run and still needs reconciliation. | One execution occupies a request slot. Timeouts and cancellation depend on request and process behavior. Small initial integration, harder disconnect and restart tests. | No extra service, but CPU and memory share the API process and proxy time budget. |
| **B. Database-backed jobs with an explicit local executor** | Short admission, claim and completion transactions. A fenced lease and explicit reconciliation handle interrupted attempts. PostgreSQL owns duplicate admission and claim decisions. | One slot and bounded backlog. A foreground command can claim one run, supervise a deadline, and exercise cancellation and recovery in disposable tests. | One operator-invoked process, one evaluation child and at most one executor DB connection at a time. No permanent polling or paid worker assumed. |
| C. Dedicated asynchronous worker | Similar durable admission plus a deployed consumer, health checks and supervision. Delivery retries still require database idempotency and fencing. | Independent capacity and better continuous throughput. Adds worker outages, deployments, monitoring, and coordination tests. | Requires an approved always-on runtime, database capacity and operating budget. |

Choose **B** for local execution. A foreground `run-next` command reconciles
expired leases, tries one claim, processes it and exits. A `reconcile` command
can recover or expire records without executing work. Jobs stay queued until
someone invokes an executor. Evaluate in a supervised, short-lived child with
an allowlisted mode and bounded structured input/output. Never hold a SQL
transaction or a checked-out connection while evaluating or waiting on the
child. Resource targets below are starting limits for measurement, with hosted
enablement contingent on measured headroom, permission tests and a recovery drill.

## Proposed run contract v1

| Data | Proposed contract |
| --- | --- |
| Identity and owner | Server-generated run UUID, run schema version and authenticated `owner_user_id`. First slice is personal scope. No shared workspace access until a membership model exists. |
| Immutable input | Bundled fixture ID, fixture schema and normalized SHA-256, expectation-set SHA-256 and its authoring version, requested rule ID/version digest and evaluator contract. First slice allows only pinned synthetic bundle revisions and allowlisted built-ins. Unavailable revisions fail before replay. A future dataset must have a stable revision and owner-scoped reference before admission. |
| Ordering and execution | Preserve fixture-array ordinals and existing evaluator/grade canonical ordering. Persist a versioned, server-chosen limits profile and canonical request fingerprint covering identities and configuration. Store observed executed identity when available. |
| Idempotency | Bounded ASCII client key scoped to owner, unique together with contract version. Same key and fingerprint returns the existing run even at quota. Different fingerprint returns conflict. No raw key in logs or reports. |
| Progress and attempts | State, creation time, first start, completion time for the terminal result, queue and retention deadlines, cancellation request time, and current attempt number. Separate attempt records contain start/end, lease deadline, attempt outcome and failure code. Retry stays on the same run with the next attempt number. Re-running an existing terminal run requires a new key. |
| Evidence | One immutable result record per completed run with grade schema, canonical redacted bytes, content digest and executed identity. Later proof artifacts bind back to that result. Distinguish a completed evaluation with `passed=false` from a failed execution. Errors or unsupported execution use a bounded failure category in this first persistent contract. |
| Time | Store `timestamptz` values with UTC presentation. Use database time in state/lease transactions, monotonic time for the local process deadline, and original event timestamps for evaluation. Run timestamps are outside canonical result hashes. |

Provisional local limits: one global running attempt, two active runs per owner,
ten global queued runs, 256 retained run rows including tombstones, and at most
two attempts per run. Start with a 10-second child deadline, a 30-second lease,
10-minute queue expiry, seven-day evidence retention, and a further seven-day
tombstone window. A proposed submission limiter permits five new runs per owner
per minute. Repeated reads and idempotent submissions also need request throttles
before HTTP exposure. Start with the existing 16 KiB cap per redacted export
file and 32 KiB total retained result/evidence bytes per run, approximately
8 MiB maximum payload at 256 rows, plus metadata, indexes, WAL and database
overhead. Reuse the stricter pinned bundle caps and loader limits. Measure RSS,
CPU time, connection use and storage amplification locally before revising limits.

## Transitions and transactions

| From | To | Guard and atomic effects |
| --- | --- | --- |
| New | `QUEUED` | Recheck active owner, validate request and pins, apply idempotency and quotas, insert run in one transaction. A rejected new request creates no run. |
| `QUEUED` | `RUNNING` | Claim oldest eligible row by `(created_at, id)`, recheck active owner and eligibility, insert next attempt, and claim the global slot with a fresh token and deadline in one transaction. |
| `QUEUED` | `CANCELLED` or `EXPIRED` | Authorized cancel, or passed queue deadline during claim/reconcile. No attempt begins. Owner deactivation prevents claim and terminates the queued job as `CANCELLED` with a fixed reason. |
| `RUNNING` | `COMPLETED` | The current unexpired token owns the slot and no cancellation is pending. Atomically insert validated evidence, finish attempt, set terminal timestamps and release slot. |
| `RUNNING` | `FAILED` or `CANCELLED` | Record bounded code and finish attempt, release slot in the same transaction. Pending cancellation wins over unpublished completion and retry. Invalid input, unsupported evaluation and exhausted retry budget are terminal. |
| `RUNNING` | `QUEUED` | Only reconciliation of a lost lease or a classified transient failure may requeue. Close the prior attempt and release its slot atomically. Require remaining attempt budget, an active owner and an unexpired queue deadline. |
| `COMPLETED`, `FAILED`, `CANCELLED` | `EXPIRED` | At retention expiry, remove result/evidence bytes and record expiry atomically. Retain minimal owner, run ID, idempotency key/fingerprint and expiry metadata for the tombstone window. |
| `EXPIRED` | Purged | A bounded explicit cleanup removes the tombstone and dependent records after its window. The old key can be reused only after purge. |

All other transitions fail. A running cancel request records intent while the
attempt still owns the slot. The next executor completion, cancellation check,
or stale-lease reconciliation resolves that intent. If completion commits first,
cancel returns the existing terminal state without changing it. Owner-scoped
mutations, admission counts and claims serialize on a seeded singleton control
row, then lock the target run row in that order. Hold locks only during SQL work.
Finalization checks both run and attempt identity, the opaque lease token, and
the lease deadline under lock. Reclaiming a lease revokes its database write
authority. An orphan child may briefly coexist with a replacement after a
crash, so one slot bounds authorized attempts, while process supervision and
child deadline bound compute. Test stale-writer fencing separately from physical
process cleanup. There is no background recovery in this design.

## Security and failure handling

- Preserve existing auth and denial auditing. Every enqueue, read, cancel and
  download must enforce active analyst/administrator plus owner-scoped lookup.
  Administrators receive no cross-owner bypass in v1. Deny viewer execution and
  downloads. For authenticated callers, absent and foreign IDs receive the
  same response. A local operator may run the dispatcher against a disposable
  database, with no cross-owner report download capability in the dispatcher.
  A later workspace design must verify membership on every object access and
  establish scope-preserving foreign keys before allowing sharing.
- Keep replay tables and code separate from operational events, alerts and cases.
  Pass bounded anonymous fixture snapshots or pinned bundle IDs to the allowlisted
  evaluator. Prohibit user paths, URLs, executable rule content and shell
  interpretation. The child should receive neither deployment credentials nor
  replay database credentials. Persist only safe references, fixed failure
  categories and validated redacted results. Authorization and expiry apply to
  both metadata and evidence. Never log raw telemetry, tokens or report bodies.
- Record owner-authorized actions and fenced attempt transitions with IDs and
  fixed codes. Auth denial auditing stays best-effort through the existing path.
  Attempt and result state records commit atomically. Reject new work at quotas
  with a bounded response. Reconciliation and cleanup use bounded batches.

| Failure | Required behavior |
| --- | --- |
| Process restart or lost lease | The next explicit reconciliation closes the expired attempt. Requeue once if eligible, otherwise fail with a fixed lease-loss or deadline code. A late writer cannot publish. |
| Database disconnect | Refuse new work without a committed claim. On uncertain commit, reload by run/attempt (or owner/key for admission) before deciding whether to retry. If unable to reconnect, leave recovery to lease reconciliation. |
| Worker timeout | Supervisor terminates and reaps the child; discard partial output. If a valid terminal write is possible, finish with `EXECUTION_TIMEOUT`. Otherwise use lease recovery. |
| Duplicate submission | Unique owner/version/key plus fingerprint comparison returns the prior run or conflict, with no second attempt caused by submission alone. |
| Cancellation race | The transaction that records intent or finalizes the result first determines the outcome. Cancelled attempts retain no partial evidence. |
| Invalid fixture/rule or unsupported execution | Validate at admission and recheck pinned identities at execution. Use a terminal fixed code for execution-side incompatible input or unsupported evaluation. Never report a clean pass. |
| Partial persistence or repeated retries | Result and status commit together or roll back. Never publish from an expired token. Only transient infrastructure failures or lost leases may retry, at most once. Expose exhaustion as a terminal failure; no retry loop. |

## Additive migration and rollback

Proposed tables are `replay_runs`, `replay_attempts`, `replay_results`, and a
seeded `replay_execution_control` row. Extend Alembic metadata registration and
add a revision above the reviewed head after rechecking the merge base at
implementation. Existing operational tables and columns remain untouched.
Use a UUID owner FK to `users.id` with `RESTRICT` and define explicit purge
before deleting an owner. Use a composite `(run_id, attempt_no)` key and FK
from results to the producing attempt. Make run IDs unique in results. Child
rows can cascade only when an eligible replay run is explicitly purged.
Use scoped reads and mutations in the repository, with owner included in
tenant-sensitive joins or checked via the parent FK. Workspace RLS, roles and
ownership keys require separate design before hosted multi-scope use.

Add checks for schema/status enums, nonnegative bounded attempt numbers, digest
shape, valid timestamp combinations, configured payload length and status/code
compatibility. Cross-table completion, immutable request fields and slot/lease
consistency require repository transactions and integration tests. Index the
unique idempotency key, `(owner_user_id, created_at, id)` for scoped listings,
partial queued `(created_at, id)` for admission order, and expiry/deadline
columns for bounded maintenance. Evaluate index utility and lock times locally.

Rehearse with disposable loopback PostgreSQL and the existing test safety
guards. Upgrade from the reviewed head and from an empty database, verify
existing operational tables and tests, then exercise concurrent claim/cancel,
connection loss, reapplication and rollback with seeded replay rows. Disable
entry points and stop the executor first if rolling back application code.
Keeping additive tables is the preferred rollback when older code ignores them.
Dropping those tables would destroy replay history. Require verified backups and
a restore drill, explicit retention and recovery decisions, and separate
migration approval before any hosted change. The current startup migration
behavior needs an approved rollout sequence before landing hosted schema changes.

## Implementation sequence

| PR | Objective and expected paths | Tests, security gate and rollback |
| --- | --- | --- |
| 1. State contract | Pure contract and transition tests in `backend/app/services/replay_run_state.py` and `backend/tests/test_replay_run_state.py`. | Exhaustive edges, idempotency semantics, time boundaries, retry budget, expiry and cancellation precedence. Gate on deterministic injected-clock tests and fixed diagnostics. Revert without data impact. |
| 2. Persistence | Add `backend/app/models/replay_run.py`, `backend/app/services/replay_run_store.py`, an additive revision under `backend/alembic/versions/`, metadata wiring in `backend/alembic/env.py`, and `backend/tests/test_replay_run_store.py`. | Disposable PostgreSQL upgrade and rollback, duplicate admission, owner isolation, concurrent claims, quota checks, stale-token fencing and atomic result persistence. No route or worker. Roll back code with additive data retained; destructive downgrade needs backup and approval. |
| 3. Local execution | Add `backend/app/services/replay_run_executor.py`, `backend/tests/test_replay_run_executor.py` and a local runbook under `docs/roadmap/`. | Exercise deadlines, cancel/complete race, crash, disconnect and explicit recovery. Prove replay never writes operational records. Gate on local resource measurements and a manual recovery drill. Stop the command and retain replay rows on rollback. |
| 4. Authenticated access | After security review, add `backend/app/api/routes/replay_runs.py`, `backend/app/schemas/replay_runs.py`, explicit registration in `backend/app/main.py`, and `backend/tests/test_replay_runs_api.py`. | Require per-object denial, duplicate ownership and download tests, throttling, redaction, expiry and sanitized failures. Keep production disabled pending hosting budget, backup, recovery and deployment approval. Disable registration for rollback. |

The next review gate is PR 1. Hosted capacity, operator cadence, workspace
membership, final retention policy and actual deployment prerequisites remain
open. This ADR was validated from source and the repository migration graph.
Database connections, migrations, hosted checks and performance tests were
outside the design review.
