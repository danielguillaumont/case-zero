from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


AlertSeverity = Literal[
    "low",
    "medium",
    "high",
    "critical",
]


class AlertCreate(BaseModel):
    title: str = Field(
        min_length=1,
        max_length=255,
    )

    description: str | None = None

    severity: AlertSeverity = "medium"

    source: str = Field(
        default="case-zero",
        min_length=1,
        max_length=100,
    )


class AlertRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    description: str | None
    severity: str
    status: str
    source: str
    created_at: datetime
    updated_at: datetime