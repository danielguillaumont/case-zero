# CASE//ZERO v2.1-A — Baseline Architecture Audit

**Audit date:** 2026-11-20

**Decision:** GO for further v2.1 verification. NO-GO for beginning v2.2 or changing production schema until the v2.1 exit checks pass.

## Repository baseline

The audit branch is `codex/v21a-baseline-audit` at `f4fb6b9147fef77cf57e9e65fd228fed52cd750f` (2026-09-27, “Polish README and add product walkthrough screenshots”). Local `main`, the locally recorded `origin/main`, and the `v2.0.1` tag pointed to that commit during the source audit. Other local checkpoints were `v2.0.0` at `afa19a1` and `pre-ui-v2` at `db2c488`. The UI V2 merge was followed by the production server-action routing fix at `63c3486` and the README commit at HEAD. The GitHub origin recorded locally is `danielguillaumont/case-zero`. The prior audit did not refresh remote-tracking refs or verify hosted release records.

At the original audit, there were no tracked or staged changes. The repository instructions and master plan were already untracked. An unrelated untracked session Markdown file was also present before this document was saved. The scope of this documentation change is this file.

The [master build plan](CASE_ZERO_V3_MASTER_BUILD_PLAN.md) defines the target architecture and milestone gates. The findings below describe the audited v2.0.1 source unless labeled as historical evidence, an open question, or a proposal.

## Existing architecture

| Area | Source findings |
| --- | --- |
| FastAPI | The [application entry point](../../backend/app/main.py#L76) registers auth, events, alerts, cases, hunt, intelligence, rules, and playbooks. Public health reports application liveness. Authenticated platform status checks database connectivity. Pydantic models validate API payloads. Async SQLAlchemy sessions use psycopg, and route handlers generally own the transaction. [Database wiring](../../backend/app/database.py) and [pinned Python requirements](../../backend/requirements.txt) define the stack. |
| SOC workflows | [Events](../../backend/app/api/routes/events.py#L25) support ingest, list, and detail. [Alerts](../../backend/app/api/routes/alerts.py#L26) support create, list, detail, update, and case creation. [Cases](../../backend/app/api/routes/cases.py#L35) support investigations, notes, and activity. [Hunt](../../backend/app/api/routes/hunt.py) queries event data, [intelligence](../../backend/app/api/routes/intelligence.py) manages indicators, and [rules](../../backend/app/api/routes/rules.py) and [playbooks](../../backend/app/api/routes/playbooks.py) expose read-only catalogs. |
| Next.js | The App Router serves dashboard, events, alerts, cases, hunt, intelligence, rules, and playbooks, plus login. Server-side API calls forward a bearer token. Server actions handle login and alert/case writes. The shared sidebar redirects unauthenticated users and the backend enforces access. The Event Explorer filters fetched data on the client, dashboard counts derive from fetched lists, and some API helpers collapse failures to empty or null results. [Package manifest](../../frontend/package.json), [API helpers](../../frontend/src/lib/api.ts#L200), [sidebar](../../frontend/src/components/Sidebar.tsx), and [Event Explorer](../../frontend/src/components/EventExplorerClient.tsx) show these boundaries. |
| Identity and security | The login route verifies Argon2-backed credentials, issues a JWT, and uses persistent throttling. Protected calls load the current user and enforce active status and the database role. Analysts and administrators can mutate SOC records. Viewers can read shared records and catalogs. Hunt requires analyst or administrator. Role checks on common ID lookups implement shared SOC access. The frontend stores the token in an HttpOnly, SameSite=Lax cookie and uses a Secure host-prefixed cookie in production. Logout clears the cookie. Source also shows trusted-host checks, production config validation, security auditing, and frontend security headers. [Auth route](../../backend/app/api/routes/auth.py#L91), [authorization](../../backend/app/auth.py#L35), [throttle](../../backend/app/services/login_throttle.py#L112), [audit writer](../../backend/app/services/security_audit.py), [cookie actions](../../frontend/src/app/login/actions.ts#L131), and [frontend config](../../frontend/next.config.ts). |
| CI and deployment | The [CI workflow](../../.github/workflows/ci.yml) defines Python 3.12 and PostgreSQL 18 for Alembic upgrade and pytest, and Node 22 with the [npm lockfile](../../frontend/package-lock.json) for a production build. It defines no separate lint or browser test job. [Compose](../../compose.yaml) defines a PostgreSQL 18 development service with a named volume. The documented topology is Vercel to Render to Neon. The [Render blueprint](../../render.yaml#L3) defines a free Python web service with auto-deploy disabled and runs Alembic before Uvicorn on startup. That startup sequence couples a migration-bearing release to schema changes. The original audit observed a successful Vercel commit status and no results from a PR-filtered workflow lookup. Current deployment revisions, push-triggered CI results, provider settings, and database health remain unverified. |

## Detection and operational side effects

1. `POST /api/events` accepts one JSON event. The route adds and flushes the event, evaluates it within the same session, adds generated alerts, then commits. The flush makes the event available to correlation and assigns its ID. The transaction persists the event and generated alerts together. [Ingest route](../../backend/app/api/routes/events.py#L31)
2. The engine dispatches three enabled code-defined rules: encoded PowerShell, PowerShell download activity, and repeated authentication failures. The two PowerShell checks are single-event boolean predicates. The built-in metadata dictionary provides rule IDs and ATT&CK mappings. The dispatcher constructs operational alert objects. [Rule catalog and dispatcher](../../backend/app/services/detection_engine.py#L35) and [single-event predicates](../../backend/app/services/detection_engine.py#L271)
3. Authentication correlation queries operational events for exact username and source-IP equality in an inclusive five-minute interval ending at the incoming event time. It loads candidate rows, filters authentication failures in Python, and matches only at a count of five. It sees the just-flushed event. Source shows no explicit candidate cap, stable tie-breaker, deduplication, or late-event reconciliation. Concurrent transactions can affect the history visible to evaluation. These semantics need characterization before they become part of a replay contract. [Correlation](../../backend/app/services/detection_engine.py#L319)
4. Operational alerts record a string rule ID and the triggering event ID. The correlation alert carries a count in its description without structured links to all contributing events. PowerShell alert descriptions include command-line text, and the event API exposes raw data. The event schema bounds several strings but leaves command-line length and raw-data size unrestricted at field level and accepts generic datetime and string IP values. That source behavior does not establish deployed gateway limits. [Alert builders](../../backend/app/services/detection_engine.py#L385) and [event schemas](../../backend/app/schemas/security_event.py#L12)

## PostgreSQL and migration graph

The schema stores events, alerts, cases, case notes and activity, threat indicators, users, login throttles, and security audit events. Alerts have nullable foreign keys to their source event and case, both with `ON DELETE SET NULL`. Case notes and activity have case foreign keys with cascading deletion. Analyst assignment, note author, and activity actor are text. Alert-to-case creation updates the link and writes activities in one transaction. The check-then-link path has no explicit row lock in source, so concurrent behavior is a verification item. [Alert model](../../backend/app/models/alert.py#L49), [case note](../../backend/app/models/case_note.py), [case activity](../../backend/app/models/case_activity.py), and [alert-to-case route](../../backend/app/api/routes/alerts.py#L125)

The 12 checked-in revisions form one linear graph by static inspection, from the [initial alerts revision](../../backend/alembic/versions/eea5adb9d01c_create_alerts_table.py#L15) to the [security audit revision](../../backend/alembic/versions/e6ab1b3d315d_add_security_audit_events.py#L15):

```text
eea5adb9d01c -> 7569ef061300 -> c1a516f709f9 -> 197022cc8170
-> 06612ab28a83 -> 940cff539727 -> a6cf4ba02c3a -> 0095cb51a35d
-> 8641d2165e62 -> 67c33445e501 -> 4748431cbcbf -> e6ab1b3d315d
```

**Current source head:** `e6ab1b3d315d`. [Alembic's environment](../../backend/alembic/env.py) uses application connection configuration and SQLAlchemy metadata. The applied production revision, model/schema drift, fresh and prior-schema upgrade results, backup retention, restore capability, and rollback permissions remain unverified.

## Test and runtime evidence

- The prior static source count was **99 test function definitions across 14 files**. Coverage includes password and token handling, auth and admin bootstrap, login throttling, audit, application security, role guards, and operational API behavior. The [detection tests](../../backend/tests/test_detection_engine.py#L108) cover single-event matches and benign controls as well as the four-versus-five correlation threshold. The [pipeline tests](../../backend/tests/test_event_pipeline.py#L148) cover persisted event-to-alert behavior. The [README](../../README.md#L918) records **86 passing tests** as historical evidence. A fresh collection and pass count are pending.
- The [test bootstrap](../../backend/tests/conftest.py) sets the test database name and signing key. Other connection settings, including the host, still come from [application config](../../backend/app/config.py#L132). Verify the disposable test host before importing or running the suite.
- The previous audit observed Windows PowerShell 5.1, Python 3.12.2, Node 22.15.0, and Docker CLI 29.8.1. The Docker version command reported access denied for user config. Daemon and container state were unverified.
- Backend tests, frontend lint and build, browser and accessibility smoke tests, dependency installation and vulnerability checks, migrations, and backup/restore rehearsal were outside the executed audit checks. No production systems were accessed while saving this document.

## v3 architecture and prioritized risks

**Preserve** FastAPI, Next.js, PostgreSQL/Alembic, the existing session and role guards, the live ingestion transaction, the analyst shell, and event/alert/case pivots. Retain built-in rule IDs for existing SOC records.

**Refactor** the single-event predicate boundary first. Define an explicit evaluator input and structured outcome. Keep operational SQL history and alert construction in the live adapter. Give replay only its scoped inputs, logical event ordering, run state, and isolated output persistence. Characterize live behavior before changing shared semantics.

**Extend** incrementally with immutable dataset and rule versions, mapping and evaluator identity, labeled positive and negative expectations, outcome grading, bounded evidence traces, and explicit case pivots. Add one licensed external dataset and a narrow supported rule subset with explicit unsupported results. Defer production execution and anonymous demo decisions until isolation, restart behavior, quotas, and hosting constraints are verified. Recorded telemetry is evaluated as data. Rule content and event fields must never trigger command execution.

| Priority | Concern | Evidence needed |
| --- | --- | --- |
| Critical | Replay reusing operational ingest or SQL-backed correlation could read shared SOC history or write live events and alerts. | Approve an isolation design and test that a replay cannot read operational correlation history or write operational events, alerts, cases, or activities. |
| Critical | Production schema and recovery are unverified. Render runs migrations as part of startup. | Verify deployed revision and backup availability through separately authorized, sanitized checks. Rehearse fresh and prior-schema upgrades, restore, and application rollback on disposable PostgreSQL before a migration-bearing release. |
| Critical for private Lab data | Shared RBAC lacks object scoping for future datasets, runs, reports, and comparisons. Raw event evidence can contain sensitive values. | Approve owner/workspace policy, cross-owner denial tests, evidence redaction, and isolated demo scope before exposure. |
| High | Correlation can vary with arrival order and concurrent visibility. Incomplete rule support or missing evidence can make grades misleading. | Test exact time bounds, ties, duplicates, grouping, and contributing evidence. Grade only labeled cases and surface unsupported logic and errors independently. |
| High | Operational list queries, correlation candidate loading, and raw events can consume substantial resources. Imported datasets increase the load. | Establish limits for bytes, records, nesting, execution time, and result size. Benchmark representative workloads before choosing indexes or execution infrastructure. |
| High | Runtime and CI evidence is incomplete, and tests can inherit connection settings. Frontend API failures may appear as empty views. | Pin isolation for the test database, record fresh results, and verify authenticated analyst workflows against known expected data. |
| Medium | Nullable evidence links, text actor fields, and possible concurrent alert-to-case creation limit provenance. | Characterize existing behavior and use stable identities for new Lab evidence. Explicitly represent unavailable evidence. |

## Next v2.1 slices and acceptance criteria

| Slice | Scope and acceptance |
| --- | --- |
| **B — Test truth** | Verify the disposable database host, then run the existing backend suite and frontend production build. Include lint where supported. Record exact commands, versions, collection and pass/fail counts, and CI results tied to a commit. Gate: checks pass or reproducible blockers have reviewed dispositions. |
| **C — Schema and API contract** | Record the role/route matrix, transaction boundaries, model relationships, and migration graph. Characterize the existing correlation and alert-to-case paths with focused checks. Gate: reviewers approve the preserved live contract and the evaluator attachment point. |
| **D — Safety checkpoint** | Verify the deployed revision, backup and restore procedure, release controls, feature flags, and rollback responsibilities through separately approved work. Draft ADRs 003–006 for replay isolation, rule representation, compatibility, and execution. Gate: disposable upgrade and recovery evidence is reviewed and the additive migration and isolation plans are approved. |
| **E — Portfolio baseline** | Capture sanitized screenshots and smoke evidence for login, event-to-alert, and alert-to-case workflows with notes and activity. Gate: publishable evidence identifies the checkpoint, verified capabilities, and open limitations. |

The source snapshot, architecture map, and static Alembic graph are complete. **GO** for v2.1-B through v2.1-E after review and separate authorization for their checks. **NO-GO** for beginning v2.2 until the test baseline is accepted, production schema and recovery are understood, the migration path is rehearsed, and the evaluator and replay isolation boundaries are approved. Runtime isolation itself is a v2.2 acceptance gate.
