# v2.5-A explainable Sigma evaluation

The offline Sigma evaluator can emit a versioned, redacted condition trace.
The decision and trace use the same comparison results from one condition
walk. Existing Sigma decisions, grading, and replay v1 manifests retain
their contracts. [Evaluator and trace](../../backend/app/services/sigma_replay.py)

## Trace schema v1

The envelope contains `schema_version`, `version_id` (compiled rule UUID
and content SHA-256), `compiler_contract`, `evaluator_contract`,
`fixture_sha256`, `events`, and `trace_sha256`. Each event contains
`event_id`, `ordinal`, `outcome`, `fields`, and `condition`.
Field entries contain a normalized `field` and a `status` of `present`,
`missing`, `null` or `invalid`.

Condition nodes contain `operator`, `result`, `field`, and `children`.
Groups have a null field and ordered AND/OR children. Leaves have a
field and an empty children array. A result is `true`, `false` or
`null` for unknown. The leaf operators are `exact`, `contains`,
`startswith`, and `endswith`.

| Sigma field | Trace field |
|---|---|
| `Image` | `process_name` |
| `CommandLine` | `command_line` |
| `Computer` | `hostname` |

## Decision semantics

The evaluator preserves casefolded literal comparisons. Empty strings
are present evidence. Missing and null values yield unknown comparisons.
A false child decides AND and a true child decides OR, even with another
unknown child. If neither rule decides the group, an unknown child
keeps the result unknown. The trace retains every child the evaluator
visited, including children whose result did not determine the group.

| Example | Condition summary | Outcome |
|---|---|---|
| Synthetic `encoded` | Image OR group true, command-line contains true, AND true | `match` |
| Synthetic `benign-tie` | Image OR group true, command-line contains false, AND false | `no_match` |
| External Sysmon `362120` | Image OR group true, command-line status null, contains unknown, AND unknown | `indeterminate` |

A referenced invalid field produces `error` with field statuses and a
null condition. An unsupported event type or source produces
`unsupported_event` with no fields or condition nodes. The evaluator
skips condition evaluation in both cases. External indeterminate
results carry no confirmed miss or benign classification.

## Identity and safety

The trace verifies the compiled identity and recomputes the normalized
fixture digest using the existing v1 hash implementation. Events follow
fixture order, children follow compiled condition order, and field
statuses are ordered by field name. The trace digest covers all envelope
fields except `trace_sha256`. Serialization uses sorted-key compact ASCII-
escaped JSON encoded as UTF-8 with no trailing newline.

No observed values, rule literals, raw commands, raw rule metadata, or
fixture provenance strings are serialized. Event IDs are copied exactly
and must be non-sensitive identifiers chosen by the data author. Tracing
accepts only IDs of 1–128 ASCII letters, digits, dots, underscores,
colons, or hyphens, starting with a letter or digit. A token-like ID
could still carry sensitive information, so the ID grammar is a format
bound. It does not detect secrets in identifiers.

Tracing inherits the evaluator's maximum of 1,000 fixture events and
the compiled tree limits of 64 nodes and depth 8. It enforces a 2 MiB
canonical output cap while collecting events and checks the full
serialized envelope before returning. A limit violation fails the
trace request without returning a truncated explanation. Standard
untraced evaluation keeps its existing input and output behavior.

## Reproduce offline

From `backend`, using the documented Python 3.12 virtual environment:

```powershell
.\.venv\Scripts\python.exe -m pytest -q --noconftest tests/test_sigma_trace.py
.\.venv\Scripts\python.exe -B -c "from pathlib import Path; from app.services.replay_fixtures import load_replay_fixture; from app.services.sigma_replay import load_sigma_rule, trace_sigma_fixture; r = load_sigma_rule(Path('tests/fixtures/sigma-encoded-powershell.yml')); f = load_replay_fixture(Path('app/replay_assets/encoded_powershell.json')); print(trace_sigma_fixture(f, r).canonical_json().decode())"
```

The synthetic trace SHA-256 was
`e27bd2e5dbb9f646ce9fb692154592f618c9960e2d8a62ea18585e027468391b`.
The verified external trace SHA-256 was
`c56d31475f4f7a1a8ecffd4703772fa8671ea093f75b4477138a203473125a8b`.
The two independent synthetic invocations produced identical output.
The focused suite passed **20 tests in 1.04 seconds**.
[Trace tests](../../backend/tests/test_sigma_trace.py)

The database-free replay and compatibility suite passed **460 tests
in 66.90 seconds** with one Starlette test-client deprecation warning.
An additional security, RBAC, detection-engine and admin-bootstrap
unit run passed **31 tests in 2.96 seconds**. Historical replay and
synthetic authentication digests matched their expected values. Black
passed for the Sigma service and trace tests. Targeted Flake8 and
`git diff --check` also passed.

## Remaining work

This is an offline trace contract. A future UI needs authorization,
bounded presentation and explicit indeterminate and unsupported states.
This slice adds no persistence, event-to-case pivot, UI, or API.

The outstanding v2.4 acceptance gap remains. Independently sourced
external rules and verified event-level labels are not yet demonstrated.
The pinned external Sysmon data has sanitized command lines and no
verified per-event attack labels. Its traces demonstrate field mapping
and evaluation behavior without establishing external detection accuracy.
[v2.4 closeout](v24e-import-hardening.md)
