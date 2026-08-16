from datetime import datetime

from pydantic import BaseModel, Field


class HuntQuery(BaseModel):
    event_type: str | None = None
    source: str | None = None
    hostname: str | None = None
    username: str | None = None
    source_ip: str | None = None
    process_name: str | None = None
    contains: str | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    limit: int = Field(
        default=100,
        ge=1,
        le=500,
    )