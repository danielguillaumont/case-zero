from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


CaseStatus = Literal[
    "open",
    "investigating",
    "resolved",
    "closed",
]

CasePriority = Literal[
    "low",
    "medium",
    "high",
    "critical",
]


class CaseCreate(BaseModel):
    title: str = Field(
        min_length=1,
        max_length=255,
    )

    description: str | None = None

    priority: CasePriority = "medium"

    assigned_analyst: str | None = Field(
        default=None,
        min_length=1,
        max_length=255,
    )


class CaseUpdate(BaseModel):
    title: str | None = Field(
        default=None,
        min_length=1,
        max_length=255,
    )

    description: str | None = None

    status: CaseStatus | None = None

    priority: CasePriority | None = None

    assigned_analyst: str | None = Field(
        default=None,
        min_length=1,
        max_length=255,
    )


class CaseRead(BaseModel):
    model_config = ConfigDict(
        from_attributes=True
    )

    id: UUID
    title: str
    description: str | None
    status: str
    priority: str
    assigned_analyst: str | None
    created_at: datetime
    updated_at: datetime