from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_database_session
from app.models.alert import Alert
from app.schemas.alert import AlertCreate, AlertRead


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