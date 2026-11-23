# v2.6-G3 production merge acceptance

**Decision: NO-GO for merging PR #41 pending the Render exact-artifact rollback
and Vercel production-trigger gates below.** This checkpoint approves no
deployment, database change, or merge.
[ADR 006](v26e-persistent-execution-design.md) ·
[G1 release gates](v26g1-deployment-migration-safety.md#compatibility-and-release-gate) ·
[G2 merge criteria](v26g2-persistence-ci-gate.md#merge-acceptance)

## Reviewed baseline and migration

- GitHub PR #41 is open against `main` from `feat/v26g-replay-run-persistence`.
  Local and remote PR head matched `ecd3c427987aacfab5bf67a8018a4b372b1c708d`.
  GitHub reported `main` at `6b29d255a7916f55f992edeb23e57923059d292b`.
  [PR #41](https://github.com/danielguillaumont/case-zero/pull/41)
- Historical Render source reviewed at `76bb43850f9262e484d6bb4c0238484d4e93c378`.
  Its Alembic revisions match the prior chain ending at `e6ab1b3d315d`. The
  application is launched directly through Uvicorn for compatibility testing.
  Its historical Blueprint startup runs Alembic and is excluded from recovery.
- Migration `c84d31ef7b26` directly follows `e6ab1b3d315d`. Its upgrade creates
  four replay tables, their constraints and indexes, and one replay control
  row. It changes no existing operational columns or rows. The FK to `users`
  can briefly block writes during migration and restrict deletion of users
  who later own replay runs. The downgrade drops all four replay tables and
  their contents. [Migration](../../backend/alembic/versions/c84d31ef7b26_add_replay_run_persistence.py)

## Acceptance matrix

| Gate | Evidence and status |
| --- | --- |
| PR checks | **Verified.** GitHub showed success for Backend Tests, Replay Persistence (PostgreSQL 18), Frontend Build, and Vercel, plus the Vercel Preview Comments status. The persistence job log says nine tests passed with zero skips. [Workflow run](https://github.com/danielguillaumont/case-zero/actions/runs/45062834177) |
| Required check enforcement | **Verified.** GitHub ruleset `27863971`, `CASE ZERO - Main Branch Protection`, is active and targets the default branch (`main`). It requires Backend Tests, Frontend Build, and Replay Persistence (PostgreSQL 18). All three passed on reviewed head `ecd3c42`. The documentation checkpoint creates a new head, so verify its required checks again before merge. [GitHub ruleset](https://github.com/danielguillaumont/case-zero/rules/27863971) |
| Live DDL-free startup | **Operator-attested.** Render deployment `dep-dc1n7s6q1p3s738lu3t0` at `76bb438` uses direct Uvicorn with Auto-Deploy and Blueprint Auto Sync off. Health and authenticated frontend reads passed in the prior release acceptance. No live settings were queried in this review. |
| Recovery point | **Operator-attested.** Production remains at `e6ab1b3d315d`. A snapshot was restored into an isolated Neon branch and the recovered schema and representative counts were checked. This review made no Neon connection. Retention, restore authority, restore timing and the production cutover decision belong to the later migration gate. |
| Exact Render artifact rollback | **Open.** The local rehearsal tests historical application source with DDL-free startup. It cannot prove Render can restore the exact retained build and saved environment. Confirm retention and saved configuration for `dep-dc1n7s6q1p3s738lu3t0` and satisfy G1's exact-artifact rehearsal under separate authorization. [Render rollback behavior](https://render.com/docs/rollbacks) |
| Vercel merge behavior | **Open.** The successful Vercel PR check does not establish production branch tracking, the effective ignored-build rule or promotion behavior. If `main` is tracked for production, merging can trigger a production deployment even though the PR changes no frontend files. [Vercel Git deployment behavior](https://vercel.com/docs/git) |

## Disposable compatibility and rollback rehearsal

The review used the dedicated Compose project `case-zero-v26g3-test` on the
local Docker Desktop Linux engine. The healthy `postgres:18` service exposed
only `127.0.0.1:51173` and used a 512 MiB PostgreSQL tmpfs. The harness matched
the project and service labels, image, mounts, and published port. With
`APP_ENV=test`, a read-only host probe matched the container's cluster
identity, `casezero_test`, `casezero_local_test`, PostgreSQL major 18, and the
expected data directory. It required an empty `public` schema before Alembic.

The harness explicitly upgraded to `e6ab1b3d315d`, seeded a synthetic analyst,
event, case, alert, note, and activity, then upgraded to `c84d31ef7b26` between
the two sets of application checks. Both application trees came from Git
archives of the exact SHAs above and used the same local Python environment.
Uvicorn ran directly with a Windows selector loop and a loopback bind.

| Application source | `e6ab1b3d315d` | `c84d31ef7b26` |
| --- | --- | --- |
| Historical `76bb438` | Passed | Passed after the candidate ran, simulating application rollback with the expanded schema intact |
| Candidate `ecd3c42` | Passed | Passed |

Each of the four launches passed liveness and authenticated profile, database
status, event, alert, case, note, activity, and rules reads. Each left the
revision and table inventory unchanged. The separate migration added exactly
four replay tables and singleton `id = 1`. Exact row snapshots and column
definitions matched across all nine operational tables. The alert-to-event,
alert-to-case, case-to-note and case-to-activity relationships were preserved.
The final run corrected a synthetic email rejected by the historical response
schema during initial setup. No database downgrade was used. Only the verified
disposable container was stopped afterward.

From `backend`, the following database-free suite passed **107 tests**:

```powershell
.\.venv\Scripts\python.exe -m pytest -q --noconftest tests/test_render_deployment_safety.py tests/test_database_config_safety.py tests/test_replay_run_state.py
```

## Separate approvals

1. **Merge:** Confirm the required checks pass on the final PR head under the
   verified ruleset. Obtain the Render rollback evidence above.
   Verify Vercel's production branch, effective skip rules and promotion controls.
   If merge can deploy or promote Production, keep it on hold until the frontend
   owner separately approves that release or verifies an effective hold.
2. **Application deployment:** Approve an exact artifact, DDL-free startup and
   smoke plan. For recovery, prefer application rollback while leaving an
   additive database schema intact. Target the recorded DDL-free deployment ID
   only after confirming the saved command and build availability. Older
   deployments with automatic Alembic startup are excluded even if their Git
   SHA matches. Verify `/api/health`, authenticated `/api/auth/me`, and
   `database: online` from authenticated `/api/status` after any approved action.
3. **Production migration:** Separately approve the target identity and
   `e6ab1b3d315d → c84d31ef7b26` transition, named executor, pinned revision,
   usable recovery point, restore evidence, lock budget and post-change checks.
   A database restore changes data and may require write reconciliation.
   Downgrade destroys replay history. Restore, cutover and downgrade each
   require their own authorization. [G1 controlled procedure](v26g1-deployment-migration-safety.md#controlled-migration-procedure)
