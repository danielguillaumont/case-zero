from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
)


class SecurityEventCreate(BaseModel):
    event_type: str = Field(
        min_length=1,
        max_length=100,
    )

    source: str = Field(
        min_length=1,
        max_length=100,
    )

    event_time: datetime

    hostname: str | None = Field(
        default=None,
        max_length=255,
    )

    username: str | None = Field(
        default=None,
        max_length=255,
    )

    source_ip: str | None = Field(
        default=None,
        max_length=45,
    )

    destination_ip: str | None = Field(
        default=None,
        max_length=45,
    )

    process_name: str | None = Field(
        default=None,
        max_length=255,
    )

    command_line: str | None = None

    raw_data: dict[str, Any] | None = None


class SecurityEventRead(BaseModel):
    model_config = ConfigDict(
        from_attributes=True
    )

    id: UUID

    event_type: str
    source: str
    event_time: datetime

    hostname: str | None
    username: str | None
    source_ip: str | None
    destination_ip: str | None

    process_name: str | None
    command_line: str | None

    raw_data: dict[str, Any] | None

    created_at: datetime