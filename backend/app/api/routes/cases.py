from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_database_session
from app.models.case import Case
from app.schemas.case import CaseCreate, CaseRead, CaseUpdate


router = APIRouter(
    prefix="/api/cases",
    tags=["Cases"],
)


@router.post(
    "",
    response_model=CaseRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_case(
    case_data: CaseCreate,
    session: AsyncSession = Depends(get_database_session),
) -> Case:
    investigation_case = Case(
        title=case_data.title,
        description=case_data.description,
        priority=case_data.priority,
        assigned_analyst=case_data.assigned_analyst,
        status="open",
    )

    session.add(investigation_case)

    await session.commit()
    await session.refresh(investigation_case)

    return investigation_case


@router.get(
    "",
    response_model=list[CaseRead],
)
async def get_cases(
    session: AsyncSession = Depends(get_database_session),
) -> list[Case]:
    result = await session.execute(
        select(Case).order_by(
            Case.created_at.desc()
        )
    )

    cases = result.scalars().all()

    return list(cases)


@router.get(
    "/{case_id}",
    response_model=CaseRead,
)
async def get_case(
    case_id: UUID,
    session: AsyncSession = Depends(get_database_session),
) -> Case:
    investigation_case = await session.get(
        Case,
        case_id,
    )

    if investigation_case is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case not found",
        )

    return investigation_case


@router.patch(
    "/{case_id}",
    response_model=CaseRead,
)
async def update_case(
    case_id: UUID,
    case_data: CaseUpdate,
    session: AsyncSession = Depends(get_database_session),
) -> Case:
    investigation_case = await session.get(
        Case,
        case_id,
    )

    if investigation_case is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case not found",
        )

    update_data = case_data.model_dump(
        exclude_unset=True
    )

    for field, value in update_data.items():
        setattr(
            investigation_case,
            field,
            value,
        )

    await session.commit()
    await session.refresh(investigation_case)

    return investigation_case