from fastapi import (
    APIRouter,
    Depends,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import require_roles
from app.database import get_database_session
from app.models.security_event import SecurityEvent
from app.models.user import User
from app.schemas.hunt import HuntQuery
from app.schemas.security_event import (
    SecurityEventRead,
)
from app.services.hunt_service import (
    search_security_events,
)


router = APIRouter(
    prefix="/api/hunt",
    tags=["Threat Hunting"],
)


@router.post(
    "",
    response_model=list[SecurityEventRead],
)
async def hunt_security_events(
    hunt_query: HuntQuery,
    _current_user: User = Depends(
        require_roles(
            "administrator",
            "analyst",
        )
    ),
    session: AsyncSession = Depends(
        get_database_session
    ),
) -> list[SecurityEvent]:
    return await search_security_events(
        hunt_query,
        session,
    )