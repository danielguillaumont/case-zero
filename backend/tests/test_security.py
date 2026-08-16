from datetime import timedelta
from uuid import uuid4

import jwt
import pytest

from app.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


def test_password_hash_is_not_plaintext():
    password = (
        "Correct-Horse-Battery-2026!"
    )

    password_hash = hash_password(
        password
    )

    assert password_hash != password

    assert password_hash.startswith(
        "$argon2"
    )


def test_correct_password_verifies():
    password = (
        "Correct-Horse-Battery-2026!"
    )

    password_hash = hash_password(
        password
    )

    assert verify_password(
        password,
        password_hash,
    ) is True


def test_incorrect_password_does_not_verify():
    password_hash = hash_password(
        "Correct-Horse-Battery-2026!"
    )

    assert verify_password(
        "Definitely-Wrong-Password!",
        password_hash,
    ) is False


def test_access_token_contains_user_and_role():
    user_id = uuid4()

    token = create_access_token(
        user_id=user_id,
        role="analyst",
    )

    payload = decode_access_token(
        token
    )

    assert payload["sub"] == str(
        user_id
    )

    assert payload["role"] == "analyst"

    assert "iat" in payload
    assert "exp" in payload


def test_expired_access_token_is_rejected():
    user_id = uuid4()

    token = create_access_token(
        user_id=user_id,
        role="viewer",
        expires_delta=timedelta(
            seconds=-1
        ),
    )

    with pytest.raises(
        jwt.ExpiredSignatureError
    ):
        decode_access_token(
            token
        )


def test_modified_access_token_is_rejected():
    user_id = uuid4()

    token = create_access_token(
        user_id=user_id,
        role="administrator",
    )

    replacement = (
        "a"
        if token[-1] != "a"
        else "b"
    )

    tampered_token = (
        token[:-1]
        + replacement
    )

    with pytest.raises(
        jwt.InvalidTokenError
    ):
        decode_access_token(
            tampered_token
        )