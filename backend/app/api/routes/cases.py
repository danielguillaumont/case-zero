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
from app.models.case_note import CaseNote
from app.schemas.case import (
    CaseAlertRead,
    CaseCreate,
    CaseDetailRead,
    CaseRead,
    CaseUpdate,
)
from app.schemas.case_note import (
    CaseNoteCreate,
    CaseNoteRead,
)


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
    session: AsyncSession = Depends(
        get_database_session
    ),
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
    session: AsyncSession = Depends(
        get_database_session
    ),
) -> list[Case]:
    result = await session.execute(
        select(Case).order_by(
            Case.created_at.desc()
        )
    )

    cases = result.scalars().all()

    return list(cases)


@router.get(
    "/{case_id}/notes",
    response_model=list[CaseNoteRead],
)
async def get_case_notes(
    case_id: UUID,
    session: AsyncSession = Depends(
        get_database_session
    ),
) -> list[CaseNote]:
    investigation_case = await session.get(
        Case,
        case_id,
    )

    if investigation_case is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case not found",
        )

    result = await session.execute(
        select(CaseNote)
        .where(
            CaseNote.case_id == case_id
        )
        .order_by(
            CaseNote.created_at.desc()
        )
    )

    notes = result.scalars().all()

    return list(notes)


@router.post(
    "/{case_id}/notes",
    response_model=CaseNoteRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_case_note(
    case_id: UUID,
    note_data: CaseNoteCreate,
    session: AsyncSession = Depends(
        get_database_session
    ),
) -> CaseNote:
    investigation_case = await session.get(
        Case,
        case_id,
    )

    if investigation_case is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case not found",
        )

    note_content = note_data.content.strip()

    if not note_content:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Investigation note cannot be empty",
        )

    case_note = CaseNote(
        case_id=case_id,
        author="Daniel Guillaumont",
        content=note_content,
    )

    session.add(case_note)

    await session.commit()
    await session.refresh(case_note)

    return case_note


@router.get(
    "/{case_id}",
    response_model=CaseDetailRead,
)
async def get_case(
    case_id: UUID,
    session: AsyncSession = Depends(
        get_database_session
    ),
) -> CaseDetailRead:
    investigation_case = await session.get(
        Case,
        case_id,
    )

    if investigation_case is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case not found",
        )

    result = await session.execute(
        select(Alert)
        .where(
            Alert.case_id == case_id
        )
        .order_by(
            Alert.created_at.desc()
        )
    )

    linked_alerts = result.scalars().all()

    return CaseDetailRead(
        id=investigation_case.id,
        title=investigation_case.title,
        description=investigation_case.description,
        status=investigation_case.status,
        priority=investigation_case.priority,
        assigned_analyst=investigation_case.assigned_analyst,
        created_at=investigation_case.created_at,
        updated_at=investigation_case.updated_at,
        alerts=[
            CaseAlertRead.model_validate(
                alert
            )
            for alert in linked_alerts
        ],
    )


@router.patch(
    "/{case_id}",
    response_model=CaseRead,
)
async def update_case(
    case_id: UUID,
    case_data: CaseUpdate,
    session: AsyncSession = Depends(
        get_database_session
    ),
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