from typing import Literal

from pydantic import BaseModel


DetectionRuleType = Literal[
    "single_event",
    "correlation",
]


DetectionRuleSeverity = Literal[
    "low",
    "medium",
    "high",
    "critical",
]


class DetectionRuleRead(BaseModel):
    id: str
    name: str
    description: str
    severity: DetectionRuleSeverity
    rule_type: DetectionRuleType
    enabled: bool
    event_type: str
    logic: str