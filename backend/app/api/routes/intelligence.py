from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    status,
)
from sqlalchemy import (
    or_,
    select,
)
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import require_roles
from app.database import get_database_session
from app.models.threat_indicator import ThreatIndicator
from app.models.user import User
from app.schemas.threat_indicator import (
    ThreatIndicatorCreate,
    ThreatIndicatorRead,
    ThreatIndicatorUpdate,
)


router = APIRouter(
    prefix="/api/intelligence",
    tags=["Threat Intelligence"],
)


@router.post(
    "",
    response_model=ThreatIndicatorRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_threat_indicator(
    indicator_data: ThreatIndicatorCreate,
    _current_user: User = Depends(
        require_roles(
            "administrator",
            "analyst",
        )
    ),
    session: AsyncSession = Depends(
        get_database_session
    ),
) -> ThreatIndicator:
    indicator_values = (
        indicator_data.model_dump(
            exclude_none=True
        )
    )

    threat_indicator = ThreatIndicator(
        **indicator_values
    )

    session.add(
        threat_indicator
    )

    try:
        await session.commit()

    except IntegrityError:
        await session.rollback()

        raise HTTPException(
            status_code=(
                status.HTTP_409_CONFLICT
            ),
            detail=(
                "Threat indicator already exists"
            ),
        )

    await session.refresh(
        threat_indicator
    )

    return threat_indicator


@router.get(
    "",
    response_model=list[ThreatIndicatorRead],
)
async def get_threat_indicators(
    indicator_type: str | None = Query(
        default=None
    ),
    reputation: str | None = Query(
        default=None
    ),
    source: str | None = Query(
        default=None
    ),
    search: str | None = Query(
        default=None
    ),
    limit: int = Query(
        default=100,
        ge=1,
        le=500,
    ),
    _current_user: User = Depends(
        require_roles(
            "administrator",
            "analyst",
            "viewer",
        )
    ),
    session: AsyncSession = Depends(
        get_database_session
    ),
) -> list[ThreatIndicator]:
    query = select(
        ThreatIndicator
    )

    if indicator_type:
        query = query.where(
            ThreatIndicator.indicator_type
            == indicator_type
        )

    if reputation:
        query = query.where(
            ThreatIndicator.reputation
            == reputation
        )

    if source:
        query = query.where(
            ThreatIndicator.source
            == source
        )

    if search:
        search_pattern = (
            f"%{search}%"
        )

        query = query.where(
            or_(
                ThreatIndicator.value.ilike(
                    search_pattern
                ),
                ThreatIndicator.description.ilike(
                    search_pattern
                ),
                ThreatIndicator.source.ilike(
                    search_pattern
                ),
            )
        )

    query = (
        query
        .order_by(
            ThreatIndicator.updated_at.desc()
        )
        .limit(limit)
    )

    result = await session.execute(
        query
    )

    indicators = (
        result.scalars().all()
    )

    return list(indicators)


@router.get(
    "/{indicator_id}",
    response_model=ThreatIndicatorRead,
)
async def get_threat_indicator(
    indicator_id: UUID,
    _current_user: User = Depends(
        require_roles(
            "administrator",
            "analyst",
            "viewer",
        )
    ),
    session: AsyncSession = Depends(
        get_database_session
    ),
) -> ThreatIndicator:
    threat_indicator = await session.get(
        ThreatIndicator,
        indicator_id,
    )

    if threat_indicator is None:
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
            ),
            detail=(
                "Threat indicator not found"
            ),
        )

    return threat_indicator


@router.patch(
    "/{indicator_id}",
    response_model=ThreatIndicatorRead,
)
async def update_threat_indicator(
    indicator_id: UUID,
    indicator_data: ThreatIndicatorUpdate,
    _current_user: User = Depends(
        require_roles(
            "administrator",
            "analyst",
        )
    ),
    session: AsyncSession = Depends(
        get_database_session
    ),
) -> ThreatIndicator:
    threat_indicator = await session.get(
        ThreatIndicator,
        indicator_id,
    )

    if threat_indicator is None:
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
            ),
            detail=(
                "Threat indicator not found"
            ),
        )

    updates = (
        indicator_data.model_dump(
            exclude_unset=True
        )
    )

    for field_name, value in (
        updates.items()
    ):
        setattr(
            threat_indicator,
            field_name,
            value,
        )

    await session.commit()

    await session.refresh(
        threat_indicator
    )

    return threat_indicator