"""Bounded Sigma compilation and literal evaluation for offline replay."""

import hashlib
import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from uuid import UUID

import yaml
from sigma.conditions import (
    ConditionAND,
    ConditionFieldEqualsValueExpression,
    ConditionIdentifier,
    ConditionOR,
)
from sigma.exceptions import SigmaError
from sigma.rule import SigmaRule
from sigma.types import SigmaString, SpecialChars

from app.services.replay_fixtures import (
    MAX_EVENTS,
    FixtureError,
    ReplayFixture,
    _string,
)

COMPILER_CONTRACT = "case-zero-sigma-compiler/v1"
EVALUATOR_CONTRACT = "case-zero-sigma-sysmon-process/v1"
MAX_RULE_BYTES = 16 * 1024
_FIELDS = {
    "Image": "process_name",
    "CommandLine": "command_line",
    "Computer": "hostname",
}
_MODIFIERS = {"contains", "startswith", "endswith"}
_LOGSOURCE = {"product": "windows", "service": "sysmon", "category": "process_creation"}
_SOURCES = ("Microsoft-Windows-Sysmon/Operational", "synthetic")
_SHA256 = re.compile(r"[0-9a-f]{64}")

# Leaf: (operator, normalized field, literal). Group: (and/or, tuple of children).
Expression = tuple[str, str, str] | tuple[str, tuple["Expression", ...]]


class SigmaCompatibilityError(ValueError):
    """An input is outside the supported Sigma replay contract."""


class _BoundedLoader(yaml.SafeLoader):
    def __init__(self, text: str):
        super().__init__(text)
        self.node_count = self.depth = 0

    def compose_node(self, parent, index):
        event = self.peek_event()
        if (
            isinstance(event, yaml.AliasEvent)
            or event.anchor is not None
            or event.tag is not None
        ):
            raise SigmaCompatibilityError(
                "YAML aliases, anchors and explicit tags are unsupported."
            )
        self.node_count += 1
        self.depth += 1
        if self.node_count > 128 or self.depth > 6:
            raise SigmaCompatibilityError("YAML node or nesting limit exceeded.")
        try:
            return super().compose_node(parent, index)
        finally:
            self.depth -= 1

    def construct_mapping(self, node, deep=False):
        keys = set()
        for key, _ in node.value:
            if key.tag != "tag:yaml.org,2002:str":
                raise SigmaCompatibilityError(
                    "YAML mapping keys must be strings. Merge keys are unsupported."
                )
            if key.value in keys:
                raise SigmaCompatibilityError(
                    f"Duplicate YAML key at line {key.start_mark.line + 1}."
                )
            keys.add(key.value)
        return super().construct_mapping(node, deep)


@dataclass(frozen=True, slots=True)
class CompiledSigmaRule:
    rule_id: str
    title: str
    expression: Expression
    source_sha256: str
    description: str | None = None
    author: str | None = None
    compiler_contract: str = COMPILER_CONTRACT
    evaluator_contract: str = EVALUATOR_CONTRACT
    content_sha256: str = field(init=False)

    def __post_init__(self) -> None:
        _validate_compiled(self)
        object.__setattr__(self, "content_sha256", self._digest())

    def _digest(self) -> str:
        payload = {
            "id": self.rule_id,
            "title": self.title,
            "description": self.description,
            "author": self.author,
            "expression": self.expression,
            "compiler_contract": self.compiler_contract,
            "evaluator_contract": self.evaluator_contract,
        }
        canonical = json.dumps(
            payload, sort_keys=True, ensure_ascii=True, separators=(",", ":")
        )
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    @property
    def version_id(self) -> tuple[str, str]:
        return self.rule_id, self.content_sha256


@dataclass(frozen=True, slots=True)
class SigmaFieldIssue:
    field: str
    code: str


@dataclass(frozen=True, slots=True)
class SigmaDecision:
    event_id: str
    ordinal: int
    outcome: str
    issues: tuple[SigmaFieldIssue, ...] = ()


@dataclass(frozen=True, slots=True)
class SigmaEvaluation:
    version_id: tuple[str, str]
    rule_source_sha256: str
    compiler_contract: str
    evaluator_contract: str
    fixture_sha256: str
    decisions: tuple[SigmaDecision, ...]


def _identity(rule_id: object) -> None:
    try:
        parsed = UUID(rule_id) if type(rule_id) is str else None
    except ValueError:
        parsed = None
    if parsed is None or parsed.version != 4 or str(parsed) != rule_id:
        raise SigmaCompatibilityError("Rule id must be a canonical lowercase UUIDv4.")


def _text(value: object, label: str) -> str:
    if (
        type(value) is not str
        or not 1 <= len(value) <= 256
        or not value.strip()
        or not value.isprintable()
    ):
        raise SigmaCompatibilityError(
            f"{label} must be a nonblank printable string of at most 256 characters."
        )
    return value


def _validate_compiled(rule: CompiledSigmaRule) -> set[str]:
    if (
        type(rule.compiler_contract) is not str
        or rule.compiler_contract != COMPILER_CONTRACT
        or type(rule.evaluator_contract) is not str
        or rule.evaluator_contract != EVALUATOR_CONTRACT
    ):
        raise SigmaCompatibilityError("Unsupported compiled Sigma contract.")
    _identity(rule.rule_id)
    _text(rule.title, "title")
    for name in ("description", "author"):
        if (value := getattr(rule, name)) is not None:
            _text(value, name)
    if type(rule.source_sha256) is not str or not _SHA256.fullmatch(rule.source_sha256):
        raise SigmaCompatibilityError("Invalid Sigma source SHA-256.")
    fields = set()
    stack = [(rule.expression, 1)]
    count = 0
    while stack:
        node, depth = stack.pop()
        count += 1
        if count > 64 or depth > 8:
            raise SigmaCompatibilityError(
                "Compiled expression complexity limit exceeded."
            )
        if type(node) is not tuple or not node or type(node[0]) is not str:
            raise SigmaCompatibilityError("Unsupported compiled expression node.")
        if len(node) == 3 and node[0] in _MODIFIERS | {"exact"}:
            if type(node[1]) is not str or node[1] not in _FIELDS.values():
                raise SigmaCompatibilityError("Unsupported compiled field.")
            _literal(node[2])
            fields.add(node[1])
        elif (
            len(node) == 2
            and node[0] in ("and", "or")
            and type(node[1]) is tuple
            and 2 <= len(node[1]) <= 64
        ):
            stack.extend((child, depth + 1) for child in node[1])
        else:
            raise SigmaCompatibilityError(
                "Unsupported compiled operator or node shape."
            )
    return fields


def _literal(value: object) -> str:
    text = _text(value, "Detection value")
    if any(char in text for char in "*?%"):
        raise SigmaCompatibilityError(
            "Wildcards and placeholders are unsupported in literal values."
        )
    return text


def _validate_detection(detection: object) -> set[str]:
    if type(detection) is not dict or not 2 <= len(detection) <= 9:
        raise SigmaCompatibilityError(
            "Detection requires one condition and 1–8 named selections."
        )
    condition = detection.get("condition")
    if (
        type(condition) is not str
        or len(condition) > 256
        or not re.fullmatch(r"[A-Za-z0-9_() \t-]+", condition)
    ):
        raise SigmaCompatibilityError(
            "Use a single condition with named selections and AND/OR operators."
        )
    tokens = re.findall(r"[A-Za-z0-9_-]+|[()]", condition)
    if len(tokens) > 31:
        raise SigmaCompatibilityError("Condition token limit exceeded.")
    depth = 0
    for token in tokens:
        depth += (token == "(") - (token == ")")
        if not 0 <= depth <= 4:
            raise SigmaCompatibilityError(
                "Condition parentheses are unbalanced or too deeply nested."
            )
    if depth:
        raise SigmaCompatibilityError("Condition parentheses are unbalanced.")
    names = detection.keys() - {"condition"}
    for name in sorted(names):
        if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_-]{0,31}", name) or name.lower() in {
            "and",
            "or",
            "not",
            "all",
            "of",
            "them",
        }:
            raise SigmaCompatibilityError("Unsupported selection name.")
        selection = detection[name]
        if type(selection) is not dict or not 1 <= len(selection) <= 3:
            raise SigmaCompatibilityError(
                "Each selection must map 1–3 distinct fields to single strings."
            )
        fields = set()
        for key, value in selection.items():
            source_field, separator, modifier = key.partition("|")
            if source_field not in _FIELDS:
                raise SigmaCompatibilityError(
                    "Unsupported Sigma field. Use Image, CommandLine or Computer."
                )
            if source_field in fields:
                raise SigmaCompatibilityError(
                    "A selection cannot repeat a field with different modifiers."
                )
            fields.add(source_field)
            if separator and modifier not in _MODIFIERS:
                raise SigmaCompatibilityError(
                    "Unsupported modifier. Use contains, startswith or endswith individually."
                )
            _literal(value)
    return names


def _referenced_selections(tree) -> set[str]:
    if type(tree) is ConditionIdentifier:
        return {tree.identifier}
    if type(tree) in (ConditionAND, ConditionOR):
        return set().union(*(_referenced_selections(child) for child in tree.args))
    raise SigmaCompatibilityError(
        "Unsupported condition. Use named selections, and, or and parentheses."
    )


def _compile_tree(tree) -> Expression:
    if type(tree) in (ConditionAND, ConditionOR):
        operator = "and" if type(tree) is ConditionAND else "or"
        return operator, tuple(_compile_tree(child) for child in tree.args)
    if (
        type(tree) is ConditionFieldEqualsValueExpression
        and tree.field in _FIELDS
        and type(tree.value) is SigmaString
    ):
        match list(tree.value.s):
            case [str(value)]:
                operator = "exact"
            case [SpecialChars.WILDCARD_MULTI, str(value), SpecialChars.WILDCARD_MULTI]:
                operator = "contains"
            case [str(value), SpecialChars.WILDCARD_MULTI]:
                operator = "startswith"
            case [SpecialChars.WILDCARD_MULTI, str(value)]:
                operator = "endswith"
            case _:
                raise SigmaCompatibilityError("Unsupported pySigma string structure.")
        return operator, _FIELDS[tree.field], value
    raise SigmaCompatibilityError("Unsupported pySigma condition node.")


def compile_sigma_rule(data: bytes) -> CompiledSigmaRule:
    """Compile one UTF-8 YAML document using pySigma's parsed condition tree."""
    if type(data) is not bytes or not 1 <= len(data) <= MAX_RULE_BYTES:
        raise SigmaCompatibilityError("Sigma rule must be 1–16384 bytes.")
    try:
        document = yaml.load(data.decode("utf-8"), Loader=_BoundedLoader)
    except SigmaCompatibilityError:
        raise
    except (ValueError, yaml.YAMLError):
        raise SigmaCompatibilityError(
            "Expected exactly one well-formed UTF-8 YAML rule."
        ) from None
    required = {"title", "id", "logsource", "detection"}
    if type(document) is not dict or not required <= document.keys() <= required | {
        "description",
        "author",
    }:
        raise SigmaCompatibilityError(
            "Require title, id, logsource and detection. Only description and author are optional."
        )
    if document["logsource"] != _LOGSOURCE:
        raise SigmaCompatibilityError(
            "Require a windows/sysmon/process_creation logsource."
        )
    _identity(document["id"])
    for key in ("title", "description", "author"):
        if key in document:
            _text(document[key], key)
    names = _validate_detection(document["detection"])
    # AND-linked fields have stable ordering across equivalent YAML mappings.
    document["detection"] = {
        name: dict(sorted(document["detection"][name].items()))
        for name in sorted(names)
    } | {"condition": document["detection"]["condition"]}
    try:
        parsed_rule = SigmaRule.from_dict(document)
        condition = parsed_rule.detection.parsed_condition[0]
        referenced = _referenced_selections(condition.parse(False))
        if referenced - names:
            raise SigmaCompatibilityError(
                "Condition references an undefined selection."
            )
        if names - referenced:
            raise SigmaCompatibilityError("Remove unreferenced selections.")
        expression = _compile_tree(condition.parse())
    except SigmaError:
        raise SigmaCompatibilityError(
            "pySigma rejected the rule or condition. Check selector names and AND/OR syntax."
        ) from None
    return CompiledSigmaRule(
        rule_id=str(parsed_rule.id),
        title=parsed_rule.title,
        expression=expression,
        source_sha256=hashlib.sha256(data).hexdigest(),
        description=document.get("description"),
        author=document.get("author"),
    )


def load_sigma_rule(path: Path) -> CompiledSigmaRule:
    """Read one bounded local rule file."""
    try:
        if path.as_posix().startswith("//"):
            raise SigmaCompatibilityError("Sigma rule path must be local.")
        path = path.resolve(strict=True)
        if path.as_posix().startswith("//") or not path.is_file():
            raise SigmaCompatibilityError(
                "Sigma rule path must be a regular local file."
            )
        with path.open("rb") as stream:
            data = stream.read(MAX_RULE_BYTES + 1)
    except (OSError, RuntimeError):
        raise SigmaCompatibilityError("Unable to read local Sigma rule.") from None
    return compile_sigma_rule(data)


def _matches(node: Expression, values: dict[str, str | None]) -> bool | None:
    if len(node) == 2:
        operator, children = node
        results = [_matches(child, values) for child in children]
        if operator == "and":
            return False if False in results else None if None in results else True
        return True if True in results else None if None in results else False
    operator, name, literal = node
    text = values[name]
    if text is None:
        return None
    literal = literal.casefold()
    match operator:
        case "exact":
            return text == literal
        case "contains":
            return literal in text
        case "startswith":
            return text.startswith(literal)
        case "endswith":
            return text.endswith(literal)
    raise SigmaCompatibilityError("Unsupported compiled operator.")


def evaluate_sigma_fixture(
    fixture: ReplayFixture, rule: CompiledSigmaRule
) -> SigmaEvaluation:
    """Run one compiled rule on a loader-normalized fixture in fixture order."""
    if type(rule) is not CompiledSigmaRule:
        raise SigmaCompatibilityError("Expected a compiled Sigma rule.")
    fields = sorted(_validate_compiled(rule))
    if type(rule.content_sha256) is not str or rule.content_sha256 != rule._digest():
        raise SigmaCompatibilityError(
            "Compiled rule identity does not match its definition."
        )
    if (
        type(fixture) is not ReplayFixture
        or type(fixture.schema_version) is not int
        or fixture.schema_version != 1
    ):
        raise SigmaCompatibilityError(
            "Expected a replay fixture with schema version 1."
        )
    if not 1 <= len(fixture.events) <= MAX_EVENTS:
        raise SigmaCompatibilityError(
            "Fixture event count is outside the supported bounds."
        )
    decisions = []
    for event in fixture.events:
        if (
            event.fields.get("event_type") != "process_creation"
            or event.fields.get("source") not in _SOURCES
        ):
            decisions.append(
                SigmaDecision(event.event_id, event.ordinal, "unsupported_event")
            )
            continue
        values: dict[str, str | None] = {}
        issues = []
        for name in fields:
            value = event.fields.get(name)
            values[name] = None
            if name not in event.fields:
                issues.append(SigmaFieldIssue(name, "missing"))
            elif value is None:
                issues.append(SigmaFieldIssue(name, "null"))
            else:
                try:
                    if type(value) is not str:
                        raise FixtureError("Expected string.")
                    values[name] = _string(value, name).casefold()
                except FixtureError:
                    issues.append(SigmaFieldIssue(name, "invalid"))
        if any(issue.code == "invalid" for issue in issues):
            outcome = "error"
        else:
            matched = _matches(rule.expression, values)
            outcome = (
                "indeterminate"
                if matched is None
                else "match"
                if matched
                else "no_match"
            )
        decisions.append(
            SigmaDecision(event.event_id, event.ordinal, outcome, tuple(issues))
        )
    return SigmaEvaluation(
        rule.version_id,
        rule.source_sha256,
        rule.compiler_contract,
        rule.evaluator_contract,
        fixture.content_hash,
        tuple(decisions),
    )
