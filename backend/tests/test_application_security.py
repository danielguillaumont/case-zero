import asyncio
import selectors
import sys
from uuid import uuid4

import psycopg
from fastapi.testclient import TestClient

from app.config import (
    ALLOWED_HOSTS,
    API_DOCS_ENABLED,
    POSTGRES_DB,
    POSTGRES_HOST,
    POSTGRES_PASSWORD,
    POSTGRES_PORT,
    POSTGRES_USER,
)
from app.main import app
from app.security import create_access_token


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


def clear_application_security_users():
    assert (
        POSTGRES_DB
        == "casezero_test"
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
                DELETE FROM users
                WHERE email LIKE %s
                """,
                (
                    "%-app-security"
                    "@casezero.dev",
                ),
            )


def create_viewer_headers():
    assert (
        POSTGRES_DB
        == "casezero_test"
    )

    user_id = uuid4()

    email = (
        "viewer-"
        f"{user_id.hex[:8]}"
        "-app-security"
        "@casezero.dev"
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
                    "CASE ZERO Viewer",
                    (
                        "not-used-by-"
                        "application-security-test"
                    ),
                    "viewer",
                    True,
                ),
            )

    token = create_access_token(
        user_id=user_id,
        role="viewer",
    )

    return {
        "Authorization":
            f"Bearer {token}"
    }


def setup_function():
    clear_application_security_users()


def teardown_function():
    clear_application_security_users()


def test_expected_test_host_is_allowed():
    assert (
        "testserver"
        in ALLOWED_HOSTS
    )

    response = client.get(
        "/"
    )

    assert (
        response.status_code
        == 200
    )


def test_untrusted_host_is_rejected():
    response = client.get(
        "/",
        headers={
            "Host":
                "attacker.example"
        },
    )

    assert (
        response.status_code
        == 400
    )

    assert (
        response.text
        == "Invalid host header"
    )


def test_api_documentation_matches_configuration():
    response = client.get(
        "/docs"
    )

    if API_DOCS_ENABLED:
        assert (
            response.status_code
            == 200
        )

    else:
        assert (
            response.status_code
            == 404
        )


def test_openapi_schema_matches_configuration():
    response = client.get(
        "/openapi.json"
    )

    if API_DOCS_ENABLED:
        assert (
            response.status_code
            == 200
        )

    else:
        assert (
            response.status_code
            == 404
        )


def test_public_health_exposes_only_liveness():
    response = client.get(
        "/api/health"
    )

    assert (
        response.status_code
        == 200
    )

    assert response.json() == {
        "status": "online",
    }


def test_platform_status_requires_authentication():
    response = client.get(
        "/api/status"
    )

    assert (
        response.status_code
        == 401
    )


def test_authenticated_user_can_read_platform_status():
    headers = (
        create_viewer_headers()
    )

    response = client.get(
        "/api/status",
        headers=headers,
    )

    assert (
        response.status_code
        == 200
    )

    data = response.json()

    assert (
        data["status"]
        == "online"
    )

    assert (
        data["service"]
        == "CASE//ZERO API"
    )

    assert (
        data["database"]
        == "online"
    )

    assert (
        "version"
        in data
    )