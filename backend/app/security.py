from datetime import (
    datetime,
    timedelta,
    timezone,
)
from uuid import UUID

import jwt
from pwdlib import PasswordHash

from app.config import (
    JWT_ACCESS_TOKEN_MINUTES,
    JWT_ALGORITHM,
    JWT_SECRET_KEY,
)
from app.schemas.user import UserRole


password_hasher = PasswordHash.recommended()


def hash_password(
    password: str,
) -> str:
    return password_hasher.hash(
        password
    )


def verify_password(
    password: str,
    password_hash: str,
) -> bool:
    return password_hasher.verify(
        password,
        password_hash,
    )


def require_jwt_secret() -> str:
    if not JWT_SECRET_KEY:
        raise RuntimeError(
            "JWT_SECRET_KEY is not configured."
        )

    return JWT_SECRET_KEY


def create_access_token(
    user_id: UUID | str,
    role: UserRole,
    expires_delta: timedelta | None = None,
) -> str:
    secret_key = require_jwt_secret()

    issued_at = datetime.now(
        timezone.utc
    )

    if expires_delta is None:
        expires_delta = timedelta(
            minutes=JWT_ACCESS_TOKEN_MINUTES
        )

    expires_at = (
        issued_at
        + expires_delta
    )

    payload = {
        "sub": str(user_id),
        "role": role,
        "iat": issued_at,
        "exp": expires_at,
    }

    return jwt.encode(
        payload,
        secret_key,
        algorithm=JWT_ALGORITHM,
    )


def decode_access_token(
    token: str,
) -> dict:
    secret_key = require_jwt_secret()

    return jwt.decode(
        token,
        secret_key,
        algorithms=[
            JWT_ALGORITHM
        ],
        options={
            "require": [
                "sub",
                "role",
                "iat",
                "exp",
            ],
        },
    )