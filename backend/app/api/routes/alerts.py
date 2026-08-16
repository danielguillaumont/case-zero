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
from app.models.alert import Alert
from app.models.case import Case
from app.models.case_activity import CaseActivity
from app.schemas.alert import (
    AlertCreate,
    AlertRead,
    AlertUpdate,
)
from app.schemas.case import CaseRead


router = APIRouter(
    prefix="/api/alerts",
    tags=["Alerts"],
)


ACTIVITY_ACTOR = "Daniel Guillaumont"


@router.post(
    "",
    response_model=AlertRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_alert(
    alert_data: AlertCreate,
    session: AsyncSession = Depends(
        get_database_session
    ),
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
    session: AsyncSession = Depends(
        get_database_session
    ),
) -> list[Alert]:
    result = await session.execute(
        select(Alert).order_by(
            Alert.created_at.desc()
        )
    )

    alerts = result.scalars().all()

    return list(alerts)


@router.get(
    "/{alert_id}",
    response_model=AlertRead,
)
async def get_alert(
    alert_id: UUID,
    session: AsyncSession = Depends(
        get_database_session
    ),
) -> Alert:
    alert = await session.get(
        Alert,
        alert_id,
    )

    if alert is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found",
        )

    return alert


@router.post(
    "/{alert_id}/case",
    response_model=CaseRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_case_from_alert(
    alert_id: UUID,
    session: AsyncSession = Depends(
        get_database_session
    ),
) -> Case:
    alert = await session.get(
        Alert,
        alert_id,
    )

    if alert is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found",
        )

    if alert.case_id is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Alert is already linked to a case",
        )

    investigation_case = Case(
        title=f"Investigation: {alert.title}",
        description=(
            alert.description
            or (
                "Investigation created from alert: "
                f"{alert.title}"
            )
        ),
        status="open",
        priority=alert.severity,
        assigned_analyst=alert.assigned_analyst,
    )

    session.add(investigation_case)

    # Generate the new case UUID before
    # linking the alert and activities.
    await session.flush()

    alert.case_id = investigation_case.id

    case_created_activity = CaseActivity(
        case_id=investigation_case.id,
        event_type="case_created",
        actor=ACTIVITY_ACTOR,
        message=(
            "Investigation case created from alert "
            f'"{alert.title}".'
        ),
    )

    alert_linked_activity = CaseActivity(
        case_id=investigation_case.id,
        event_type="alert_linked",
        actor=ACTIVITY_ACTOR,
        message=(
            f'Alert "{alert.title}" linked to case.'
        ),
    )

    session.add(case_created_activity)
    session.add(alert_linked_activity)

    await session.commit()

    await session.refresh(investigation_case)
    await session.refresh(alert)

    return investigation_case


@router.patch(
    "/{alert_id}",
    response_model=AlertRead,
)
async def update_alert(
    alert_id: UUID,
    alert_data: AlertUpdate,
    session: AsyncSession = Depends(
        get_database_session
    ),
) -> Alert:
    alert = await session.get(
        Alert,
        alert_id,
    )

    if alert is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found",
        )

    update_data = alert_data.model_dump(
        exclude_unset=True
    )

    previous_case_id = alert.case_id

    target_case: Case | None = None

    if (
        "case_id" in update_data
        and update_data["case_id"] is not None
    ):
        target_case = await session.get(
            Case,
            update_data["case_id"],
        )

        if target_case is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Case not found",
            )

    for field, value in update_data.items():
        setattr(
            alert,
            field,
            value,
        )

    new_case_id = alert.case_id

    if (
        "case_id" in update_data
        and new_case_id is not None
        and new_case_id != previous_case_id
    ):
        alert_linked_activity = CaseActivity(
            case_id=new_case_id,
            event_type="alert_linked",
            actor=ACTIVITY_ACTOR,
            message=(
                f'Alert "{alert.title}" linked to case.'
            ),
        )

        session.add(alert_linked_activity)

    await session.commit()
    await session.refresh(alert)

    return alert