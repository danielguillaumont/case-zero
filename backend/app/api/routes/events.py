from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_database_session
from app.models.security_event import SecurityEvent
from app.schemas.security_event import (
    SecurityEventCreate,
    SecurityEventRead,
)


router = APIRouter(
    prefix="/api/events",
    tags=["Security Events"],
)


@router.post(
    "",
    response_model=SecurityEventRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_security_event(
    event_data: SecurityEventCreate,
    session: AsyncSession = Depends(
        get_database_session
    ),
) -> SecurityEvent:
    security_event = SecurityEvent(
        **event_data.model_dump()
    )

    session.add(security_event)

    await session.commit()
    await session.refresh(security_event)

    return security_event


@router.get(
    "",
    response_model=list[SecurityEventRead],
)
async def get_security_events(
    session: AsyncSession = Depends(
        get_database_session
    ),
) -> list[SecurityEvent]:
    result = await session.execute(
        select(SecurityEvent).order_by(
            SecurityEvent.event_time.desc()
        )
    )

    events = result.scalars().all()

    return list(events)


@router.get(
    "/{event_id}",
    response_model=SecurityEventRead,
)
async def get_security_event(
    event_id: UUID,
    session: AsyncSession = Depends(
        get_database_session
    ),
) -> SecurityEvent:
    security_event = await session.get(
        SecurityEvent,
        event_id,
    )

    if security_event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Security event not found",
        )

    return security_event