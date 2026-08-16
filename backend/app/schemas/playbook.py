from typing import Literal

from pydantic import BaseModel


PlaybookSeverity = Literal[
    "low",
    "medium",
    "high",
    "critical",
]


PlaybookStepCategory = Literal[
    "triage",
    "investigation",
    "containment",
    "eradication",
    "recovery",
    "documentation",
]


class PlaybookStepRead(BaseModel):
    id: str
    order: int
    title: str
    description: str
    category: PlaybookStepCategory


class PlaybookRead(BaseModel):
    id: str
    name: str
    description: str
    severity: PlaybookSeverity
    enabled: bool
    trigger_rule_ids: list[str]
    steps: list[PlaybookStepRead]