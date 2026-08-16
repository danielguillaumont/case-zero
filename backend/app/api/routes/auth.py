from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from fastapi.security import (
    OAuth2PasswordRequestForm,
)
from sqlalchemy import (
    func,
    select,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_database_session
from app.models.user import User
from app.schemas.auth import AccessTokenRead
from app.schemas.user import UserRead
from app.security import (
    create_access_token,
    verify_password,
)


router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"],
)


@router.post(
    "/login",
    response_model=AccessTokenRead,
)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: AsyncSession = Depends(
        get_database_session
    ),
) -> AccessTokenRead:
    email = (
        form_data.username
        .strip()
        .lower()
    )

    result = await session.execute(
        select(User).where(
            func.lower(
                User.email
            )
            == email
        )
    )

    user = result.scalar_one_or_none()

    if (
        user is None
        or not verify_password(
            form_data.password,
            user.password_hash,
        )
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_401_UNAUTHORIZED
            ),
            detail=(
                "Incorrect email or password"
            ),
            headers={
                "WWW-Authenticate": "Bearer"
            },
        )

    if not user.is_active:
        raise HTTPException(
            status_code=(
                status.HTTP_403_FORBIDDEN
            ),
            detail="User account is inactive",
        )

    access_token = create_access_token(
        user_id=user.id,
        role=user.role,
    )

    return AccessTokenRead(
        access_token=access_token,
    )


@router.get(
    "/me",
    response_model=UserRead,
)
async def get_me(
    current_user: User = Depends(
        get_current_user
    ),
) -> User:
    return current_user