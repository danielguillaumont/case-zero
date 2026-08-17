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
                DELETE FROM alerts
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
                    "%-alert-rbac"
                    "@casezero.dev",
                ),
            )


def create_role_headers(
    role: str,
) -> dict[str, str]:
    assert (
        POSTGRES_DB
        == "casezero_test"
    )

    user_id = uuid4()

    email = (
        f"{role}-alert-rbac"
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


def alert_payload() -> dict:
    return {
        "title":
            "RBAC Integration Alert",
        "description":
            "Alert created by RBAC tests.",
        "severity":
            "medium",
        "source":
            "rbac-test",
    }


def setup_function() -> None:
    clear_rbac_test_data()


def teardown_function() -> None:
    clear_rbac_test_data()


def test_unauthenticated_user_cannot_create_alert():
    response = client.post(
        "/api/alerts",
        json=alert_payload(),
    )

    assert response.status_code == 401


def test_viewer_cannot_create_alert():
    headers = create_role_headers(
        "viewer"
    )

    response = client.post(
        "/api/alerts",
        json=alert_payload(),
        headers=headers,
    )

    assert response.status_code == 403

    assert response.json() == {
        "detail":
            "Insufficient permissions"
    }


def test_analyst_can_create_alert():
    headers = create_role_headers(
        "analyst"
    )

    response = client.post(
        "/api/alerts",
        json=alert_payload(),
        headers=headers,
    )

    assert response.status_code == 201

    alert = response.json()

    assert (
        alert["title"]
        == "RBAC Integration Alert"
    )

    assert (
        alert["source"]
        == "rbac-test"
    )


def test_administrator_can_create_alert():
    headers = create_role_headers(
        "administrator"
    )

    response = client.post(
        "/api/alerts",
        json=alert_payload(),
        headers=headers,
    )

    assert response.status_code == 201


def test_viewer_cannot_update_alert():
    analyst_headers = (
        create_role_headers(
            "analyst"
        )
    )

    create_response = client.post(
        "/api/alerts",
        json=alert_payload(),
        headers=analyst_headers,
    )

    assert (
        create_response.status_code
        == 201
    )

    alert_id = (
        create_response.json()["id"]
    )

    viewer_headers = (
        create_role_headers(
            "viewer"
        )
    )

    response = client.patch(
        f"/api/alerts/{alert_id}",
        json={
            "status":
                "investigating"
        },
        headers=viewer_headers,
    )

    assert response.status_code == 403

    assert response.json() == {
        "detail":
            "Insufficient permissions"
    }


def test_viewer_cannot_create_case_from_alert():
    analyst_headers = (
        create_role_headers(
            "analyst"
        )
    )

    create_response = client.post(
        "/api/alerts",
        json=alert_payload(),
        headers=analyst_headers,
    )

    assert (
        create_response.status_code
        == 201
    )

    alert_id = (
        create_response.json()["id"]
    )

    viewer_headers = (
        create_role_headers(
            "viewer"
        )
    )

    response = client.post(
        f"/api/alerts/{alert_id}/case",
        headers=viewer_headers,
    )

    assert response.status_code == 403

    assert response.json() == {
        "detail":
            "Insufficient permissions"
    }