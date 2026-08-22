from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request,
    status,
)
from fastapi.security import (
    OAuth2PasswordRequestForm,
)
from sqlalchemy import (
    func,
    select,
)
from sqlalchemy.ext.asyncio import (
    AsyncSession,
)

from app.auth import get_current_user
from app.database import (
    get_database_session,
)
from app.models.user import User
from app.schemas.auth import (
    AccessTokenRead,
)
from app.schemas.user import UserRead
from app.security import (
    create_access_token,
    hash_password,
    verify_password,
)
from app.services.login_throttle import (
    clear_login_failures,
    get_login_retry_after,
    hash_login_identity,
    normalize_login_identity,
    record_login_failure,
)
from app.services.security_audit import (
    record_security_audit_event,
)


router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"],
)


DUMMY_PASSWORD_HASH = hash_password(
    (
        "CASE-ZERO-DUMMY-"
        "PASSWORD-VERIFICATION-ONLY"
    )
)


def invalid_credentials_exception():
    return HTTPException(
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


def throttled_login_exception(
    retry_after: int,
):
    return HTTPException(
        status_code=(
            status.HTTP_429_TOO_MANY_REQUESTS
        ),
        detail=(
            "Too many login attempts. "
            "Try again later."
        ),
        headers={
            "Retry-After":
                str(retry_after)
        },
    )


@router.post(
    "/login",
    response_model=AccessTokenRead,
)
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: AsyncSession = Depends(
        get_database_session
    ),
) -> AccessTokenRead:
    email = (
        normalize_login_identity(
            form_data.username
        )
    )

    identity_hash = (
        hash_login_identity(
            email
        )
    )

    retry_after = (
        await get_login_retry_after(
            session,
            identity_hash,
        )
    )

    if retry_after is not None:
        await record_security_audit_event(
            request=request,
            event_type=(
                "auth.login_throttled"
            ),
            outcome="throttled",
            severity="high",
            identity_hash=(
                identity_hash
            ),
            details={
                "retry_after_seconds":
                    retry_after,
            },
        )

        raise throttled_login_exception(
            retry_after
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

    password_hash = (
        user.password_hash
        if user is not None
        else DUMMY_PASSWORD_HASH
    )

    password_valid = verify_password(
        form_data.password,
        password_hash,
    )

    credentials_valid = (
        user is not None
        and user.is_active
        and password_valid
    )

    if not credentials_valid:
        retry_after = (
            await record_login_failure(
                session,
                identity_hash,
            )
        )

        audit_user_id = (
            user.id
            if user is not None
            else None
        )

        if retry_after is not None:
            await record_security_audit_event(
                request=request,
                event_type=(
                    "auth.login_throttled"
                ),
                outcome="throttled",
                severity="high",
                user_id=audit_user_id,
                identity_hash=(
                    identity_hash
                ),
                details={
                    "retry_after_seconds":
                        retry_after,
                },
            )

            raise (
                throttled_login_exception(
                    retry_after
                )
            )

        await record_security_audit_event(
            request=request,
            event_type=(
                "auth.login_failure"
            ),
            outcome="failure",
            severity="warning",
            user_id=audit_user_id,
            identity_hash=identity_hash,
        )

        raise (
            invalid_credentials_exception()
        )

    assert user is not None

    await clear_login_failures(
        session,
        identity_hash,
    )

    access_token = create_access_token(
        user_id=user.id,
        role=user.role,
    )

    await record_security_audit_event(
        request=request,
        event_type=(
            "auth.login_success"
        ),
        outcome="success",
        severity="info",
        user_id=user.id,
        identity_hash=identity_hash,
        details={
            "role": user.role,
        },
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