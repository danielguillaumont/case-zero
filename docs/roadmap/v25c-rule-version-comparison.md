# v2.5-C deterministic rule-version comparison

`compare_replay_summaries(baseline, candidate)` compares previously
validated offline `ReplaySummary` objects. It performs no evaluation
or grading and preserves the source pass flags and classifications.
[Implementation](../../backend/app/services/replay_comparison.py)

## Compatibility and reconciliation

Comparison v1 accepts replay summary v1 for the built-in
`encoded-powershell` logical rule. Both inputs must share the fixture ID
and digest, authored expectation digest and authoring rule version.
Requested version IDs must differ. Each executed version must equal
its request when present. An unsupported run retains the request and
has a null execution identity.

Expectation IDs, event IDs and expected outcomes must agree in stable
expectation-ID order. Each expectation and event ID must be unique
within its summary. Missing, reordered and inconsistent rows fail
validation. The comparison also reconciles counts, classifications,
decisive labels, satisfaction and the original pass flag. The total
fixture size and the complete labeled and unlabeled denominators are
preserved.

## Comparison schema v1

The envelope contains `schema_version`, common fixture and expectation
identities, the authoring version, event counts, `baseline`, `candidate`,
`candidate_minus_baseline`, `change_totals`, `expectations`, and
`comparison_sha256`. Each run retains its source grade digest,
requested and executed versions, all six grade totals, labeled
satisfaction and pass flag. Deltas are signed integers for each grade
class and always subtract the baseline count from the candidate count.

Each expectation row preserves the expectation and event IDs,
authored outcome, both classifications, and its fixed change code.

| Change code | Meaning |
|---|---|
| `improved` | Decisive failed expectation became decisive satisfied |
| `regressed` | Decisive satisfied expectation became decisive failed |
| `unchanged` | Both sides were decisive and had the same satisfaction state |
| `inconclusive` | Either side lacked decisive evidence due to an evaluation error or unsupported execution |

Inconclusive rows remain in the denominator. The four change totals
sum to all authored labels. A missing row is a malformed input, while
unsupported execution is an explicit row with no observed outcome.

The frozen model serializes as compact sorted-key JSON with ASCII
escapes and UTF-8 encoding. Its SHA-256 covers the payload before
`comparison_sha256` is inserted. Output contains no input diagnostic
text, raw events, or command lines. IDs must be non-sensitive.

## Reproduce offline

From `backend` in the documented Python 3.12 virtual environment:

```powershell
.\.venv\Scripts\python.exe -m pytest -q --noconftest tests/test_replay_comparison.py
@'
from pathlib import Path
from app.services.replay_comparison import compare_replay_summaries
from app.services.replay_expectations import load_replay_expectations
from app.services.replay_fixtures import load_replay_fixture
from app.services.replay_grading import grade_replay
from app.services.replay_regression_proof import CORRECTED, WEAKENED
from app.services.replay_summary import summarize_replay_grade

path = Path("app/replay_assets/encoded_powershell.json")
labels = path.with_suffix(".expectations.json")
fixture = load_replay_fixture(path)
expectations = load_replay_expectations(labels, fixture, CORRECTED)
summaries = [
    summarize_replay_grade(grade_replay(path, labels, CORRECTED, version), fixture, expectations, version)
    for version in (WEAKENED, CORRECTED)
]
print(compare_replay_summaries(*summaries).canonical_json().decode())
'@ | .\.venv\Scripts\python.exe -B -
```

The weakened baseline satisfied 2/3 labels and failed. The corrected
candidate satisfied 3/3 and passed. `encoded-switch` improved from
false negative to true positive. The two benign controls were
unchanged. The TP delta was +1 and the FN delta was −1. The observed
comparison SHA-256 was
`537a653234548dca4490997a4c344c4cbaa1673c1314b95357eefda55e7136a2`.
[Focused tests](../../backend/tests/test_replay_comparison.py)

The focused suite passed 29 tests in 0.92 seconds. The database-free
replay and compatibility suite passed 516 tests in 62.28 seconds,
with one Starlette test-client deprecation warning. Black, targeted
Flake8, and `git diff --check` passed.

## Limits and handoff

The comparison checks that inputs agree and are internally consistent.
It relies on the summary builder for validation against the original
fixture, rule and labels. The digest identifies the output content
without authenticating the source reports or establishing execution
provenance independently. A later UI needs authorized evidence
lookup and must keep inconclusive results visible. Ungraded Sigma
traces and unlabeled external telemetry are outside this contract.
[Summary contract](v25b-result-summaries.md)
