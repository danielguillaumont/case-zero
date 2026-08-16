from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class CaseActivityRead(BaseModel):
    model_config = ConfigDict(
        from_attributes=True
    )

    id: UUID
    case_id: UUID
    event_type: str
    actor: str | None
    message: str
    created_at: datetime