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


def clear_rbac_test_data() -> None:
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
                DELETE FROM alerts
                WHERE source_event_id IN (
                    SELECT id
                    FROM security_events
                    WHERE source = %s
                )
                """,
                ("rbac-test",),
            )

            cursor.execute(
                """
                DELETE FROM security_events
                WHERE source = %s
                """,
                ("rbac-test",),
            )

            cursor.execute(
                """
                DELETE FROM users
                WHERE email LIKE %s
                """,
                (
                    "%-events-hunt-rbac"
                    "@casezero.dev",
                ),
            )


def create_role_headers(
    role: str,
) -> dict[str, str]:
    assert POSTGRES_DB == "casezero_test"

    user_id = uuid4()

    email = (
        f"{role}-"
        f"{user_id.hex[:8]}"
        "-events-hunt-rbac"
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
                    (
                        "CASE ZERO "
                        f"{role.title()}"
                    ),
                    "not-used-by-rbac-test",
                    role,
                    True,
                ),
            )

    token = create_access_token(
        user_id=user_id,
        role=role,
    )

    return {
        "Authorization":
            f"Bearer {token}"
    }


def event_payload() -> dict:
    return {
        "event_type":
            "process_creation",
        "source":
            "rbac-test",
        "event_time":
            "2026-08-17T20:00:00Z",
        "hostname":
            "RBAC-HUNT-WS",
        "username":
            "rbac-user",
        "source_ip":
            "10.20.30.40",
        "destination_ip":
            None,
        "process_name":
            "cmd.exe",
        "command_line":
            "cmd.exe /c whoami",
        "raw_data": {
            "test":
                "events-hunt-rbac",
        },
    }


def create_event_as_analyst() -> dict:
    headers = create_role_headers(
        "analyst"
    )

    response = client.post(
        "/api/events",
        json=event_payload(),
        headers=headers,
    )

    assert response.status_code == 201

    return response.json()


def setup_function() -> None:
    clear_rbac_test_data()


def teardown_function() -> None:
    clear_rbac_test_data()


def test_unauthenticated_user_cannot_create_event():
    response = client.post(
        "/api/events",
        json=event_payload(),
    )

    assert response.status_code == 401


def test_viewer_cannot_create_event():
    headers = create_role_headers(
        "viewer"
    )

    response = client.post(
        "/api/events",
        json=event_payload(),
        headers=headers,
    )

    assert response.status_code == 403

    assert response.json() == {
        "detail":
            "Insufficient permissions"
    }


def test_analyst_can_create_event():
    headers = create_role_headers(
        "analyst"
    )

    response = client.post(
        "/api/events",
        json=event_payload(),
        headers=headers,
    )

    assert response.status_code == 201

    event = response.json()

    assert (
        event["source"]
        == "rbac-test"
    )

    assert (
        event["hostname"]
        == "RBAC-HUNT-WS"
    )


def test_administrator_can_create_event():
    headers = create_role_headers(
        "administrator"
    )

    response = client.post(
        "/api/events",
        json=event_payload(),
        headers=headers,
    )

    assert response.status_code == 201


def test_unauthenticated_user_cannot_hunt():
    response = client.post(
        "/api/hunt",
        json={
            "source":
                "rbac-test"
        },
    )

    assert response.status_code == 401


def test_viewer_cannot_hunt():
    viewer_headers = (
        create_role_headers(
            "viewer"
        )
    )

    response = client.post(
        "/api/hunt",
        json={
            "source":
                "rbac-test"
        },
        headers=viewer_headers,
    )

    assert response.status_code == 403

    assert response.json() == {
        "detail":
            "Insufficient permissions"
    }


def test_analyst_can_hunt_security_events():
    created_event = (
        create_event_as_analyst()
    )

    analyst_headers = (
        create_role_headers(
            "analyst"
        )
    )

    response = client.post(
        "/api/hunt",
        json={
            "source":
                "rbac-test",
            "hostname":
                "RBAC-HUNT-WS",
        },
        headers=analyst_headers,
    )

    assert response.status_code == 200

    results = response.json()

    assert len(results) == 1

    assert (
        results[0]["id"]
        == created_event["id"]
    )

    assert (
        results[0]["hostname"]
        == "RBAC-HUNT-WS"
    )


def test_administrator_can_hunt_security_events():
    created_event = (
        create_event_as_analyst()
    )

    admin_headers = (
        create_role_headers(
            "administrator"
        )
    )

    response = client.post(
        "/api/hunt",
        json={
            "source":
                "rbac-test",
            "hostname":
                "RBAC-HUNT-WS",
        },
        headers=admin_headers,
    )

    assert response.status_code == 200

    results = response.json()

    assert len(results) == 1

    assert (
        results[0]["id"]
        == created_event["id"]
    )