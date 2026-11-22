---
title: "CASE//ZERO"
subtitle: "Detection Proof Engine — Master Build Plan v1.0"
author: "Development roadmap | First-person project specification"
date: "8 November 2026"
lang: en-CA
---

# CASE//ZERO

**DETECTION PROOF ENGINE**
**MASTER BUILD PLAN | v1.0 | 8 NOVEMBER 2026**

**Product statement:** *Replay the attack. Find the gaps. Prove the fix.*

**Repository:** https://github.com/danielguillaumont/case-zero
**Current documented release:** v2.0.1 (UI V2 Production Patch)
**Target release:** v3.0 (Detection Assurance & Investigation)
**Primary workstation:** Windows / PowerShell 5.1
**Document role:** Source of truth for scope, architecture decisions, milestone gates, tests, and portfolio evidence.

> **My commitment:** I am building CASE//ZERO to demonstrate serious, employable cybersecurity and software-engineering skills. I will prioritize an independently testable security result over feature count, cosmetic novelty, or unnecessary infrastructure. This plan is a living engineering contract: I will update decisions as evidence changes without quietly expanding the mission.

---

# 01 | Executive decision and success standard

## 1.1 What I am building

I am evolving CASE//ZERO from a cloud-hosted SOC investigation simulator into a **detection assurance and investigation platform**. Its central task is to let a security engineer import a supported rule and event dataset, replay a known security scenario, compare actual rule matches with expected outcomes, locate misses and unintended matches, and verify that a proposed rule change does not introduce regressions.

The new main journey is **Select scenario -> Evaluate rule -> Understand result -> Adjust rule -> Rerun -> Prove outcome**. Existing event, alert, case, threat-hunting, and response workflows will remain meaningful, but no longer define the entire product identity.

**Product promise:** *Would this security detection catch the behavior it claims to catch, and can I reproduce the answer?*

**One-line pitch for a recruiter:** I built a cloud-deployed security detection-validation platform that replays labeled attack telemetry, tests versioned detection rules, and explains missed detections through reproducible evidence and automated regression checks.

This pitch describes the **target product**. I will not present it as a completed implementation until the acceptance gates in this document pass.

## 1.2 Who I am building it for

| Persona | Job to be done | Evidence that the product helped |
|---|---|---|
| Detection engineer | Test whether a rule catches known malicious behavior and avoids known benign behavior | Pass/fail per expectation, event-linked traces, rule-version comparison |
| SOC engineer / threat hunter | Reproduce why an alert fired or why expected activity was missed | Executable replay, exact source events, explainable rule conditions |
| Security student / home-lab practitioner | Learn how detections behave without deploying an enterprise SIEM | One-click isolated demo and downloadable compatible sample fixtures |
| Hiring manager / interviewer | Assess my engineering rigor quickly | Working public demo, CI evidence, tests, source documentation and architecture decisions |

The first production-quality user is a **technical individual or small security team**, not a large enterprise replacing its SIEM. I will validate utility with practitioners rather than equate an attractive demo with product-market fit.

## 1.3 Definition of flagship success

A successful v3.0 release must provide **all** of the following:

1. At least one supported, independently sourced security dataset and one supported rule from outside CASE//ZERO's original built-in rule set.
2. Deterministic, isolated replay with explicitly documented event-time semantics, deduplication, and correlation behavior.
3. Labeled positive and negative test cases; a result report that distinguishes matches, misses, unintended matches, errors, and unsupported coverage.
4. A deliberately weakened rule that demonstrably fails a regression gate, followed by a corrected version that passes.
5. Event-to-evaluation-to-rule-version-to-investigation provenance with retrievable evidence; no invented AI citations.
6. Automated backend, API, integration, and browser tests with a clean CI result.
7. An understandable public, sanitized, bounded demo that cannot mutate operational production data.
8. A verified cloud deployment and reproducible local setup, with documented operational limits and failure modes.
9. A clear README, architecture diagrams, ADRs, screenshots, a short walkthrough, and a defensible resume story.
10. A limited external review by at least one knowledgeable user if feasible; otherwise an explicit note that external usability validation is outstanding.

**Non-goal:** proving a detection works against *all* possible attacks. A successful test proves behavior only for the named rule, evaluator version, mapping, dataset, and labeled expectations.

## 1.4 Guardrails and anti-goals

- I will **not** build a general SIEM replacement, network packet analyzer, home firewall, or unrestricted autonomous SOC in v3.
- I will **not** invent a universal Sigma executor. Only tested, documented rule semantics count as supported.
- I will **not** execute uploaded scripts, binaries, PowerShell commands, or offensive tools as part of replay. Replay consumes **recorded data**.
- I will **not** modify current production data through a demonstration or use public demo accounts with broad write access.
- I will **not** introduce Kafka, Kubernetes, distributed agents, microservices, or paid background workers just for resume keywords.
- I will **not** add agentic AI before the deterministic evaluator, event provenance, and regression harness work.
- I will **not** do another wholesale UI redesign. I will design the new primary workflow while retaining useful v2 surfaces.
- I will **not** merge a milestone based only on a green frontend build or screenshot. The end-to-end security behavior must pass its specific acceptance tests.

# 02 | Baseline: what exists and what is still unverified

## 2.1 Documented v2.0.1 foundation

The public repository currently identifies **v2.0.1** as the UI V2 production patch. Its README describes eight SOC workspaces, including dashboard, events, alerts, cases, hunt, intelligence, rules, and response playbooks. It documents event ingestion, single- and multi-event detection, alert generation, analyst assignment, case notes and activity, threat intelligence correlation, JWT/HttpOnly authentication, RBAC, Argon2, PostgreSQL/Alembic, and GitHub Actions. It reports **86 passing backend tests at that release checkpoint**, not a newly observed November test result.

| Area | Documented state | v3 disposition | Verification required before edits |
|---|---|---|---|
| Frontend | Next.js / React / TypeScript / Tailwind on Vercel | Retain and extend | App build, package versions, authenticated flows, public-demo approach |
| Backend | FastAPI / Python, REST API on Render | Retain and refactor selectively | Route inventory, dependencies, service boundaries, test suite |
| Database | PostgreSQL on Neon, Alembic migrations | Retain with additive schema | Schema, indexes, constraints, backup/restore test, migration head |
| Detection | Existing single-event and correlation paths; three documented example detections | Evolve to versioned rule execution and trace | Actual source logic, supported fields, deterministic behavior |
| SOC workflow | Event -> alert -> case, investigation and notes | Preserve | Relationship integrity, authorization and regressions |
| Authentication | JWT, cookies, Argon2, RBAC, persistent login throttling | Preserve/harden | Production settings, user roles, session behavior |
| CI | Backend test workflow plus frontend production build | Expand | Workflow files, DB service, branch protection, job result |
| Deployment | Vercel frontend; Render API; Neon Postgres | Retain until evidence calls for change | Actual live health, free-tier limitations, environment configuration |
| UI | UI V2 released and production workflow patched | New replay-focused journey | Accessibility, desktop/mobile behavior, screenshot baseline |

**Known infrastructure constraint:** The public `render.yaml` currently describes a Python **free-plan web service** with manual production configuration and `autoDeployTrigger: off`. I must not assume an always-on paid background worker exists. A job design must work locally first, then receive an explicit deployment decision after validating actual hosting limits.

## 2.2 What I must not assume

The public README and repository pages are **not a fresh local source/runtime audit**. Before coding I need to establish: the actual branch and commit; status of remote deployments; migration graph; event and detection model details; test commands and current pass counts; exact import/export interfaces; existing source code layout; actual quotas/costs; current dependency versions; and whether deployed records contain anything that requires preservation.

I should capture a `baseline-audit.md` with evidence, not fill unknowns with plausible architecture. Every subsequent milestone begins from that written snapshot.

## 2.3 Initial audit deliverables (v2.1 gate A)

1. Read-only Git snapshot: branch, HEAD, tags, origin, clean/dirty state, recent history and workflow files.
2. Local stack check: Python/Node/Docker versions, environment templates, running containers, install lockfiles.
3. Backend truth: models, tables, Alembic heads, API routes, authorization guards, validation, detection code and test structure.
4. Frontend truth: route list, server actions/API boundary, authentication flows, production build and top usability problems.
5. Production truth: Vercel/Render/Neon configuration, non-sensitive status checks, backups, deployment permission model, and rollback path.
6. Risk inventory: secrets exposure, demo isolation, file import handling, overly broad queries, migration hazards, third-party dependencies.
7. Updated `docs/roadmap/v3-baseline-audit.md` stating confirmed facts, hypotheses and blockers.

**Baseline gate:** no database-changing work until the source snapshot, migrations, backup recovery procedure, tests, and current production behavior are understood.

# 03 | Product requirements and user journeys

## 3.1 Primary journey: test a detection

The landing experience prioritizes a new **Detection Lab** workflow while preserving existing analyst navigation.

1. **Choose input:** a safe included scenario, supported uploaded event dataset, or saved test fixture.
2. **Choose rule:** a current supported rule/version or a validated imported rule with explicit compatibility status.
3. **Review test contract:** event schema, labeled expectations, event count, rule version, evaluator version, limits and estimated resource use.
4. **Execute:** create an isolated replay run and receive progress or a clear synchronous result for small runs.
5. **Review diagnostics:** matched events, missed expectations, unwanted matches, evaluation errors, unsupported operators and missing fields.
6. **Inspect evidence:** open the original normalized record, mapping, rule expression and condition-level trace.
7. **Compare:** change or select a new rule version; rerun with the same inputs; compare outcomes, false-positive cases and processing errors.
8. **Document:** export a reproducibility manifest and optionally open an analyst case linked to the validation finding.

The main page should answer within **30 seconds**: *what was tested, what passed, what failed, and what I should inspect next?*

## 3.2 Secondary journeys

**Rule author:** validate metadata and schema; create a new immutable version; run named unit fixtures; inspect validation errors; submit only after tests pass.

**Investigator:** pivot from a failed expectation into the original event(s), relevant rule version, correlated context and case history.

**Recruiter/demo visitor:** select a bounded synthetic example, run a safe preconfigured comparison, view the result without signing into a privileged analyst account, and optionally inspect source and CI evidence.

**Operator:** determine if an import/replay job failed, why, how much data it processed, whether an event was dropped, and whether the system remained within quotas.

## 3.3 Prioritized requirements

| Priority | Requirement | Why it matters |
|---|---|---|
| P0 | Isolated, repeatable replay on documented normalized events | Core product proof |
| P0 | Known labeled expectations; match/miss/error classification | Trustworthy results |
| P0 | Immutable rule versions and evaluator version capture | Reproducibility |
| P0 | Positive/negative fixtures and CI fail/pass on regression | Professional engineering proof |
| P0 | Traceable event and rule provenance | Explainability |
| P0 | External dataset + limited documented external rule support | Usefulness beyond built-in simulator |
| P0 | Secure imports, authorization, bounded jobs and demo isolation | Safe to operate publicly |
| P1 | Before/after comparison, reports and rich investigation pivots | Main usability multiplier |
| P1 | Multi-event correlation test suite with precise time semantics | Domain depth |
| P1 | Production observability and performance budgets | Operational credibility |
| P2 | AI-assisted explanation, limited to evidence-backed read-only tools | Helpful, not authoritative |
| P2 | More adapters and domain-specific starter packs | Broader applicability |
| Not v3 | Live attack execution, automated containment, full SIEM ingest | Avoid scope explosion |

## 3.4 Terms I will use precisely

- **Scenario:** a versioned set of input events, context and expected outcomes.
- **Dataset:** a versioned collection of raw or normalized event records with stated origin, license and schema.
- **Test case:** a specific expectation for a rule, scenario and input subset; may be positive, negative or error-oriented.
- **Replay:** deterministic evaluation of recorded events, not an attack executor or packet replayer.
- **Coverage:** the fraction of *labeled expectations in a specific suite* satisfied; not universal attack coverage.
- **Miss:** a documented expected detection that did not occur under declared semantics.
- **Unwanted match:** a match on an explicitly labeled benign case; not necessarily a real-world false-positive rate.
- **Unsupported:** a rule/operator/data shape the evaluator cannot correctly execute; never counted as a clean pass.
- **Evaluation trace:** structured information explaining which normalized fields and conditions contributed to a result.
- **Finding:** persisted conclusion from an evaluation linked to run, rule, scenario and evidence.

# 04 | Architectural north star and design choices

## 4.1 System structure

The system will remain a Python/TypeScript/PostgreSQL application, not become a new microservices portfolio project. I will introduce clear boundaries inside the backend: adapters and normalization, immutable rules, compiler/evaluator, replay orchestration, outcome grading, evidence persistence, reporting, and investigation integration.

```text
Browser / Next.js (existing protected analyst UI + safe public demo)
        |
        v
FastAPI control API (auth, RBAC, validation, quotas, job creation)
        |
        +--> Scenario / Dataset Registry --> Ingest + Normalize --> Immutable events
        |                                             |
        +--> Rule Registry --> Validate/Compile --> Evaluator + correlation state
        |                                             |
        +--> Replay Job Coordinator ------------------+
        |                   |                         |
        |                   +--> isolated run results + grade against expectations
        |                                                   |
        +--> Diagnostics / Compare / Report <-------------+ |
        |                                                   |
        +--> Existing Event / Alert / Case pivots <---------+
        |
        v
PostgreSQL (operational tables + isolated replay domain + audit records)
```

**Important:** the existing live/event-ingestion path and the replay path should share one versioned evaluation contract. They need not share every side effect. Replay MUST NOT trigger operational production alerts through the normal alert-persistence path.

## 4.2 Core architectural decisions to record as ADRs

| ADR | Decision to settle | Default recommendation | Evidence needed |
|---|---|---|---|
| 003 | Replay isolation | Separate replay tables and namespace; no operational alert writes | Auth + integration tests |
| 004 | Rule representation | Immutable rule versions + constrained internal AST | Semantics and parser spike |
| 005 | Sigma compatibility | pySigma parse/validate where appropriate; explicit supported subset | Compatibility fixtures |
| 006 | Replay execution | Local in-process/small-job prototype; persistent jobs for production | Timeouts, load and hosting audit |
| 007 | Event timestamps | Event-time ordered replay with deterministic ties and window bounds | Adversarial tests |
| 008 | Demo environment | Read-only seeded demo or isolated expiring runs; no shared privileged account | Abuse tests and deployment constraints |
| 009 | Evidence integrity | Immutable inputs, hashes/manifests, version binding | Export/re-run comparison |
| 010 | AI investigator | Deferred, read-only, tool-restricted, evaluation-gated | Deterministic core complete |

ADRs are proposed identifiers. I will reconcile them with any existing ADR numbering during v2.1.

## 4.3 Proposed internal components (subject to source audit)

`normalization/`: imported schemas, field mapping, source metadata and diagnostics.
`rules/`: definitions, immutable versions, validation and compatibility reports.
`evaluation/`: deterministic predicates, Boolean logic, condition trace and correlation state.
`replay/`: job state, input ordering, dataset binding, result persistence and cancellation.
`grading/`: expectation comparison, pass/fail classification and metrics.
`reports/`: machine-readable manifest, safe report rendering and export.
`integrations/`: narrow adapters for approved formats, future telemetry sources and existing cases.
`api/`: scoped routes for datasets, scenarios, rule versions, runs, comparisons, report downloads.
`observability/`: structured log fields, counters, durations, job lifecycle, audit events.

These are **design boundaries**, not instructions to create empty directories before implementation. Prefer incremental refactoring with existing tests green.

# 05 | Domain model, provenance and persistence

## 5.1 Proposed data entities

| Entity | Purpose | Important fields / relationships |
|---|---|---|
| `dataset` | Provenance and content identity | id, owner_scope, source/license, schema_version, checksum, record_count |
| `dataset_event` | Immutable test telemetry | dataset_id, stable event_id, event_time, raw_metadata, normalized fields, ordinal |
| `scenario` | Versioned test collection | scenario_id, version, dataset version, display title, visibility |
| `expectation` | Ground-truth contract | scenario_version, rule target, event/group identity, expected result, rationale |
| `rule_definition` | Logical rule identity | stable id, title, source format, tags, target logsource |
| `rule_version` | Immutable rule content | rule_id, version/content hash, validated syntax, supported status, metadata |
| `evaluator_version` | Reproducibility | semantic version, supported operators, field mappings |
| `replay_run` | Execution manifest and status | id, requester, scenario, dataset, rule_version, evaluator, state, timestamps |
| `evaluation_result` | Per-event/correlation result | run, event refs, match state, condition trace, error/unsupported reason |
| `run_grade` | Labeled outcome comparison | run, expectation, pass/fail, match refs, grade reason |
| `run_comparison` | Two-run comparison | left/right run IDs, stable expectation IDs, diff summary |
| `export_manifest` | Evidence package | run IDs, hashes, schema versions, generated_at, file hashes |

The names are conceptual and require checking current SQLAlchemy models, migration dependencies, and user ownership design. I should extend the existing database without renaming/destructively migrating operational tables unless an ADR proves it necessary.

## 5.2 Critical invariants

1. A committed rule version and dataset version are immutable. Edits create new versions.
2. Every replay result binds to the exact rule content hash, evaluator version, schema mapping, dataset hash, expectation version and execution configuration.
3. A replay run can never create or silently update operational alerts or investigation history. Any subsequent case creation is an explicit, audited action.
4. A run is idempotently identifiable; repeated requests with the same idempotency key cannot create uncontrolled duplicate jobs.
5. Deleted or unavailable source evidence is reported as missing; the system cannot silently substitute other data.
6. Results are access-controlled to their owner/workspace. Demo data cannot expose privileged tenant records.
7. Any export includes safe metadata and the provenance needed to reproduce results. Sensitive raw data is excluded by default.
8. A run report distinguishes evaluation failure, data unsupported, incomplete input and genuine rule miss.

## 5.3 Data migration strategy

- Use **expand -> backfill/verify -> switch -> contract** migrations. Prefer additive nullable tables/columns at first.
- Every migration requires a reviewed plan, a production backup/recovery procedure, local migration tests, and a rollback strategy that recognizes some database migrations are not safely reversible.
- Do not reseed or reset Neon production data. Keep demo fixtures in separate tables/scope or an isolated environment.
- Add indexes only after query patterns exist; benchmark actual access paths and migration impact.
- Record the current Alembic head and demonstrate a clean migration from a fresh database and from a copy of the prior schema.
- Enforce uniqueness, foreign-key constraints and stable content identifiers at the database boundary where appropriate.

# 06 | Detection-language compatibility and evaluation correctness

## 6.1 Rule format strategy

I will use a small internal evaluation representation (AST) with explicitly implemented operators. Source input may be native CASE//ZERO JSON/YAML and a validated **subset of Sigma**. pySigma can help parse/validate Sigma content and process field mapping, but does **not** by itself provide a correct executor for this project's event schema.

**First supported semantics (proposal):** exact equality, explicit case-folded text matching where documented, `contains`, `startswith`, `endswith`, simple `AND/OR/NOT`, existence checks, and bounded allowed field types. Include well-defined wildcard semantics only after tests.

**Deferred until separately tested:** arbitrary regex, advanced modifiers, encoded transformations, cross-rule correlations, aggregation functions, threshold semantics beyond the implemented correlation contract, and platform-specific backend query constructs.

Unsupported features must produce a structured validation result that explains why the rule cannot execute. Never downgrade unsupported logic into a partial match without explicit disclosure.

## 6.2 Field mapping requirements

- Introduce a versioned mapping document from each supported dataset format to CASE//ZERO normalized fields.
- Preserve original event context and conversion diagnostics.
- Distinguish `missing`, `null`, `empty`, and an unsupported type. These may have different rule semantics.
- Normalize timestamps to UTC while preserving source timestamp/offset metadata where available.
- Preserve `source_event_id`, dataset ordinal, hostname, principal, process name, command line, and relevant IPs when present.
- Never fabricate a missing required value merely to satisfy a detection rule.
- Clearly document any lossy normalization or transformed encodings.

## 6.3 Replay timing and correlation contract

- Default ordering: normalized event timestamp ascending; stable original ordinal (or stable ID) as the tie-breaker.
- Choose and document whether window start/end are inclusive or exclusive, e.g., `[start, end)`; test exact-boundary events.
- Treat out-of-order ingestion independently from deterministic replay ordering.
- Define correlation group keys, rule state reset, memory bounds, time-window expiry and deduplication.
- An evaluator must not leak state between runs or user scopes.
- Cancellation and retry must preserve a clearly defined terminal run status; no partial run may be presented as a complete pass.
- Replay clocks are logical event clocks: tests must not depend on the real wall clock unless testing timeouts.

## 6.4 Core grading model

For explicitly labeled event or episode expectations, classify outcomes as TP, FP, FN and TN **only where ground truth exists**. Calculate precision and recall on that labeled subset, clearly reporting its size. A correlation rule may produce an alert spanning multiple events, so grading must compare expectation identities/episodes rather than blindly treating every event as an independent classification.

A clean pass requires: all mandatory expected positives detected, expected negatives not matched, no evaluator errors, no unsupported semantics, and no missing mandatory evidence. Display separate error/unsupported counts; do not hide them inside a coverage percentage.

**Trace design:** record rule version, condition tree, evaluated field names, sanitized tested values, operator result, and contributing event references. The trace should be bounded; avoid embedding secrets or arbitrary massive log fields.

# 07 | Test datasets, threat scenarios and research discipline

## 7.1 First scenario pack

| Scenario | Primary event type | Expected learning outcome | Candidate release |
|---|---|---|---|
| Encoded PowerShell | Process creation | Matching variants and non-matching benign processes | v2.2-v2.3 |
| PowerShell download activity | Process/command line | Conditions, modifiers and normalization differences | v2.3 |
| Authentication brute force | Authentication sequence | Sliding window, identity grouping, time boundaries | v2.4 |
| Benign administrative PowerShell | Process creation | Negative expectations and false-positive controls | v2.3 |
| Windows/Sysmon sample import | External structured events | Mapping, import validation, independent provenance | v2.4 |
| Identity/cloud audit sample | Authentication / audit | Future adapter reuse without a Cloud Change pivot | Post-v2.5 optional |

Do not claim real intrusion detection because a synthetic scenario passes. Label **synthetic**, **captured lab**, **public licensed dataset**, and **external user sample** distinctly.

## 7.2 Dataset acceptance process

1. Record original source, publication date, author/license, download location, checksum, format, event schema and permitted redistribution.
2. Verify the data does not contain real passwords, access tokens, personal information, or identifiable third-party secrets before shipping a public fixture.
3. Determine what ground truth is actually supported. If only high-level scenario labels exist, do not invent event-level labels.
4. Normalize through a versioned adapter. Publish mapping tests and input validation behavior.
5. Store immutable test fixture snapshots with manageable size and stable expectations.
6. Include at least one negative/control dataset designed to reveal overmatching.
7. Preserve independent test cases that were not authored to make the rule pass.
8. Track dataset changes by version and re-run the full compatibility suite whenever mapping code changes.

## 7.3 Fuzz and adversarial tests

Test missing fields, nulls, very long values, hostile Unicode, control characters, nested JSON, duplicate event IDs, weird time zones, clock skew, invalid IPs, malformed YAML, oversized uploads, decompress bombs, pathological rules, unsupported modifiers, and cancellation during processing. The import parser must treat all event content as untrusted.

# 08 | API, jobs and deployment strategy

## 8.1 Proposed v3 routes (draft contracts only)

| Operation | Proposed endpoint | Authorization / notes |
|---|---|---|
| Browse scenarios | `GET /api/lab/scenarios` | Viewer + scoped demo access |
| Inspect scenario | `GET /api/lab/scenarios/{id}` | Sanitized metadata |
| Import dataset | `POST /api/lab/datasets` | Authenticated analyst/admin, size/rate limits |
| Validate a rule | `POST /api/lab/rules/validate` | Safe parse only, no arbitrary code execution |
| Register rule version | `POST /api/lab/rules/{id}/versions` | Privileged, immutable versioning |
| Start replay | `POST /api/lab/runs` | Scope, quota, idempotency key |
| Inspect run | `GET /api/lab/runs/{id}` | Strict ownership/read scope |
| Get diagnostics | `GET /api/lab/runs/{id}/results` | Cursor pagination, bounded payload |
| Compare runs | `POST /api/lab/comparisons` | Both runs must be authorized and compatible |
| Export report | `GET /api/lab/runs/{id}/report` | Scoped, sanitized, content-type safe |

Before implementation, compare these draft routes against existing FastAPI prefixes, OpenAPI schemas and naming conventions. Do not expose raw SQL or arbitrary expression execution through an API.

## 8.2 Replay run state machine

`QUEUED -> RUNNING -> COMPLETED` or `FAILED`, `CANCELLED`, `EXPIRED`. State transitions should be validated atomically; include timestamps, progress, counts, error codes, resource limits and provenance. Retrying a failed job creates an auditable new attempt or an explicitly idempotent resume; it does not overwrite evidence.

## 8.3 Worker decision tree

1. **Proof-of-concept locally:** small, bounded synchronous or controlled in-process execution with strict time and record limits, solely to prove semantics.
2. **Production-quality run execution:** durable state and recovery. Evaluate a small separate worker, a short bounded execution model, or a provider-supported jobs service only after measuring operational needs and current hosting plan constraints.
3. **Operational decision gate:** document what happens on web-service restart, job retry, database disconnect, timeout, simultaneous users, and lost worker heartbeat.
4. **Do not use FastAPI `BackgroundTasks` as a substitute for durable long-running job execution** if a restarted process would silently lose work.
5. **Do not assume Render's paid worker infrastructure is available** from the current free-tier `render.yaml`. Keep local jobs and manual release validation feasible until hosting costs are approved.

## 8.4 Budgets and performance targets

Use measurable **initial engineering targets**, then calibrate against a benchmark dataset and realistic hosting tier:

- Fixture imports are bounded by configured bytes, rows, nesting depth and execution time; oversize requests fail safely.
- A reference small run (e.g., 1,000 normalized events against one supported rule) should complete under an agreed benchmark budget **measured on a named environment**, not an invented SLA.
- Run output must be paginated, with bounded tracing and no unbounded queries on the interactive request path.
- Measure bytes processed, matching time, parsing time, result persistence time, errors and memory peak.
- Public demos have strict request, concurrency, storage and cost caps; no external paid LLM invocations by anonymous visitors.
- Record actual provider quotas/costs in a `costs-and-quotas.md` decision log before production rollout.

# 09 | Security, privacy and threat model

## 9.1 Trust boundaries

Trust boundaries include external files -> parser, Sigma content -> evaluator, browser -> API, replay request -> job worker, API -> PostgreSQL, demo user -> restricted datasets, and any future AI -> backend tools. Event logs and rule descriptions are untrusted data and may contain prompt injection, malicious text or sensitive fields.

## 9.2 Mandatory controls

- Preserve existing Argon2/JWT/HttpOnly/RBAC behavior and rerun regression tests after every auth-related change.
- Apply per-object and per-workspace authorization to datasets, runs, rule versions, comparisons, exports and cases; guessing an ID must never grant access.
- File ingestion: explicit accepted formats, content-size limits, streaming/bounded validation, safe YAML loader, nested-depth limit, no arbitrary object constructors, path traversal and zip-bomb defenses where archives are supported.
- Rule evaluation: no Python `eval`, no dynamic user code, no shell execution, no arbitrary SQL expressions or network access from rule text.
- Output encoding and report sanitization for attacker-controlled event content. Audit who downloaded evidence.
- Redact/hide tokens, secrets, passwords, session identifiers, PII and excessive command-line data as appropriate; provide clear retention policies.
- Rate-limit public/demo use; separate public demo scopes from privileged analyst operations.
- Define cancellation and resource limits so one run cannot exhaust application capacity.
- Maintain minimal actionable audit events for rule edits, replays, exports, access failures and privileged operations.
- Prefer synthetic and authorized test telemetry. Never import private employer/customer logs without permission and de-identification.
- Protect the production database and secrets during migrations and ZIP-based patch application.

## 9.3 AI-specific boundary (deferred)

An optional investigator may use **read-only, predefined backend tools** to retrieve rule metadata, event details, run traces and expected outcomes. It must cite verified record identifiers and be evaluated against known-ground-truth scenarios. The LLM may summarize uncertainty and suggest manual investigative steps; it may not grade tests, modify rules, approve deployments, run arbitrary commands or perform containment. Server-side authorization must remain independent of model output.

## 9.4 Threat-model deliverables

Create `docs/security/threat-model-v3.md` with asset inventory, trust boundaries, attacker capabilities, abuse cases, mitigations, test references and residual risks. Prioritize IDOR across run IDs, hostile file inputs, denial of service, data leakage in reports, replay contamination, prompt injection in event text and untrusted rule execution.

# 10 | User interface and product storytelling

## 10.1 Core views

| View | Must answer | Core controls |
|---|---|---|
| Detection Lab home | What can I test now? | Select example/import/continue run |
| Scenario details | What data, expectations and limitations are involved? | Review provenance, event count, license and schema |
| Rule details | What logic is being tested, and is it supported? | Version, validation errors, operator support, history |
| Replay execution | What is happening and is it complete? | Start, progress, cancel, retry where safe |
| Results | What passed, missed, overmatched, errored? | Diagnostic filters, event pivots, confidence disclaimers |
| Rule diff | Did the change improve behavior or regress? | Before/after test comparison |
| Evidence detail | What exact event and condition support this result? | Raw/sanitized data toggle by authorization, trace |
| Report | Can I reproduce or discuss this result? | Export manifest, coverage definitions, links |

## 10.2 UX principles

First-time visitors get one primary action and a limited sample scenario. Analysts can expand advanced settings. Never mistake chart density for value. Use understandable language: **Expected / Detected / Missed / Unexpected / Error / Unsupported**. A count displayed without its denominator or data origin is incomplete.

Retain the existing CASE//ZERO visual identity unless it harms clarity. Prioritize keyboard navigation, accessible contrast, readable error states, loading/empty states, table pagination, and browser back/forward behavior. Do not turn v3 into another aesthetic rewrite.

## 10.3 Demonstration modes

- **Guest demonstration:** seeded, synthetic, read-only or expiring isolated runs. No shared analyst credentials and no path to live operational records.
- **Authenticated analyst mode:** saved datasets, rule versions, private runs, reports and case pivots.
- **Local developer mode:** same test fixtures and evaluator semantics, controllable through documented commands and CI.

The public demo must give a useful result on a reasonable shared hosting budget. If real-time anonymous execution is unsafe or costly, use fixed reproducible demonstrations with clear labeling, plus authenticated/local live execution.

# 11 | Detailed milestone roadmap: v2.1 to v3.0

Milestone numbers describe **logical release gates** rather than promises about elapsed time. I will finish, test, document, commit, review, and merge each bounded slice before starting the next major slice.

## v2.1 | Recovery, repository audit and architecture lock

**Objective:** Re-establish a verified local and production baseline after the development pause and identify where the new engine will safely attach.

**Implementation slices:**

1. `2.1-A Baseline snapshot`: inspect Git, tags, changes, environment, dependencies, CI and deployments; capture a sanitized inventory.
2. `2.1-B Test truth`: run backend suite and frontend production build; classify failures without weakening tests; preserve output logs and exact commands.
3. `2.1-C Schema + API audit`: inspect SQLAlchemy models, Alembic history, routes, auth/RBAC, current evaluation and alert side effects; produce a dependency map.
4. `2.1-D Safety checkpoint`: verify backup strategy, feature flags, stable tag and production rollback; draft replay isolation and rule-representation ADRs.
5. `2.1-E Portfolio baseline`: screenshot existing key workflows and record honest v2 capabilities before changing the story.

**Exit gate:** clean baseline tests or documented known blockers; no undocumented production credentials; architecture sketch approved; additive migration plan understood; clear checkpoint tag and baseline report.

**Do not proceed if:** production data safety or existing migrations are unknown.

## v2.2 | Replay domain and first deterministic vertical slice

**Objective:** Run the same bounded scenario twice and obtain identical evaluation results, without changing operational alerts.

**Implementation slices:**

1. Define scenario/dataset manifest schema, hashes, expected results and bounded fixture loader.
2. Add additive DB structures and migration tests for replay runs and isolated outputs.
3. Introduce version-bound evaluator adapter around the existing detection path without changing live behavior.
4. Implement stable event ordering, run-scoped state, deterministic run IDs or manifest hashes, and exact terminal statuses.
5. Add a small local CLI/test harness for one scenario and one built-in rule.
6. Expose a minimum authenticated API and plain results view; avoid polishing until correctness is demonstrated.

**Tests:** two identical runs match by normalized output; replay produces zero operational alerts; unauthorized run access denied; cancellation/failed state distinguishable; source evidence retained.

**Exit gate:** deterministic end-to-end replay with full provenance and zero live-data contamination.

## v2.3 | Rule versions, fixtures and regression grading

**Objective:** Turn replay into a detection testing system, not a one-off playback feature.

**Implementation slices:**

1. Create immutable rule-definition and rule-version entities with content hash and compatibility metadata.
2. Define supported predicate semantics and AST; remove duplicated evaluation behavior behind a common interface.
3. Introduce named positive/negative fixtures with stable expectation IDs and source annotations.
4. Implement grading per expectation and separate errors/unsupported statuses from misses.
5. Add deliberate regression fixtures: weakened rule fails, corrected rule passes, benign control remains clean.
6. Build unit-test CLI output suitable for GitHub Actions and readable human diagnostics.

**Tests:** Boolean operator truth tables; field type/null handling; invalid rule rejection; version immutability; scorer correctness; rule change regression gates; no invented coverage claims.

**Exit gate:** one security rule demonstrably improves under a reproducible CI-validated regression suite.

## v2.4 | External compatibility and multi-event correctness

**Objective:** Prove utility outside CASE//ZERO's original hard-coded rules and datasets.

**Implementation slices:**

1. Select and document one legally reusable external Windows/Sysmon or similarly relevant event dataset with known or appropriately limited ground truth.
2. Build/import a versioned mapping for its actual source fields; preserve raw sanitized context and conversion errors.
3. Validate a narrow Sigma subset with pySigma or another documented parser; compile to tested internal evaluation semantics.
4. Reject unsupported Sigma conditions and modifiers with precise diagnostics; no best-effort silent behavior.
5. Extend replay for documented multi-event correlation semantics and test out-of-order input, window bounds, duplicate events and grouping.
6. Add import size limits, parser fuzz tests, transaction safety and import result reporting.

**Tests:** independent external fixture produces expected rule outcomes; unsupported rule visibly fails validation; correlation boundaries deterministic; malformed inputs fail safely; source/license metadata preserved.

**Exit gate:** external rule and event compatibility demonstration, documented gaps and accurate correlation tests.

## v2.5 | Explanation, comparison and investigation integration

**Objective:** Make the test outcome inspectable by a person rather than hidden in test logs.

**Implementation slices:**

1. Implement condition-level evaluation traces with safe bounds and redaction.
2. Create result classifications and per-run dashboards with correct denominators.
3. Add side-by-side rule-version comparisons using stable expectation identities.
4. Build event -> rule -> result -> case pivots using current case workflows without automatic operational alert creation.
5. Add paginated searches for datasets, runs, results, and evidence; test authorization at every object endpoint.
6. Add accessible UI states for importing, running, failed/unsupported, completed, comparing and exporting.

**Tests:** trace matches evaluator output; comparison respects incompatible datasets/versions; viewer permissions read-only; no IDOR; raw evidence escaped safely; browser workflow completes.

**Exit gate:** a novice technical user can identify an expected miss, inspect evidence, and compare a corrected rule in a short guided flow.

## v2.6 | Operationalization, CI/CD and proof exports

**Objective:** Make the system reproducible and reliable enough to use as a professional tool.

**Implementation slices:**

1. Implement bounded run scheduling/persistence strategy selected by ADR 006 and the verified hosting budget.
2. Add idempotency, cancellation, failure codes, retries and restart/recovery tests.
3. Export structured JSON manifest plus readable report with hashes, assumptions, rule/dataset/evaluator versions and measured results.
4. Integrate detection-suite checks into GitHub Actions with clear pass/fail output and stored sanitized artifacts.
5. Add operational metrics: job count/state, process duration, row count, parse failure, invalid rule, storage usage and demo abuse.
6. Run load/resilience tests and migration rehearsal; capture meaningful performance evidence.

**Tests:** service interruption, DB disconnect, duplicate submission, unauthorized export, large payload rejection, repeatability and manual recovery drill.

**Exit gate:** a second developer can clone, run the same suite, reproduce the results and interpret failures without private knowledge.

## v2.7 | Optional investigation intelligence (gated)

**Objective:** Explore whether a constrained AI investigator improves analyst interpretation without weakening correctness or economics.

**Required prerequisite:** all v2.2-v2.6 correctness gates pass. If they do not, this milestone is deferred without blocking v3.

**Implementation slices if approved:**

1. Implement read-only tools for run summary, event retrieval, rule metadata, evaluation trace and expected outcomes.
2. Add verified structured citations to backend record IDs; treat retrieved event text as untrusted data.
3. Build evaluation cases with known answers, planted prompt injection and missing-evidence cases.
4. Add model timeout, cost cap, tool-call cap, redaction, logging and opt-in behavior.
5. Expose uncertainty and allow analysts to view evidence rather than trust the prose alone.

**Pass gate:** the assistant never changes tests/rules, cites only valid accessible evidence and passes an agreed evaluation set. If not, ship v3 without AI; an accurate deterministic product is stronger than unreliable agentic claims.

## v3.0 | Public flagship release and career proof

**Objective:** Ship a stable, understandable security engineering tool—not simply announce a version number.

**Release tasks:**

1. Finish automated tests, accessibility review, security review, documented limits and clean CI.
2. Run safe production migration/deployment rehearsal with verified backup and rollback path.
3. Add an isolated public scenario/demo, bounded anonymous usage and audited deployment settings.
4. Produce product screenshots, a 30-second pitch, a 5-minute technical walkthrough, and an architecture overview.
5. Publish structured rule-support matrix, data-source licenses, known limitations, API/CLI setup and security disclosure policy.
6. Run at least one external review where practical; document observed friction and corrections.
7. Create a Git tag/release with changelog and check deployed features against the acceptance gates.
8. Update resume bullets using only features actually validated by release evidence.

**v3 complete only when:** every P0 requirement passes, the deployment is verified, the public demonstration is safe, and repository documentation matches implementation truth.

# 12 | Milestone dependency map and stop/continue rules

```text
Baseline and backups (v2.1)
       |
       v
Isolated replay + immutable inputs (v2.2)
       |
       v
Rule versions + fixture grading (v2.3)
       |
       v
External dataset/rule support + correlation (v2.4)
       |
       v
Explainability, compare, case pivots (v2.5)
       |
       v
CI, jobs, reports, operational proof (v2.6)
       |
       +------ optional read-only AI investigator (v2.7)
       |
       v
Public production flagship (v3.0)
```

**Hard stop conditions:** unknown database safety; failing or silently altered tests; inability to reproduce results; unsupported Sigma behavior reported as pass; a security issue allowing cross-run or cross-user leakage; demo environment with unrestricted writes; production cost/worker assumptions that were never validated.

**Scope cut hierarchy:** cut AI first; cut optional sources second; reduce visual polish third; never cut core correctness, provenance, security, repeatability or deployment verification.

**Pivot trigger:** if v2.4 cannot reliably process an external supported rule and independently sourced data after a bounded technical spike, pause to reassess rule compatibility or the product's external-use claim. Do not bury the result under more features.

# 13 | Engineering workflow: ZIP patches, PowerShell 5.1, PRs

## 13.1 The working method

I will use the same disciplined slice workflow that proved useful in Bomb Squad, Firedoor and The Continental: a scoped change package containing complete source files, manifest and tests; guarded Windows PowerShell 5.1 application steps; local verification; review of the exact diff; commit; pull request; CI; merge; and a documented clean stopping point.

Each slice must state: purpose, source baseline/commit, allowed changed paths, exact files added/replaced, whether it changes database schema, test commands, expected output, rollback approach and follow-up. **No replacement ZIP may assume my local repo matches an unverified snapshot.**

## 13.2 Read-only session-start commands (illustrative)

```powershell
# Windows PowerShell 5.1 - inspection only
Set-Location "$HOME\Projects\case-zero"
$ErrorActionPreference = 'Stop'
if (-not (Test-Path .git)) { throw 'Not a Git working tree.' }
git status --short --branch
git branch --show-current
git log -1 --oneline
git remote -v
git tag --list
```

Do not automatically discard a dirty working tree. If the repository contains uncommitted edits, stop and decide whether they should be committed, stashed deliberately or preserved elsewhere.

## 13.3 Safe source-package application procedure

1. Verify branch, commit and working-tree cleanliness against the package manifest.
2. Confirm ZIP exists; compute SHA256; compare with supplied manifest if available.
3. Extract to a temporary **staging directory outside the repository**, not directly into live source.
4. Inspect `manifest.json` or the package's file list; reject absolute paths, `..`, hidden unexpected files, secrets, generated credentials, and changes outside allowlisted project paths.
5. Review file diffs and migration notes before copying any source into the repository.
6. Apply only the approved files, preserving other files and database contents.
7. Run exact backend tests, frontend tests/build and any relevant migration dry run.
8. Inspect `git diff --check`, `git status`, `git diff --stat`, and the full diff; confirm unrelated changes are absent.
9. Commit only intentional paths with a descriptive message, push the feature branch, create PR, inspect CI and merge after all required checks pass.
10. Validate main after merge and record a clean-stop checkpoint with tag/commit, passed commands and any remaining known risks.

Never use a blind recursive overwrite from an uninspected archive as the default development process.

## 13.4 Standard slice handoff record

```text
CASE//ZERO slice: v2.x / Slice N / descriptive name
Baseline branch and commit: __________
Files allowed to change: __________
Files added/removed: __________
Schema migration: yes / no (Alembic ID if yes)
Security boundary changed: yes / no
How to apply: guarded PowerShell 5.1 commands
How to test: exact commands + expected pass/fail results
Expected user-visible behavior: __________
Known limitations: __________
Rollback procedure: __________
Evidence: test log, screenshots, CI run, commit, PR link
Decision: accept / reject / defer
```

## 13.5 Branching, merges and release gates

Use one milestone branch or narrow feature branches according to repository condition; favor small independently reviewable PRs. Do not merge a failing security or database migration check merely because unrelated tests passed. After each stable milestone, update the roadmap status and optionally create a version tag. Protect `main` from manual experiments and prevent ZIP packages from overwriting existing production configurations.

# 14 | CI/CD, test matrix and proof of correctness

## 14.1 Test pyramid

| Layer | Required evidence |
|---|---|
| Pure unit | Operators, null handling, Boolean logic, time windows, grade calculations, hash/version behavior |
| Property/metamorphic | Reordered input with equivalent timestamps; duplicate behavior; repeated run determinism |
| Parser/adapter | Valid and invalid JSON/YAML, field mapping, unsupported Sigma operators, source metadata |
| Database integration | Alembic upgrade, constraints, immutable versions, transaction rollback, authorization |
| API integration | Complete run lifecycle, response schemas, pagination, idempotency, role restrictions |
| Security tests | IDOR, upload abuse, escaping, secret redaction, quota and cross-scope isolation |
| End-to-end browser | Import/select -> run -> diagnose -> compare -> export demo |
| Reliability | Crash/retry, restart, DB disconnect, concurrent run controls, cancellation |
| Performance | Named reference dataset, recorded duration/memory and query bounds |
| Production smoke | Auth, public demo, run result, status health, harmless reporting and rollback proof |

## 14.2 Required regression scenarios

- A known malicious PowerShell event is detected; nearby benign administrative process is not.
- An event with missing required fields does not create a fabricated match.
- A time-window boundary event is handled exactly as documented.
- A delayed or duplicate event is processed according to the declared dedup and ordering contract.
- A deliberately weakened rule causes the expected suite to fail; a corrected version restores the pass.
- A syntactically valid but unsupported rule is not executed as a partial rule.
- A failed run is not counted as a successful test run.
- A replay cannot write to the operational alert table or alter existing investigations.
- A viewer cannot create or mutate privileged rules or inspect another user's private run.
- An attacker-controlled event string is escaped in the UI and reports.

## 14.3 Evidence required for a completed milestone

Each merged milestone receives a short `docs/releases/v2.x.md` with: objective, changes, exact commands executed, test counts, environment, known limitations, screenshots or API output, migration/rollback note, PR/commit references and what remains undone. Test counts are factual and dated, never copied unchanged from an older release.

# 15 | Production release, operations and budget safeguards

## 15.1 Deployment strategy

Keep the documented Vercel frontend, Render Python API and Neon PostgreSQL unless actual measured requirements justify a change. Maintain separate development/test and production data. Prefer manual approval for migration-bearing releases. Validate cookie/security settings, host validation, service environment variables, backups and least-privilege database access.

Deploy new replay functionality behind feature flags or clearly restricted routes until isolation and quota tests pass. The production API must remain available for existing SOC workflows even if replay job processing is temporarily disabled.

## 15.2 Reliability checklist

- Repeated migrations against clean and upgrade-path databases.
- Backup exists and recovery steps are tested in a safe environment.
- Existing v2 alert/case/auth workflows smoke-tested before and after release.
- Replay job states remain accurate across restarts and failures.
- Demo cannot delete, edit or ingest into private operational records.
- Report export is authorized, bounded and sanitized.
- Unexpected worker/job cost is capped or disabled by policy.
- Health endpoints do not expose secrets or sensitive internal status publicly.
- Observability identifies parse failures, runaway inputs and replay execution errors.

## 15.3 Costs

I will maintain a simple operating budget for Render, Vercel, Neon, object/file storage if introduced, any queue/worker, and optional AI usage. I will write down free/paid plan assumptions, current quotas, estimated normal test load and hard abuse controls before enabling a new paid dependency. Cost limits are requirements, not a post-launch concern.

# 16 | Risk register and mitigation ownership

| Risk | Severity | Warning sign | Planned response |
|---|---|---|---|
| Existing production data damaged | Critical | Destructive migrations, unexplained row changes | Backup/restore drill; additive migrations; production hold |
| Replay pollutes operational alerts | Critical | Demo events appear in live alert queue | Separate schema/side effects; isolation integration tests |
| Unsupported Sigma semantics silently pass | Critical | Complex rules produce plausible but wrong results | Support matrix; explicit reject; compliance fixtures |
| Fake ground truth overstates detection quality | High | High coverage without independent labels | Publish provenance, label scope, limitations |
| Rule input executes arbitrary code | Critical | Evaluator accepts dynamic expressions | Safe AST, no eval/shell; parser abuse tests |
| Run leakage between users | Critical | Run ID guessing exposes private evidence | Scope authorization, IDOR tests, data partitioning |
| Data/PII leak through uploads or AI | High | Tokens appear in logs/reports/prompts | Redaction, minimized fixtures, no anonymous AI |
| Replay jobs lost on service restart | High | RUNNING forever; duplicate processing | Persistent state/leases, recovery design, terminal statuses |
| Hosting bill or free-tier limits | High | Worker unavailable, quota exhaustion | Hosting ADR, concurrency/size limits, local execution |
| Performance collapses on large datasets | High | Requests time out, memory spikes | Bounded inputs, async jobs, pagination, benchmarks |
| v2 workflow regressions | High | Existing alerts/cases stop working | CI + end-to-end smoke before every merge |
| Dependency/version churn | Medium | Upgrades break parsing/CI | Lockfiles, scheduled controlled upgrades |
| UI project overwhelms engine work | Medium | Months of visual polishing without rule tests | Release gate tied to engine proof |
| Agent hallucinates or follows injected logs | High | Fabricated IDs or tool misuse | Read-only tool design, prompt-injection eval, optional milestone |
| Project lacks external utility | High | Works only with three built-in rules | External compatibility gate at v2.4 |
| Resume claims exceed implementation | High | GitHub cannot reproduce bullets | Each claim linked to tested release evidence |

**Ownership:** I remain responsible for approving code changes, secrets handling, migration execution, and publishing claims. AI assistance may generate proposed source changes and test artifacts, but the actual running software and verification evidence determine what is accepted.

# 17 | Career positioning, GitHub and demo deliverables

## 17.1 The desired portfolio narrative

CASE//ZERO should become my flagship **full-stack detection-engineering platform**, complementing Firedoor's Go/Terraform/Kubernetes cloud-security story and Bomb Squad's Windows/.NET security-analysis story. The case should be demonstrable to SOC, Security Engineering, Detection Engineering, Backend, DevSecOps and cloud-oriented interviewers without claiming the project reproduces enterprise-scale vendor capabilities.

## 17.2 README structure for v3

1. A one-sentence problem and solution, with a screenshot/GIF of detection regression.
2. A short "Try a detection" walkthrough with a bounded public demo.
3. What actually happens: dataset -> normalization -> rule version -> replay -> grade -> investigation.
4. Capabilities with explicit supported/unsupported distinction and release status.
5. Architecture and trust boundaries with deployment diagram.
6. Reproducible local quickstart, tests and external format compatibility.
7. Evidence: CI, examples, screenshots, reports, accuracy limitations and release history.
8. Security disclosures, data privacy, known limitations and contribution guidance.

## 17.3 Demo scripts

**30 seconds:** "This is CASE//ZERO, a detection validation platform. I replay a known incident, show a missed event, and verify that changing the rule fixes it without triggering on known benign activity."

**5 minutes:** choose a scenario, show input contract, run the existing version, inspect a miss, select corrected rule, rerun, compare, open the evidence and show CI gate. Explain that results are limited to labeled test cases and supported semantics.

**15 minutes:** walk through architecture, event-time ordering, rule compilation, provenance, job isolation, security controls, failure tests, migration strategy and measured benchmarks.

## 17.4 Resume-bullet policy

Current v2 bullets must describe what is actually implemented. Proposed v3 bullets remain drafts until the relevant test and production gates pass.

**Target future bullet - not yet earned:** "Engineered a Python/FastAPI detection-validation engine for reproducible security-event replay, immutable rule versions, positive/negative regression fixtures, and evidence-linked investigation results."

**Target future bullet - not yet earned:** "Built CI-gated detection tests and import adapters for documented external telemetry and supported Sigma semantics, with explicit error reporting, replay isolation, and PostgreSQL-backed execution history."

When ready, quantify only measured facts: scenario count, rule format coverage, test count, benchmark throughput, or external adoption. Do not invent performance improvements or detection coverage.

# 18 | Decision log, change control and recurring pulse checks

## 18.1 Decision record template

| Field | Entry |
|---|---|
| Decision ID | ADR / ROADMAP-YYYY-NNN |
| Date and affected milestone | ... |
| Question being decided | ... |
| Options considered | ... |
| Evidence / benchmarks | ... |
| Chosen design and rationale | ... |
| Tradeoffs and risks | ... |
| Reversal trigger | ... |
| Status | Proposed / Accepted / Superseded |

## 18.2 Scope-change rule

A new feature enters the roadmap only if it: (a) improves the central user job, (b) can be objectively tested, (c) has a demonstrable employment/engineering benefit, (d) fits the current milestone without undermining P0 work, and (e) has a clear operating/security cost. Otherwise it goes to a separate `future-ideas.md` backlog.

## 18.3 Pulse-check questions after every milestone

- What is the current branch, latest merged commit, tag and CI state?
- Which acceptance criteria are now proven by tests and screenshots?
- Did any production behavior or database schema change?
- What did I learn technically, and can I explain the decision in an interview?
- What remains risky or unverified?
- Is the current repo at a safe stopping point?
- What is the next smallest bounded implementation slice?
- Are resume and README claims still truthful?

## 18.4 Simple status tracker

The tracker records development progress. The latest published release is
still v2.0.1. [GitHub Releases](https://github.com/danielguillaumont/case-zero/releases)

| Milestone | Verified development status | Remaining gate or evidence |
|---|---|---|
| v2.1 Baseline and recovery | Baseline audit and local recovery work merged | Production recovery confirmation remains open. [Audit](v3-baseline-audit.md) · [Production readiness](v21d4-production-readiness.md) |
| v2.2 Replay domain | Bounded offline replay, v1 evidence verification, and feature-gated authenticated preview merged | Persistent replay runs and outputs, cancellation, and hosted availability remain unverified or unimplemented. [Replay and preview merges](https://github.com/danielguillaumont/case-zero/pull/16) |
| v2.3 Versioned tests | Synthetic Encoded PowerShell regression proof merged and verified in PR CI | General rule AST and Boolean operator coverage, persisted version-aware evidence, and broader scenarios remain open. [Milestone closeout](v23-milestone-closeout.md) |
| v2.4 External compatibility | Planned | Select legally reusable data and a narrow rule subset, then demonstrate mapping, explicit rejection of unsupported syntax, and deterministic correlation. |
| v2.5 Explainability | Planned | UI walkthrough and evidence links |
| v2.6 Operational hardening | Planned | Resilience/performance/report proofs |
| v2.7 Optional AI | Gated / optional | Eval results or explicit deferral |
| v3.0 Public release | Planned | Tag, deployment, external demo and README |

# 19 | First-session playbook: exactly where I resume

This is the **only** sequence I should begin with after the development pause. It is intentionally read-only until the baseline is understood.

1. Open PowerShell 5.1 and locate the exact repository directory; verify it is the correct public `case-zero` working tree.
2. Record `git status --short --branch`, current commit, remotes, tags, and pending work; do not reset or overwrite anything.
3. Inspect the current README, `.env.example`, Compose file, CI workflows, backend and frontend package manifests, `render.yaml`, and migration directory.
4. Establish whether local Docker/PostgreSQL can start and whether documented backend/frontend tests pass without altering production data.
5. Inventory relevant detection source files, event models, API routes, auth dependencies and existing tests; map the exact points where replay execution could reuse semantics.
6. Verify the production frontend/API/database configuration from available dashboards, redact credentials, and confirm a backup/recovery plan before migration work.
7. Produce `docs/roadmap/v3-baseline-audit.md` and ADR candidates 003-006. Record unresolved questions and current CI evidence.
8. Propose **v2.1-A** as the first narrow PR: documentation/audit/test-hardening only unless the baseline reveals a specific safe repair.
9. Only after that PR passes should I request a scoped source ZIP for the first replay domain slice.

**Initial PowerShell inspection command:**

```powershell
Set-Location "$HOME\Projects\case-zero"
$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath '.git')) { throw 'Wrong directory.' }
Write-Host '--- Repository state ---'
git status --short --branch
git log -1 --format='%h %cs %s'
git remote -v
Write-Host '--- Existing checkpoints ---'
git tag --list
Write-Host '--- Tracked root files ---'
git ls-files | Select-Object -First 60
```

I must report the output before any patch or migration is prepared. Never paste real `.env` secrets, tokens or private production database data into project notes or a chat.

# 20 | Research references and boundaries

The external references below inform architecture and compatibility decisions. They are not evidence that CASE//ZERO already implements the documented capabilities. Versions, terms, pricing and hosted-service quotas should be rechecked when implementation begins.

1. **CASE//ZERO repository and v2.0.1 README** — https://github.com/danielguillaumont/case-zero
2. **CASE//ZERO Render blueprint** — https://github.com/danielguillaumont/case-zero/blob/main/render.yaml
3. **Sigma specification** — https://github.com/SigmaHQ/sigma-specification
4. **Sigma rule semantics** — https://github.com/SigmaHQ/sigma-specification/blob/main/specification/sigma-rules-specification.md
5. **Sigma correlation semantics** — https://github.com/SigmaHQ/sigma-specification/blob/main/specification/sigma-correlation-rules-specification.md
6. **pySigma processing pipelines** — https://sigmahq-pysigma.readthedocs.io/en/latest/guides/processing_pipelines.html
7. **OWASP Logging Cheat Sheet** — https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
8. **Render worker model** — https://render.com/docs/background-workers
9. **MITRE ATT&CK** — https://attack.mitre.org/

**Research caution:** MITRE ATT&CK deprecated the older "Data Sources" catalog in its v18 release in October 2025. I should use current ATT&CK detection strategy/mapping conventions where relevant rather than blindly building around an outdated data-source list.

# 21 | Final project contract

I will judge CASE//ZERO v3 by **working, reproducible engineering evidence**. The central value is not the size of the SOC dashboard, the number of artificial-intelligence agents, or the number of buzzwords in the tech stack. It is whether the system can take a supported rule and well-described telemetry, evaluate them consistently, show where the rule did and did not work, and make the result explainable to another engineer.

My release order is fixed unless a documented decision changes it: **recover baseline -> build isolated replay -> version rules -> validate detection outcomes -> support external content -> explain results -> harden operations -> optionally add AI -> release and demonstrate**.

The end state should let me say, with code and tests to prove it:

> *I built a cloud-deployed security detection-validation platform. It takes real structured telemetry and versioned detection rules, replays documented attack scenarios, identifies missed and unintended detections, and uses automated regression testing to prove whether a rule change improved the result.*

**CASE//ZERO — Replay the attack. Find the gaps. Prove the fix.**
