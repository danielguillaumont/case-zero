"""Immutable definitions for the built-in encoded PowerShell replay rule.

The predicate ID denotes the existing matcher: process_creation (lowercased),
a lowercased PowerShell basename (powershell or pwsh, with or without .exe),
and a case-insensitive search for -enc or -encodedcommand bounded by
whitespace or string edges. The evaluator contract also identifies replay's
field validation and error behavior. Keep those IDs tied to their original
semantics when introducing future versions.

The long-switch predicate and its separate evaluator contract describe the
offline regression variant, which recognizes only -encodedcommand.

The content hash covers the complete definition, including its title and
compatibility. The version ID is the logical rule ID paired with that digest.
It identifies a declaration, not a fingerprint of Python code or evidence of
execution. This module supplies no dispatch, persistence, or import format.
"""

import hashlib
import json
from dataclasses import asdict, dataclass, field

CORRECTED_PREDICATE_ID = "encoded-powershell-switch/v1"
CORRECTED_EVALUATOR_CONTRACT = "encoded-powershell/v1"
WEAKENED_PREDICATE_ID = "encoded-powershell-long-switch/v1"
WEAKENED_EVALUATOR_CONTRACT = "encoded-powershell-long-switch/v1"
_CONTRACTS_BY_PREDICATE = {
    CORRECTED_PREDICATE_ID: CORRECTED_EVALUATOR_CONTRACT,
    WEAKENED_PREDICATE_ID: WEAKENED_EVALUATOR_CONTRACT,
}


@dataclass(frozen=True, slots=True)
class RuleCompatibility:
    evaluator_contract: str = CORRECTED_EVALUATOR_CONTRACT
    fixture_schema_version: int = 1

    def __post_init__(self) -> None:
        if type(self.evaluator_contract) is not str:
            raise ValueError("evaluator_contract must be a string.")
        if self.evaluator_contract not in _CONTRACTS_BY_PREDICATE.values():
            raise ValueError("Unsupported evaluator contract.")
        if type(self.fixture_schema_version) is not int:
            raise ValueError("fixture_schema_version must be an integer.")
        if self.fixture_schema_version != 1:
            raise ValueError("Unsupported fixture schema version.")


@dataclass(frozen=True, slots=True)
class RuleDefinition:
    rule_id: str = "encoded-powershell"
    title: str = "Encoded PowerShell"
    predicate_id: str = CORRECTED_PREDICATE_ID
    compatibility: RuleCompatibility = field(default_factory=RuleCompatibility)
    definition_schema_version: int = 1

    def __post_init__(self) -> None:
        if type(self.definition_schema_version) is not int:
            raise ValueError("definition_schema_version must be an integer.")
        if self.definition_schema_version != 1:
            raise ValueError("Unsupported definition schema version.")
        if type(self.rule_id) is not str or self.rule_id != "encoded-powershell":
            raise ValueError("Unsupported rule_id. Expected encoded-powershell.")
        if (
            type(self.predicate_id) is not str
            or self.predicate_id not in _CONTRACTS_BY_PREDICATE
        ):
            raise ValueError("Unsupported predicate_id for encoded-powershell.")
        if type(self.compatibility) is not RuleCompatibility:
            raise ValueError("compatibility must be a RuleCompatibility.")
        if (
            self.compatibility.evaluator_contract
            != _CONTRACTS_BY_PREDICATE[self.predicate_id]
        ):
            raise ValueError("Evaluator contract does not support this predicate_id.")
        if (
            type(self.title) is not str
            or not 1 <= len(self.title) <= 120
            or not self.title.isprintable()
            or self.title != self.title.strip()
        ):
            raise ValueError(
                "title must contain 1 to 120 printable characters with no surrounding whitespace."
            )

    def canonical_json(self) -> bytes:
        """Return sorted compact JSON as UTF-8, with ASCII escapes and no newline.

        Title text is preserved exactly. Source key order, whitespace between
        JSON tokens, and equivalent JSON escape spellings are immaterial.
        """
        return json.dumps(
            asdict(self), sort_keys=True, separators=(",", ":"), ensure_ascii=True
        ).encode("utf-8")


@dataclass(frozen=True, slots=True)
class RuleVersion:
    definition: RuleDefinition
    content_sha256: str = field(init=False)

    def __post_init__(self) -> None:
        if type(self.definition) is not RuleDefinition:
            raise ValueError("definition must be a RuleDefinition.")
        object.__setattr__(
            self,
            "content_sha256",
            hashlib.sha256(self.definition.canonical_json()).hexdigest(),
        )

    @property
    def version_id(self) -> tuple[str, str]:
        return self.definition.rule_id, self.content_sha256
