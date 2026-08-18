import asyncio
import selectors
import sys
from uuid import (
    uuid4,
)

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


def clear_event_read_test_data() -> None:
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
                WHERE source_event_id IN (
                    SELECT id
                    FROM security_events
                    WHERE source = %s
                )
                """,
                ("event-read-rbac",),
            )

            cursor.execute(
                """
                DELETE FROM security_events
                WHERE source = %s
                """,
                ("event-read-rbac",),
            )

            cursor.execute(
                """
                DELETE FROM users
                WHERE email LIKE %s
                """,
                (
                    "%-event-read-rbac"
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
        "-event-read-rbac"
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
                    "not-used-by-event-read-test",
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
            "event-read-rbac",
        "event_time":
            "2026-08-17T21:00:00Z",
        "hostname":
            "EVENT-READ-RBAC-WS",
        "username":
            "read-test-user",
        "source_ip":
            "10.50.60.70",
        "destination_ip":
            None,
        "process_name":
            "cmd.exe",
        "command_line":
            "cmd.exe /c hostname",
        "raw_data": {
            "test":
                "event-read-rbac",
        },
    }


def setup_function() -> None:
    clear_event_read_test_data()


def teardown_function() -> None:
    clear_event_read_test_data()


def test_unauthenticated_event_reads_are_rejected():
    list_response = client.get(
        "/api/events"
    )

    assert (
        list_response.status_code
        == 401
    )

    detail_response = client.get(
        (
            "/api/events/"
            "00000000-0000-0000-"
            "0000-000000000001"
        )
    )

    assert (
        detail_response.status_code
        == 401
    )


def test_viewer_can_read_event_list_and_detail():
    analyst_headers = (
        create_role_headers(
            "analyst"
        )
    )

    create_response = client.post(
        "/api/events",
        json=event_payload(),
        headers=analyst_headers,
    )

    assert (
        create_response.status_code
        == 201
    )

    event = (
        create_response.json()
    )

    viewer_headers = (
        create_role_headers(
            "viewer"
        )
    )

    list_response = client.get(
        "/api/events",
        headers=viewer_headers,
    )

    assert (
        list_response.status_code
        == 200
    )

    event_ids = {
        item["id"]
        for item
        in list_response.json()
    }

    assert (
        event["id"]
        in event_ids
    )

    detail_response = client.get(
        f"/api/events/{event['id']}",
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
        == event["id"]
    )

    assert (
        detail["source"]
        == "event-read-rbac"
    )