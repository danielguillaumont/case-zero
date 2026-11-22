# v2.4-C constrained Sigma replay

CASE//ZERO compiles one local Sigma rule into a frozen definition with
tuple-based literal and Boolean nodes. Bounded YAML validation runs
first. pySigma parses the rule, exposes the selector condition for
allowlist checks, and resolves the condition into field comparisons.
CASE//ZERO translates that resolved tree and evaluates it against
normalized replay events. [Implementation](../../backend/app/services/sigma_replay.py)

The backend pins pySigma 2.1.0 and its condition parser dependency
pyparsing 3.3.3. pySigma supports Python 3.11 through 3.x. The resolver
retained the existing PyYAML 6.0.3 and Jinja2 3.1.6 pins on Python 3.12,
and `pip check` passed. This path uses pySigma rule and condition parsing.
It does not load backends, processing pipelines, or plugins.
[pySigma release](https://pypi.org/project/pySigma/2.1.0/) · [pySigma rule API](https://sigmahq-pysigma.readthedocs.io/en/stable/reference/rules.html)

## Supported subset

| Area | Accepted |
|---|---|
| YAML | One UTF-8 document, at most 16 KiB, 128 nodes and depth 6 |
| Metadata | Required `title` and canonical lowercase UUIDv4 `id`. Optional `description` and `author`. Text is printable and at most 256 characters. |
| Logsource | Exact `product: windows`, `service: sysmon`, `category: process_creation` |
| Selections | One to eight named mappings with one to three distinct fields each. Every selection must be referenced. A selection combines its field comparisons with AND. |
| Comparisons | Exact string equality or one modifier from `contains`, `startswith`, and `endswith`. All apply Unicode casefolding to the complete input and literal. Image paths are compared as supplied, with no basename or slash conversion. |
| Conditions | Named selections, lowercase `and` and `or`, and parentheses. pySigma determines precedence. At most 256 characters, 31 tokens and four levels of condition parentheses. Compiled trees are limited to 64 nodes and depth 8. |

Duplicate keys, multiple YAML documents, aliases, anchors, tags and
merge keys fail explicitly. Rule lists, unknown metadata, unreferenced
or undefined selectors, keyword or array selections, non-string values,
wildcards, placeholders, chained modifiers, regex, negation, selector
quantifiers such as `1 of`, aggregations and correlation are rejected.

| Observed Sysmon field | Rule field | Normalized replay field |
|---|---|---|
| `EventData/Image` | `Image` | `process_name` |
| `EventData/CommandLine` | `CommandLine` | `command_line` |
| `System/Computer` | `Computer` | `hostname` |

Evaluation accepts normalized `process_creation` events with the Sysmon
Operational source or the synthetic replay source. Other source and event
type combinations return `unsupported_event`. Missing and null values
are separately diagnosed and are unknown for their comparison. For AND,
a known false operand decides the result. For OR, a known true operand
decides it. Otherwise an unresolved comparison yields `indeterminate`.
An empty string is present and cannot match a nonempty literal. A
referenced field with an invalid value produces an error even if another
operand could decide the expression. Diagnostics identify normalized
fields without echoing their values. Results follow fixture order.
[Sysmon field mapping](v24a-sysmon-compatibility.md#mapping-contract)

## Identity and reproduction

The version identity pairs the Sigma UUID and the SHA-256 of compact,
sorted-key UTF-8 JSON covering the UUID, supported metadata, compiled
tree, and compiler and evaluator contracts. YAML formatting and mapping
key order are immaterial. Condition operand order is retained. The exact
input bytes have a separate source SHA-256. Before evaluation, the
interpreter validates the compiled shape and contracts and recomputes
the content digest. Results record both contracts, the selected version
and source digest, and the loaded fixture identity.

From `backend` in the Python 3.12 environment with the backend
requirements installed, run the database-free example and negative
cases.

```powershell
.\.venv\Scripts\python.exe -m pytest -q --noconftest tests/test_sigma_replay.py
```

The example rule is authored for this repository. Compiling the example
produced digest
`36810a087ff6a569c6004178e9aa82207a4d34862495c723edc9764611849c4d`.
It matched the labeled synthetic event and returned non-match for both
controls. On the verified external fixture, three image values ruled
out a match and two events remained indeterminate because command-line
evidence was redacted. A separate image-and-host comparison confirmed
both mappings on the external fixture. These outcomes do not establish
external detection accuracy. The capture has no verified event labels.
[Example rule](../../backend/tests/fixtures/sigma-encoded-powershell.yml) · [Tests](../../backend/tests/test_sigma_replay.py) · [External fixture and provenance](v24b-external-replay-fixture.md)

The focused suite passed 58 tests in 1.36 seconds. The database-free
backend replay regression suite passed 366 tests in 49.80 seconds,
with one Starlette test-client deprecation warning. The suite covered
the historical replay evidence, the v2.3 proof, and v2.4-A/B artifact
integrity. Black passed for both new Python files.

The offline evaluator uses literal string operations and has no API or
operational rule dispatch integration. Replay manifest v1 and the
built-in proof are unchanged. Further v2.4 work includes independently
reviewed external rules and labels with preserved evidence, a mapping
support matrix for other formats, and deterministic multi-event
correlation.
