# v2.1-E portfolio baseline

Baseline: `3254304a4369249f48d269cdbd81689df39f4e63` (PR #9 merge), on
`docs/v21e-portfolio-baseline`. v2.1-A recorded the architecture, B established
disposable testing, C characterized live detection and extracted the pure
single-event evaluator, and D recorded local recovery evidence and open
production gates. E inventories the existing SOC portfolio. Entry to v2.2
still requires review of the gates below. [Master build plan](CASE_ZERO_V3_MASTER_BUILD_PLAN.md) · [Baseline audit](v3-baseline-audit.md) · [Live detection contract](v21c-detection-contract.md)

## Current SOC workflows

The sidebar links to Dashboard, Events, Alerts, Cases, Hunt, Intelligence,
Rules, and Playbooks. The table separates current source behavior from prior
evidence. No browser, API, or production smoke tests were run for this record.
[Sidebar navigation](../../frontend/src/components/SidebarNavigation.tsx#L38)

| Workflow | Source-verified v2 behavior | Earlier evidence and remaining smoke checks |
|---|---|---|
| Authentication and RBAC | Login exchanges credentials for a bearer token. Protected calls load an active database user. Roles gate shared reads and analyst or administrator writes. [Login](../../backend/app/api/routes/auth.py#L91) · [Role checks](../../backend/app/auth.py#L140) | Login UI capture and local API tests. Current browser login, logout, and viewer-denial behavior still need a fresh smoke if claimed for this revision. |
| Events and detection | Analysts and administrators ingest events via API. The Events UI lists and opens records. Ingestion evaluates three built-in rules and commits the event and generated alerts together. [Events API](../../backend/app/api/routes/events.py#L31) · [Events page](../../frontend/src/app/events/page.tsx) · [Dispatcher](../../backend/app/services/detection_engine.py#L131) | Local pipeline tests cover persisted alerts, benign input, correlation and rollback. The historical event detail shows an alert pivot. Fresh API-to-browser cross-link smoke is pending. |
| Alert triage and case creation | The alert queue and detail support investigation. Authorized users can update alert status and assignment or create a linked case. Case creation commits the alert link and activity records together. [Alert detail](../../frontend/src/app/alerts/[id]/page.tsx) · [Alert mutation routes](../../backend/app/api/routes/alerts.py#L125) | The v2.0.1 release reports production validation of triage and case linking. Existing captures show linked state. Fresh browser mutation smoke is pending. |
| Case notes and activity | Cases display linked alerts, notes and activity. Analyst or administrator note creation records authenticated attribution and activity. [Case detail](../../frontend/src/app/cases/[id]/page.tsx) · [Notes API](../../backend/app/api/routes/cases.py#L164) | Historical captures and local RBAC tests cover notes and attribution. A fresh browser check can share the triage-to-case smoke. |
| Threat hunting | Analysts and administrators run bounded, filtered queries against operational events. [Hunt UI](../../frontend/src/app/hunt/page.tsx) · [Hunt API](../../backend/app/api/routes/hunt.py#L26) | Historical query and results captures and local role tests. Fresh browser results are unverified. |
| Threat intelligence | The UI lists and opens indicators. All three roles can read them, and analysts and administrators can create and update them through the API. [Intelligence UI](../../frontend/src/app/intelligence/page.tsx) · [Intelligence API](../../backend/app/api/routes/intelligence.py#L34) | Local API role tests. A portfolio capture and fresh browser list-to-detail smoke are missing. |
| Rules and playbooks | Authenticated users can browse the built-in rule and playbook catalogs and open details and rule-linked playbooks. [Rules API](../../backend/app/api/routes/rules.py#L24) · [Playbooks API](../../backend/app/api/routes/playbooks.py#L26) | Historical rule detail and playbook views plus local catalog tests. Fresh browser pivots are unverified. |

The existing test baseline reported for PR #6 is **163 backend passes, 48 focused
passes, and one Starlette/HTTPX deprecation warning** on disposable PostgreSQL
18. PR #6 CI was reported passing. The checked-in workflow covers backend
migration and pytest and a frontend production build. It defines no browser
smoke job. The README's 86 tests are the v2.0.1 release count, and 129 is the
earlier v2.1-B run. Current hosted CI status was not checked offline.
[v2.1-D evidence summary](v21d-recovery-and-replay-safety.md#1-verified-architecture-baseline) · [CI definition](../../.github/workflows/ci.yml) · [README testing history](../../README.md#L916) · [Local recovery evidence](v21d3-recovery-rehearsal.md#local-verification--november-20-2026)

## Portfolio images

The twelve README screenshots are historical UI V2 captures. Reuse the
following for their visible UI state after full-resolution privacy review.
[Release evidence](../../README.md#L1399)

| Existing screenshots | Portfolio use |
|---|---|
| [01](../screenshots/01-login.png), [02](../screenshots/02-dashboard.png) | Sign-in and operational overview |
| [03](../screenshots/03-alert-queue.png), [04](../screenshots/04-alert-investigating.png), [05](../screenshots/05-case-workspace.png), [06](../screenshots/06-case-activity.png) | Alert queue, triage state, linked investigation, notes and timeline |
| [07](../screenshots/07-threat-hunt-top.png), [08](../screenshots/08-threat-hunt-bottom.png), [09](../screenshots/09-event-investigation.png) | Hunt inputs and results, event detail and detection context |
| [10](../screenshots/10-detection-rule.png), [11](../screenshots/11-playbooks.png), [12](../screenshots/12-response-playbook.png) | Rule detail, playbook library and response guidance |

The signed-in views show account and assignment labels. Before republication,
review those labels, event payloads, host and user names, addresses, IDs, command
lines, case text, and any private operational details. Crop or replace captures
that cannot be cleared. The [frontend public assets](../../frontend/public) are
generic SVGs with no workflow evidence.

**Missing captures only:** on a separately approved local run, capture the
Intelligence list or detail with a clearly synthetic indicator. Capture the
Event Explorer list if the portfolio claims list filtering, since the current
event image shows detail. Label each new capture with the revision and local
fixture context. Use the existing images for the remaining views.

## v2 scope and v2.2 entry gate

**Implemented v2:** live SOC ingestion, built-in detections, investigation and
reference workflows. **Planned v3:** isolated deterministic replay, versioned
datasets and rules, grading, and reproducible evidence. Existing UI captures
and the pure evaluator do not establish those v3 capabilities.

- Review the baseline and recovery evidence and record the agreed checkpoint.
  Confirm deployed revisions, migration controls, recovery window and restore
  authority through separately authorized metadata checks. Controlled migration
  failure and previous-app compatibility remain open. [Production readiness](v21d4-production-readiness.md)
- Approve the evaluator attachment point, Lab isolation and ownership, stable
  event ordering, input bounds and evidence identity before v2.2 entry. Keep
  persisted replay and production changes gated on separate isolation,
  migration and recovery evidence. [Proposed decisions](v21d-recovery-and-replay-safety.md)
- **First slice after entry approval:** one built-in pure predicate and one
  bounded synthetic fixture in a local database-free runner and tests. Verify
  identical ordered outputs and stable evidence references across two runs,
  explicit limit failures, and no dependency on live history, ORM models,
  ingestion, or alert and case persistence.
