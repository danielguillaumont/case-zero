# v2.5-B detection result summaries

The offline summary projects an existing `ReplayGrade` into a frozen
presentation contract. It uses the original grade classifications and
`passed` property. It checks consistency with the independently loaded
fixture, authored expectation set and requested version. No detections
are rerun during summarization.
[Implementation](../../backend/app/services/replay_summary.py)

## Summary schema v1

| Fields | Meaning |
|---|---|
| `schema_version` | Summary format version, currently 1 |
| `fixture_id`, `fixture_sha256`, `expectations_sha256`, `grade_sha256` | Fixture identity and digests of the normalized fixture, canonical authored expectations and original canonical grade |
| `authoring_version_id`, `requested_version_id`, `executed_version_id` | Rule ID and content digest pairs. Executed identity is null for unsupported execution. The authoring version can differ from the requested one. |
| `total_events`, `labeled_events`, `unlabeled_events` | Full fixture size and the split between authored and unscored events |
| `decisive_labeled_events` | Number of authored labels with a match or no-match decision |
| `totals` | Existing true-positive, true-negative, false-positive, false-negative, evaluation-error and unsupported counts |
| `passed`, `labeled_satisfaction` | Original all-label pass flag and a separate numerator/denominator, or null when unavailable |
| `diagnostics`, `expectations` | Stable codes and fixed messages, plus expectation and event IDs with their expected outcome, actual outcome and classification |
| `summary_sha256` | SHA-256 of the complete canonical summary before this field is added |

An expected match is TP when observed and FN when missed. An expected
non-match is TN when observed and FP when an unexpected detection
matches. Errors and unsupported execution are separate counts.
Classification counts sum to the number of labels. Unlabeled events
do not contribute to either satisfaction or decisive counts.

When at least one label has a decisive result, labeled-suite
satisfaction is `(TP + TN) / labeled_events`. The denominator includes
labels affected by errors and unsupported execution. An incomplete
run therefore cannot show a perfect satisfaction fraction by dropping
those labels. When there are zero decisive labels, the fraction is null
and the run retains its failure status. An empty authored label set
cannot form a v1 grading report.

Diagnostics distinguish all labels passing, missed expectations,
unexpected matches, evaluation errors, unsupported execution,
incomplete results, and unlabeled events. Expectation references are
sorted by authored expectation ID. An investigator can use the IDs to
locate the authorized source evidence. The summary carries no raw
event data, command lines, or caller-provided diagnostic text.
Fixture and event IDs are restricted to short ASCII identifiers and
must be non-sensitive by construction.

## Reconciliation and integrity

The summary recomputes the normalized fixture and requested rule
digests, checks the expectation and authoring identities, and verifies
that the executed version equals the request when present. Every
report row must correspond to the exact expected label, event and
authored decision in the grader's order. Duplicate, unknown, missing
and unordered references fail validation. The summary checks the
reported classification and diagnostic against grading v1 and tallies
rows to check the aggregate counts. It accepts the reconciled
`GradeTotals` and `passed` as the presentation source.

Serialization uses sorted keys, compact separators, ASCII escapes and
UTF-8 with no trailing newline. The separate grade digest binds even
report data that the summary does not expose. These checks establish
consistency with the supplied source artifacts. They do not
authenticate a report or prove that a coherently forged set of inputs
came from an actual execution.

## Reproduce offline

From `backend` in the documented Python 3.12 virtual environment:

```powershell
.\.venv\Scripts\python.exe -m pytest -q --noconftest tests/test_replay_summary.py
@'
from pathlib import Path
from app.services.replay_expectations import load_replay_expectations
from app.services.replay_fixtures import load_replay_fixture
from app.services.replay_grading import grade_replay
from app.services.replay_regression_proof import CORRECTED, WEAKENED
from app.services.replay_summary import summarize_replay_grade

path = Path("app/replay_assets/encoded_powershell.json")
labels = path.with_suffix(".expectations.json")
fixture = load_replay_fixture(path)
expectations = load_replay_expectations(labels, fixture, CORRECTED)
for version in (WEAKENED, CORRECTED):
    report = grade_replay(path, labels, CORRECTED, version)
    print(summarize_replay_grade(report, fixture, expectations, version).canonical_json().decode())
'@ | .\.venv\Scripts\python.exe -B -
```

| Actual grading run | TP | TN | FP | FN | Labeled satisfaction | Grade status |
|---|---:|---:|---:|---:|---:|---|
| Weakened | 0 | 2 | 0 | 1 | 2/3 | FAIL |
| Corrected | 1 | 2 | 0 | 0 | 3/3 | PASS |

Both runs used the same synthetic fixture and the same three authored
labels. Both reported zero errors, unsupported results and unlabeled
events. The weakened summary points to expectation `encoded-switch`.
[v2.3 proof](v23-milestone-closeout.md) · [Focused tests](../../backend/tests/test_replay_summary.py)

The focused suite passed **27 tests in 0.78 seconds**. The
database-free replay and compatibility suite passed **487 tests in
59.90 seconds**, with one Starlette test-client deprecation warning.
An additional security, RBAC, detection-engine and admin-bootstrap
unit run passed **31 tests in 2.34 seconds**. The historical replay,
external replay, and synthetic authentication identity checks passed.
Both Sigma trace digests matched the independent v2.5-A record.
Black, targeted Flake8, and `git diff --check` passed.

## UI handoff and limits

Present the authored denominator alongside pass/fail and keep
incomplete evidence visible. A later UI should authorize evidence
lookups before exposing referenced records. Sigma traces are outside
this graded contract. A future ungraded presentation can expose
match, no-match, indeterminate, error and unsupported outcomes
without assigning attack or benign labels. The external Sysmon
capture still has sanitized command lines and no verified event labels.
[Sigma trace contract](v25a-explainable-evaluation.md) · [External compatibility limits](v24e-import-hardening.md)
