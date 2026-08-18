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
                DELETE FROM threat_indicators
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
                    "%-intelligence-rbac"
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
        f"{role}-"
        f"{user_id.hex[:8]}"
        "-intelligence-rbac"
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


def indicator_payload() -> dict:
    return {
        "indicator_type":
            "ip",
        "value":
            "198.51.100.77",
        "reputation":
            "suspicious",
        "confidence":
            75,
        "source":
            "rbac-test",
        "description":
            "IOC created by RBAC tests.",
        "tags": [
            "rbac",
            "integration-test",
        ],
    }


def create_indicator_as_analyst() -> dict:
    headers = create_role_headers(
        "analyst"
    )

    response = client.post(
        "/api/intelligence",
        json=indicator_payload(),
        headers=headers,
    )

    assert (
        response.status_code
        == 201
    )

    return response.json()


def setup_function() -> None:
    clear_rbac_test_data()


def teardown_function() -> None:
    clear_rbac_test_data()


def test_unauthenticated_indicator_reads_are_rejected():
    list_response = client.get(
        "/api/intelligence"
    )

    assert (
        list_response.status_code
        == 401
    )

    detail_response = client.get(
        (
            "/api/intelligence/"
            "00000000-0000-0000-"
            "0000-000000000001"
        )
    )

    assert (
        detail_response.status_code
        == 401
    )


def test_viewer_can_read_indicator_list_and_detail():
    indicator = (
        create_indicator_as_analyst()
    )

    viewer_headers = (
        create_role_headers(
            "viewer"
        )
    )

    list_response = client.get(
        "/api/intelligence",
        headers=viewer_headers,
    )

    assert (
        list_response.status_code
        == 200
    )

    indicator_ids = {
        item["id"]
        for item
        in list_response.json()
    }

    assert (
        indicator["id"]
        in indicator_ids
    )

    detail_response = client.get(
        (
            "/api/intelligence/"
            f"{indicator['id']}"
        ),
        headers=viewer_headers,
    )

    assert (
        detail_response.status_code
        == 200
    )

    detail = (
        detail_response.json()
    )

    assert (
        detail["id"]
        == indicator["id"]
    )

    assert (
        detail["value"]
        == "198.51.100.77"
    )

    assert (
        detail["source"]
        == "rbac-test"
    )


def test_unauthenticated_user_cannot_create_indicator():
    response = client.post(
        "/api/intelligence",
        json=indicator_payload(),
    )

    assert (
        response.status_code
        == 401
    )


def test_viewer_cannot_create_indicator():
    headers = create_role_headers(
        "viewer"
    )

    response = client.post(
        "/api/intelligence",
        json=indicator_payload(),
        headers=headers,
    )

    assert (
        response.status_code
        == 403
    )

    assert response.json() == {
        "detail":
            "Insufficient permissions"
    }


def test_analyst_can_create_indicator():
    headers = create_role_headers(
        "analyst"
    )

    response = client.post(
        "/api/intelligence",
        json=indicator_payload(),
        headers=headers,
    )

    assert (
        response.status_code
        == 201
    )

    indicator = response.json()

    assert (
        indicator["value"]
        == "198.51.100.77"
    )

    assert (
        indicator["source"]
        == "rbac-test"
    )

    assert (
        indicator["reputation"]
        == "suspicious"
    )


def test_administrator_can_create_indicator():
    headers = create_role_headers(
        "administrator"
    )

    response = client.post(
        "/api/intelligence",
        json=indicator_payload(),
        headers=headers,
    )

    assert (
        response.status_code
        == 201
    )


def test_viewer_cannot_update_indicator():
    indicator = (
        create_indicator_as_analyst()
    )

    viewer_headers = (
        create_role_headers(
            "viewer"
        )
    )

    response = client.patch(
        (
            "/api/intelligence/"
            f"{indicator['id']}"
        ),
        json={
            "reputation":
                "malicious",
            "confidence":
                95,
        },
        headers=viewer_headers,
    )

    assert (
        response.status_code
        == 403
    )

    assert response.json() == {
        "detail":
            "Insufficient permissions"
    }


def test_analyst_can_update_indicator():
    indicator = (
        create_indicator_as_analyst()
    )

    analyst_headers = (
        create_role_headers(
            "analyst"
        )
    )

    response = client.patch(
        (
            "/api/intelligence/"
            f"{indicator['id']}"
        ),
        json={
            "reputation":
                "malicious",
            "confidence":
                95,
        },
        headers=analyst_headers,
    )

    assert (
        response.status_code
        == 200
    )

    updated_indicator = (
        response.json()
    )

    assert (
        updated_indicator["reputation"]
        == "malicious"
    )

    assert (
        updated_indicator["confidence"]
        == 95
    )