from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
)


ThreatIndicatorType = Literal[
    "ip",
    "domain",
    "url",
    "hash",
]


ThreatReputation = Literal[
    "benign",
    "unknown",
    "suspicious",
    "malicious",
]


class ThreatIndicatorCreate(BaseModel):
    indicator_type: ThreatIndicatorType

    value: str = Field(
        min_length=1,
        max_length=2048,
    )

    reputation: ThreatReputation = (
        "unknown"
    )

    confidence: int = Field(
        default=50,
        ge=0,
        le=100,
    )

    source: str = Field(
        default="analyst",
        min_length=1,
        max_length=100,
    )

    description: str | None = None

    tags: list[str] = Field(
        default_factory=list
    )

    first_seen: datetime | None = None

    last_seen: datetime | None = None


class ThreatIndicatorUpdate(BaseModel):
    reputation: ThreatReputation | None = (
        None
    )

    confidence: int | None = Field(
        default=None,
        ge=0,
        le=100,
    )

    source: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )

    description: str | None = None

    tags: list[str] | None = None

    first_seen: datetime | None = None

    last_seen: datetime | None = None


class ThreatIndicatorRead(BaseModel):
    model_config = ConfigDict(
        from_attributes=True
    )

    id: UUID
    indicator_type: str
    value: str
    reputation: str
    confidence: int
    source: str
    description: str | None
    tags: list[str]
    first_seen: datetime
    last_seen: datetime
    created_at: datetime
    updated_at: datetime