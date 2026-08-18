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


def clear_event_pipeline_data() -> None:
    # Safety guard: these integration tests are
    # allowed to delete data only from the
    # dedicated CASE//ZERO test database.
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
                "DELETE FROM alerts"
            )

            cursor.execute(
                "DELETE FROM security_events"
            )

            cursor.execute(
                """
                DELETE FROM users
                WHERE email LIKE %s
                """,
                (
                    "%-event-pipeline"
                    "@casezero.dev",
                ),
            )


def create_analyst_headers() -> dict[str, str]:
    assert POSTGRES_DB == "casezero_test"

    user_id = uuid4()

    email = (
        "analyst-"
        f"{user_id.hex[:8]}"
        "-event-pipeline"
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
                    "Pipeline Test Analyst",
                    "not-used-by-pipeline-test",
                    "analyst",
                    True,
                ),
            )

    token = create_access_token(
        user_id=user_id,
        role="analyst",
    )

    return {
        "Authorization":
            f"Bearer {token}"
    }


def setup_function() -> None:
    clear_event_pipeline_data()


def teardown_function() -> None:
    clear_event_pipeline_data()


def test_encoded_powershell_event_creates_persisted_alert():
    analyst_headers = (
        create_analyst_headers()
    )

    event_payload = {
        "event_type":
            "process_creation",
        "source":
            "pytest-integration",
        "event_time":
            "2026-08-16T22:30:00Z",
        "hostname":
            "TEST-INTEGRATION-WS",
        "username":
            "integration-user",
        "source_ip":
            "10.10.50.25",
        "destination_ip":
            None,
        "process_name":
            "powershell.exe",
        "command_line":
            (
                "powershell.exe "
                "-enc SQBFAFgA"
            ),
        "raw_data": {
            "test":
                "database-integration",
        },
    }

    event_response = client.post(
        "/api/events",
        json=event_payload,
        headers=analyst_headers,
    )

    assert (
        event_response.status_code
        == 201
    )

    event = event_response.json()

    assert (
        event["event_type"]
        == "process_creation"
    )

    assert (
        event["hostname"]
        == "TEST-INTEGRATION-WS"
    )

    event_id = event["id"]

    event_detail_response = client.get(
        f"/api/events/{event_id}"
    )

    assert (
        event_detail_response.status_code
        == 200
    )

    persisted_event = (
        event_detail_response.json()
    )

    assert (
        persisted_event["id"]
        == event_id
    )

    alerts_response = client.get(
        "/api/alerts"
    )

    assert (
        alerts_response.status_code
        == 200
    )

    alerts = alerts_response.json()

    linked_alerts = [
        alert
        for alert in alerts
        if (
            alert["source_event_id"]
            == event_id
        )
    ]

    assert len(linked_alerts) == 1

    alert = linked_alerts[0]

    assert (
        alert["title"]
        == "Encoded PowerShell Command Detected"
    )

    assert (
        alert["severity"]
        == "high"
    )

    assert (
        alert["status"]
        == "new"
    )

    assert (
        alert["source"]
        == "detection-engine"
    )

    assert (
        alert["detection_rule_id"]
        == "encoded-powershell"
    )

    assert (
        alert["source_event_id"]
        == event_id
    )


def test_benign_powershell_event_does_not_create_alert():
    analyst_headers = (
        create_analyst_headers()
    )

    event_payload = {
        "event_type":
            "process_creation",
        "source":
            "pytest-integration",
        "event_time":
            "2026-08-16T22:31:00Z",
        "hostname":
            "TEST-BENIGN-WS",
        "username":
            "integration-user",
        "source_ip":
            "10.10.50.26",
        "destination_ip":
            None,
        "process_name":
            "powershell.exe",
        "command_line":
            (
                "powershell.exe "
                "Get-Service"
            ),
        "raw_data": {
            "test":
                "benign-database-integration",
        },
    }

    event_response = client.post(
        "/api/events",
        json=event_payload,
        headers=analyst_headers,
    )

    assert (
        event_response.status_code
        == 201
    )

    event = event_response.json()

    event_id = event["id"]

    event_detail_response = client.get(
        f"/api/events/{event_id}"
    )

    assert (
        event_detail_response.status_code
        == 200
    )

    persisted_event = (
        event_detail_response.json()
    )

    assert (
        persisted_event["id"]
        == event_id
    )

    assert (
        persisted_event["command_line"]
        == "powershell.exe Get-Service"
    )

    alerts_response = client.get(
        "/api/alerts"
    )

    assert (
        alerts_response.status_code
        == 200
    )

    alerts = alerts_response.json()

    linked_alerts = [
        alert
        for alert in alerts
        if (
            alert["source_event_id"]
            == event_id
        )
    ]

    assert linked_alerts == []


def test_fifth_authentication_failure_creates_brute_force_alert():
    analyst_headers = (
        create_analyst_headers()
    )

    event_times = [
        "2026-08-16T22:40:00Z",
        "2026-08-16T22:41:00Z",
        "2026-08-16T22:42:00Z",
        "2026-08-16T22:43:00Z",
        "2026-08-16T22:44:00Z",
    ]

    created_events = []

    for index, event_time in enumerate(
        event_times,
        start=1,
    ):
        event_payload = {
            "event_type":
                "authentication",
            "source":
                "pytest-integration",
            "event_time":
                event_time,
            "hostname":
                "TEST-INTEGRATION-DC",
            "username":
                "bruteforce-integration",
            "source_ip":
                "203.0.113.99",
            "destination_ip":
                None,
            "process_name":
                None,
            "command_line":
                None,
            "raw_data": {
                "outcome":
                    "failure",
                "authentication_method":
                    "password",
                "test_sequence":
                    index,
            },
        }

        event_response = client.post(
            "/api/events",
            json=event_payload,
            headers=analyst_headers,
        )

        assert (
            event_response.status_code
            == 201
        )

        created_events.append(
            event_response.json()
        )

        # The first four failures must not
        # generate a brute-force alert.
        if index < 5:
            alerts_response = client.get(
                "/api/alerts"
            )

            assert (
                alerts_response.status_code
                == 200
            )

            assert (
                alerts_response.json()
                == []
            )

    assert len(created_events) == 5

    triggering_event = (
        created_events[-1]
    )

    alerts_response = client.get(
        "/api/alerts"
    )

    assert (
        alerts_response.status_code
        == 200
    )

    alerts = alerts_response.json()

    assert len(alerts) == 1

    alert = alerts[0]

    assert (
        alert["title"]
        == "Possible Brute Force Attack"
    )

    assert (
        alert["severity"]
        == "high"
    )

    assert (
        alert["status"]
        == "new"
    )

    assert (
        alert["source"]
        == "detection-engine"
    )

    assert (
        alert["detection_rule_id"]
        == "auth-brute-force"
    )

    assert (
        alert["source_event_id"]
        == triggering_event["id"]
    )

    assert (
        "5 failed authentication attempts"
        in alert["description"]
    )

    events_response = client.get(
        "/api/events"
    )

    assert (
        events_response.status_code
        == 200
    )

    authentication_events = [
        event
        for event in events_response.json()
        if (
            event["username"]
            == "bruteforce-integration"
        )
    ]

    assert (
        len(authentication_events)
        == 5
    )