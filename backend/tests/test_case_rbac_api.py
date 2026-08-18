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


TEST_CASE_TITLE_PREFIX = (
    "RBAC Case"
)


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
                DELETE FROM case_notes
                WHERE case_id IN (
                    SELECT id
                    FROM cases
                    WHERE title LIKE %s
                )
                """,
                (
                    f"{TEST_CASE_TITLE_PREFIX}%",
                ),
            )

            cursor.execute(
                """
                DELETE FROM case_activities
                WHERE case_id IN (
                    SELECT id
                    FROM cases
                    WHERE title LIKE %s
                )
                """,
                (
                    f"{TEST_CASE_TITLE_PREFIX}%",
                ),
            )

            cursor.execute(
                """
                UPDATE alerts
                SET case_id = NULL
                WHERE case_id IN (
                    SELECT id
                    FROM cases
                    WHERE title LIKE %s
                )
                """,
                (
                    f"{TEST_CASE_TITLE_PREFIX}%",
                ),
            )

            cursor.execute(
                """
                DELETE FROM cases
                WHERE title LIKE %s
                """,
                (
                    f"{TEST_CASE_TITLE_PREFIX}%",
                ),
            )

            cursor.execute(
                """
                DELETE FROM users
                WHERE email LIKE %s
                """,
                (
                    "%-case-rbac"
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
        "-case-rbac"
        "@casezero.dev"
    )

    display_name = (
        "CASE ZERO "
        f"{role.title()}"
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
                    display_name,
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


def case_payload() -> dict:
    return {
        "title":
            "RBAC Case Investigation",
        "description":
            "Case created by RBAC tests.",
        "priority":
            "medium",
    }


def create_case_as_analyst() -> dict:
    headers = create_role_headers(
        "analyst"
    )

    response = client.post(
        "/api/cases",
        json=case_payload(),
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


def test_unauthenticated_case_reads_are_rejected():
    fake_case_id = (
        "00000000-0000-0000-"
        "0000-000000000001"
    )

    list_response = client.get(
        "/api/cases"
    )

    assert (
        list_response.status_code
        == 401
    )

    detail_response = client.get(
        f"/api/cases/{fake_case_id}"
    )

    assert (
        detail_response.status_code
        == 401
    )

    notes_response = client.get(
        (
            f"/api/cases/{fake_case_id}"
            "/notes"
        )
    )

    assert (
        notes_response.status_code
        == 401
    )

    activities_response = client.get(
        (
            f"/api/cases/{fake_case_id}"
            "/activities"
        )
    )

    assert (
        activities_response.status_code
        == 401
    )


def test_viewer_can_read_case_data():
    investigation_case = (
        create_case_as_analyst()
    )

    case_id = (
        investigation_case["id"]
    )

    viewer_headers = (
        create_role_headers(
            "viewer"
        )
    )

    list_response = client.get(
        "/api/cases",
        headers=viewer_headers,
    )

    assert (
        list_response.status_code
        == 200
    )

    case_ids = {
        item["id"]
        for item
        in list_response.json()
    }

    assert (
        case_id
        in case_ids
    )

    detail_response = client.get(
        f"/api/cases/{case_id}",
        headers=viewer_headers,
    )

    assert (
        detail_response.status_code
        == 200
    )

    assert (
        detail_response.json()["id"]
        == case_id
    )

    notes_response = client.get(
        f"/api/cases/{case_id}/notes",
        headers=viewer_headers,
    )

    assert (
        notes_response.status_code
        == 200
    )

    assert (
        notes_response.json()
        == []
    )

    activities_response = client.get(
        (
            f"/api/cases/{case_id}"
            "/activities"
        ),
        headers=viewer_headers,
    )

    assert (
        activities_response.status_code
        == 200
    )

    activities = (
        activities_response.json()
    )

    assert (
        len(activities)
        == 1
    )

    assert (
        activities[0]["event_type"]
        == "case_created"
    )


def test_unauthenticated_user_cannot_create_case():
    response = client.post(
        "/api/cases",
        json=case_payload(),
    )

    assert (
        response.status_code
        == 401
    )


def test_viewer_cannot_create_case():
    headers = create_role_headers(
        "viewer"
    )

    response = client.post(
        "/api/cases",
        json=case_payload(),
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


def test_analyst_can_create_case():
    headers = create_role_headers(
        "analyst"
    )

    response = client.post(
        "/api/cases",
        json=case_payload(),
        headers=headers,
    )

    assert (
        response.status_code
        == 201
    )

    investigation_case = (
        response.json()
    )

    assert (
        investigation_case["title"]
        == "RBAC Case Investigation"
    )

    assert (
        investigation_case["status"]
        == "open"
    )


def test_administrator_can_create_case():
    headers = create_role_headers(
        "administrator"
    )

    response = client.post(
        "/api/cases",
        json=case_payload(),
        headers=headers,
    )

    assert (
        response.status_code
        == 201
    )


def test_viewer_cannot_update_case():
    investigation_case = (
        create_case_as_analyst()
    )

    viewer_headers = (
        create_role_headers(
            "viewer"
        )
    )

    response = client.patch(
        (
            "/api/cases/"
            f"{investigation_case['id']}"
        ),
        json={
            "status":
                "investigating"
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


def test_viewer_cannot_add_case_note():
    investigation_case = (
        create_case_as_analyst()
    )

    viewer_headers = (
        create_role_headers(
            "viewer"
        )
    )

    response = client.post(
        (
            "/api/cases/"
            f"{investigation_case['id']}"
            "/notes"
        ),
        json={
            "content":
                "Viewer should not "
                "be able to add this."
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


def test_case_activity_records_authenticated_actor():
    analyst_headers = (
        create_role_headers(
            "analyst"
        )
    )

    response = client.post(
        "/api/cases",
        json=case_payload(),
        headers=analyst_headers,
    )

    assert (
        response.status_code
        == 201
    )

    case_id = (
        response.json()["id"]
    )

    activity_response = client.get(
        (
            f"/api/cases/{case_id}"
            "/activities"
        ),
        headers=analyst_headers,
    )

    assert (
        activity_response.status_code
        == 200
    )

    activities = (
        activity_response.json()
    )

    assert (
        len(activities)
        == 1
    )

    assert (
        activities[0]["event_type"]
        == "case_created"
    )

    assert (
        activities[0]["actor"]
        == "CASE ZERO Analyst"
    )


def test_case_note_records_authenticated_author():
    analyst_headers = (
        create_role_headers(
            "analyst"
        )
    )

    case_response = client.post(
        "/api/cases",
        json=case_payload(),
        headers=analyst_headers,
    )

    assert (
        case_response.status_code
        == 201
    )

    case_id = (
        case_response.json()["id"]
    )

    note_response = client.post(
        f"/api/cases/{case_id}/notes",
        json={
            "content":
                "Authenticated analyst note."
        },
        headers=analyst_headers,
    )

    assert (
        note_response.status_code
        == 201
    )

    note = (
        note_response.json()
    )

    assert (
        note["author"]
        == "CASE ZERO Analyst"
    )

    assert (
        note["content"]
        == (
            "Authenticated "
            "analyst note."
        )
    )