from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_database_session
from app.models.alert import Alert
from app.schemas.alert import AlertCreate, AlertRead, AlertUpdate


router = APIRouter(
    prefix="/api/alerts",
    tags=["Alerts"],
)


@router.post(
    "",
    response_model=AlertRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_alert(
    alert_data: AlertCreate,
    session: AsyncSession = Depends(get_database_session),
) -> Alert:
    alert = Alert(
        title=alert_data.title,
        description=alert_data.description,
        severity=alert_data.severity,
        source=alert_data.source,
        status="new",
    )

    session.add(alert)

    await session.commit()
    await session.refresh(alert)

    return alert


@router.get(
    "",
    response_model=list[AlertRead],
)
async def get_alerts(
    session: AsyncSession = Depends(get_database_session),
) -> list[Alert]:
    result = await session.execute(
        select(Alert).order_by(Alert.created_at.desc())
    )

    alerts = result.scalars().all()

    return list(alerts)


@router.get(
    "/{alert_id}",
    response_model=AlertRead,
)
async def get_alert(
    alert_id: UUID,
    session: AsyncSession = Depends(get_database_session),
) -> Alert:
    alert = await session.get(Alert, alert_id)

    if alert is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found",
        )

    return alert


@router.patch(
    "/{alert_id}",
    response_model=AlertRead,
)
async def update_alert(
    alert_id: UUID,
    alert_data: AlertUpdate,
    session: AsyncSession = Depends(get_database_session),
) -> Alert:
    alert = await session.get(Alert, alert_id)

    if alert is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found",
        )

    update_data = alert_data.model_dump(
        exclude_unset=True
    )

    for field, value in update_data.items():
        setattr(alert, field, value)

    await session.commit()
    await session.refresh(alert)

    return alert