from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CaseNoteCreate(BaseModel):
    content: str = Field(
        min_length=1,
        max_length=5000,
    )


class CaseNoteRead(BaseModel):
    model_config = ConfigDict(
        from_attributes=True
    )

    id: UUID
    case_id: UUID
    author: str
    content: str
    created_at: datetime