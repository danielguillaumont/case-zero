import asyncio
import selectors
import sys
from uuid import uuid4

import psycopg
from fastapi.testclient import TestClient

from app.config import (
    POSTGRES_DB,
    POSTGRES_HOST,
    POSTGRES_PASSWORD,
    POSTGRES_PORT,
    POSTGRES_USER,
)
from app.main import app
from app.security import hash_password


def create_selector_event_loop():
    return asyncio.SelectorEventLoop(
        selectors.SelectSelector()
    )


def create_test_client() -> TestClient:
    backend_options = {}

    if sys.platform == "win32":
        backend_options[
            "loop_factory"
        ] = create_selector_event_loop

    return TestClient(
        app,
        backend="asyncio",
        backend_options=backend_options,
    )


client = create_test_client()


def clear_auth_test_users() -> None:
    assert POSTGRES_DB == "casezero_test"

    with psycopg.connect(
        dbname=POSTGRES_DB,
        user=POSTGRES_USER,
        password=POSTGRES_PASSWORD,
        host=POSTGRES_HOST,
        port=POSTGRES_PORT,
        autocommit=True,
    ) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                DELETE FROM users
                WHERE email LIKE %s
                """,
                ("%@casezero.dev",),
            )


def create_test_user(
    *,
    email: str,
    password: str,
    role: str = "analyst",
    is_active: bool = True,
) -> str:
    assert POSTGRES_DB == "casezero_test"

    user_id = uuid4()

    password_hash = hash_password(
        password
    )

    with psycopg.connect(
        dbname=POSTGRES_DB,
        user=POSTGRES_USER,
        password=POSTGRES_PASSWORD,
        host=POSTGRES_HOST,
        port=POSTGRES_PORT,
        autocommit=True,
    ) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO users (
                    id,
                    email,
                    display_name,
                    password_hash,
                    role,
                    is_active
                )
                VALUES (
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s
                )
                """,
                (
                    user_id,
                    email,
                    "CASE ZERO Test User",
                    password_hash,
                    role,
                    is_active,
                ),
            )

    return str(user_id)


def setup_function() -> None:
    clear_auth_test_users()


def teardown_function() -> None:
    clear_auth_test_users()


def test_valid_login_returns_access_token():
    email = "analyst@casezero.dev"
    password = "Test-Analyst-Password-2026!"

    create_test_user(
        email=email,
        password=password,
        role="analyst",
    )

    response = client.post(
        "/api/auth/login",
        data={
            "username": email,
            "password": password,
        },
    )

    assert response.status_code == 200

    body = response.json()

    assert body["token_type"] == "bearer"

    assert isinstance(
        body["access_token"],
        str,
    )

    assert body["access_token"]


def test_authenticated_me_returns_current_user():
    email = "viewer@casezero.dev"
    password = "Test-Viewer-Password-2026!"

    user_id = create_test_user(
        email=email,
        password=password,
        role="viewer",
    )

    login_response = client.post(
        "/api/auth/login",
        data={
            "username": email,
            "password": password,
        },
    )

    assert login_response.status_code == 200

    token = login_response.json()[
        "access_token"
    ]

    me_response = client.get(
        "/api/auth/me",
        headers={
            "Authorization":
                f"Bearer {token}"
        },
    )

    assert me_response.status_code == 200

    user = me_response.json()

    assert user["id"] == user_id
    assert user["email"] == email
    assert user["role"] == "viewer"
    assert user["is_active"] is True

    assert "password" not in user
    assert "password_hash" not in user


def test_wrong_password_is_rejected():
    email = "wrongpass@casezero.dev"

    create_test_user(
        email=email,
        password="Correct-Password-2026!",
    )

    response = client.post(
        "/api/auth/login",
        data={
            "username": email,
            "password":
                "Definitely-Wrong-Password!",
        },
    )

    assert response.status_code == 401

    assert response.json() == {
        "detail":
            "Incorrect email or password"
    }


def test_invalid_token_is_rejected():
    response = client.get(
        "/api/auth/me",
        headers={
            "Authorization":
                "Bearer invalid-token"
        },
    )

    assert response.status_code == 401

    assert response.json() == {
        "detail":
            "Could not validate credentials"
    }


def test_inactive_user_cannot_login():
    email = "inactive@casezero.dev"
    password = "Inactive-Password-2026!"

    create_test_user(
        email=email,
        password=password,
        role="analyst",
        is_active=False,
    )

    response = client.post(
        "/api/auth/login",
        data={
            "username": email,
            "password": password,
        },
    )

    assert response.status_code == 403

    assert response.json() == {
        "detail":
            "User account is inactive"
    }