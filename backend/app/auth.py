from uuid import UUID

import jwt
from fastapi import (
    Depends,
    HTTPException,
    status,
)
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_database_session
from app.models.user import User
from app.schemas.user import UserRole
from app.security import decode_access_token


oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/auth/login"
)


async def get_current_user(
    token: str = Depends(
        oauth2_scheme
    ),
    session: AsyncSession = Depends(
        get_database_session
    ),
) -> User:
    credentials_exception = HTTPException(
        status_code=(
            status.HTTP_401_UNAUTHORIZED
        ),
        detail=(
            "Could not validate credentials"
        ),
        headers={
            "WWW-Authenticate": "Bearer"
        },
    )

    try:
        payload = decode_access_token(
            token
        )

        subject = payload.get("sub")

        if not isinstance(
            subject,
            str,
        ):
            raise credentials_exception

        user_id = UUID(
            subject
        )

    except (
        jwt.InvalidTokenError,
        ValueError,
        TypeError,
    ):
        raise credentials_exception

    user = await session.get(
        User,
        user_id,
    )

    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=(
                status.HTTP_403_FORBIDDEN
            ),
            detail="User account is inactive",
        )

    return user


def require_roles(
    *allowed_roles: UserRole,
):
    async def role_dependency(
        current_user: User = Depends(
            get_current_user
        ),
    ) -> User:
        if (
            current_user.role
            not in allowed_roles
        ):
            raise HTTPException(
                status_code=(
                    status.HTTP_403_FORBIDDEN
                ),
                detail=(
                    "Insufficient permissions"
                ),
            )

        return current_user

    return role_dependency