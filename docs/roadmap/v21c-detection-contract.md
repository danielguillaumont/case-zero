# v2.1-C live detection contract

The live implementation is described at source baseline `5aa4c8b`. The reported
characterization run on disposable PostgreSQL 18 passed 28 focused tests and
143 total backend tests, with one Starlette HTTPX test-client deprecation warning.

## Live ingestion and alerts

`POST /api/events` validates a single event and requires an active administrator
or analyst. The handler adds and flushes the event in its request session, which
assigns its UUID and makes it visible to correlation. It evaluates the event,
adds the returned alerts, and commits both together before refreshing the event
and returning HTTP 201. A failure before commit leaves the uncommitted writes
to be rolled back when the session closes. A failure after commit can leave a
durable event even if the request reports an error.
[Ingestion](../../backend/app/api/routes/events.py#L31) · [Session lifecycle](../../backend/app/database.py#L33)

Enabled built-ins run in this order:

1. `encoded-powershell`
2. `powershell-download-cradle`
3. `auth-brute-force`

Both process predicates can match the same record. The engine returns alerts
in rule order, with severity `high`, status `new`, source `detection-engine`,
and the triggering event UUID. That order describes the engine's return value.
Process alerts include the recorded command line in their descriptions.
Correlation alerts carry the count in their description and link to the
trigger, with no structured links to the other contributing rows.
[Catalog](../../backend/app/services/detection_engine.py#L40) · [Dispatch](../../backend/app/services/detection_engine.py#L156) · [Alert builders](../../backend/app/services/detection_engine.py#L385)

## Authentication correlation

- The trigger must be an authentication failure with a nonempty username and
  source IP. Failure outcomes are `failure`, `failed`, `denied`, and `invalid`
  after string conversion and lowercasing, with no whitespace trimming.
- SQL selects operational authentication rows with equal username and source-IP
  strings in the inclusive interval `[event_time − 5 minutes, event_time]`.
  Python counts qualifying failures among the returned rows, including the
  flushed trigger. Four and six do not match. Exactly five matches. A success
  neither contributes nor resets the count.
- Duplicate submissions are separate rows. Equal-time rows already visible to the
  transaction count together. The query orders by event time without a secondary
  key or candidate cap. A late event is evaluated at its own timestamp, excluding
  future-dated rows. Earlier decisions are never revisited. Concurrent requests
  can see different histories depending on commit timing.
  [Classifier](../../backend/app/services/detection_engine.py#L243) · [Correlation query](../../backend/app/services/detection_engine.py#L319)

## API and evaluation boundaries

Event, alert, and case reads are shared across active viewer, analyst, and
administrator roles. Writes require analyst or administrator. The bearer
dependency loads the current active user, and the role dependency checks the
role on that database record. Ingestion
creates events and alerts. The separate alert-to-case endpoint creates a case,
links the alert, and commits both with two activity rows. An already-linked alert
returns 409 in the sequential path. Its check and update have no explicit row lock.
[Bearer authentication](../../backend/app/auth.py#L35) · [Role checks](../../backend/app/auth.py#L140) · [Event reads](../../backend/app/api/routes/events.py#L79) · [Alert-to-case](../../backend/app/api/routes/alerts.py#L125) · [Case routes](../../backend/app/api/routes/cases.py#L41)

The process predicates and failure classifier operate on event fields without
I/O, although they currently accept ORM objects. Correlation is coupled to the
request session and operational history. Alert construction produces ORM objects
whose persistence belongs to the ingestion handler.

## Proposed evaluator boundary

First extract the single-event decisions behind a small immutable input and
structured result while preserving the current live rule order, alert mapping,
and transaction. Later, pass correlation candidates explicitly to the pure
decision function. The live adapter supplies current SQL history, which already
includes the trigger.

Future replay must use versioned dataset inputs, a documented stable event order,
and bounded state local to one run. It must never query live correlation history,
execute recorded content, write operational events or alerts, or mutate existing
cases, notes, or activities. Store replay evidence in its own scope and authorize
dataset, rule-version, run, and evidence access per object. Equal-time ordering,
duplicate policy, and late-event behavior are replay contract decisions.
[Master build plan](CASE_ZERO_V3_MASTER_BUILD_PLAN.md#63-replay-timing-and-correlation-contract) · [Baseline audit](v3-baseline-audit.md)
