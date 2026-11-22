# v2.3 detection regression milestone closeout

The offline detection-regression implementation is merged through
`7242b36434af8f7ae3ead30be94464c6c5a438e3`. It is a development milestone.
The latest published GitHub Release is **v2.0.1**.
[GitHub Releases](https://github.com/danielguillaumont/case-zero/releases)

## Implemented scope

| Slice | Merged change |
|---|---|
| v2.3-A | Immutable built-in rule definitions, canonical SHA-256 version identities, and evaluator compatibility metadata. [PR #17](https://github.com/danielguillaumont/case-zero/pull/17) |
| v2.3-B | Validated execution binding records the version actually run and rejects unsupported or inconsistent bindings. [PR #18](https://github.com/danielguillaumont/case-zero/pull/18) |
| v2.3-C | Independently authored versioned JSON expectations bind to a normalized fixture hash and logical rule. The authoring version is retained as provenance across comparisons. [PR #19](https://github.com/danielguillaumont/case-zero/pull/19) |
| v2.3-D | Deterministic per-expectation grading and totals. Evaluation errors and unsupported execution have their own classifications. Unlabeled events are unscored. [PR #20](https://github.com/danielguillaumont/case-zero/pull/20) |
| v2.3-E | A read-only CLI executes the weakened and corrected predicates against the same synthetic inputs and gates the expected result in CI. [PR #21](https://github.com/danielguillaumont/case-zero/pull/21) |

## Verification

The three-event fixture contains one `-enc` event and two benign PowerShell
controls. The offline-only long-switch predicate produced **0 TP, 2 TN,
1 FN**, the expected FAIL. The corrected predicate, which recognizes both
switches, produced **1 TP, 2 TN, 0 FN**, a PASS. Both runs reported zero false
positives and distinct executed version IDs against identical fixture and
expectation digests. [Synthetic fixture](../../backend/app/replay_assets/encoded_powershell.json) · [Authored expectations](../../backend/app/replay_assets/encoded_powershell.expectations.json)

The closeout reran the documented offline command and observed exit code
`0` with `"proof_passed":true`. The focused proof suite passed **12 tests**.
PR #21 reports **273 database-free backend tests passed**. Its GitHub Actions
run separately records successful backend tests, a successful **Prove
offline detection regression** step, and a successful frontend build.
[Local command](../../README.md#detection-validation--regression-testing) · [Focused tests](../../backend/tests/test_replay_regression_proof.py) · [CI workflow](../../.github/workflows/ci.yml) · [PR #21 CI run](https://github.com/danielguillaumont/case-zero/actions/runs/44976758308)

## Limits and v2.4 entry

- The proof covers two allowlisted versions of one built-in single-event rule on one bundled synthetic fixture. External telemetry import, Sigma compilation, and multi-event replay correlation remain open. The synthetic results provide evidence for the authored labels only.
- The general rule AST, Boolean operator truth-table coverage, and planned PowerShell download-activity replay scenario remain incomplete. The grading output is offline. Persisted rule versions, replay runs, and version-aware evidence remain open. The existing v1 replay evidence format is preserved.
- The existing authenticated Detection Lab preview is feature-gated. Public hosted availability is outside this closeout.
- Start v2.4 with a bounded compatibility spike. Select one legally reusable external event dataset and a narrowly scoped external rule. Record source, license, expected outcomes, and unsupported cases. Before claiming compatibility, show deterministic normalization and outcomes, explicit rejection of unsupported syntax, and correlation tests for event ordering, window boundaries, deduplication, and grouping. [Master build plan](CASE_ZERO_V3_MASTER_BUILD_PLAN.md#v24--external-compatibility-and-multi-event-correctness)
