import asyncio
import selectors
import sys
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import psycopg
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.api.routes import events as event_routes
from app.config import (
    POSTGRES_DB,
    POSTGRES_HOST,
    POSTGRES_PASSWORD,
    POSTGRES_PORT,
    POSTGRES_USER,
)
from app.main import app
from app.models.security_event import SecurityEvent
from app.security import create_access_token


def create_selector_event_loop():
    return asyncio.SelectorEventLoop(
        selectors.SelectSelector()
    )


def create_test_client(*, raise_server_exceptions: bool = True) -> TestClient:
    backend_options = {}

    if sys.platform == "win32":
        backend_options[
            "loop_factory"
        ] = create_selector_event_loop

    return TestClient(
        app,
        backend="asyncio",
        backend_options=backend_options,
        raise_server_exceptions=raise_server_exceptions,
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


def create_analyst_headers(user_id: UUID | None = None) -> dict[str, str]:
    assert POSTGRES_DB == "casezero_test"

    user_id = user_id or uuid4()

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


@pytest.fixture
def legacy_pipeline_cleanup():
    clear_event_pipeline_data()
    try:
        yield
    finally:
        clear_event_pipeline_data()


def test_encoded_powershell_event_creates_persisted_alert(legacy_pipeline_cleanup):
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
        f"/api/events/{event_id}",
        headers=analyst_headers,
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
        "/api/alerts",
        headers=analyst_headers,
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


def test_benign_powershell_event_does_not_create_alert(legacy_pipeline_cleanup):
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
        f"/api/events/{event_id}",
        headers=analyst_headers,
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
        "/api/alerts",
        headers=analyst_headers,
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


def test_fifth_authentication_failure_creates_brute_force_alert(legacy_pipeline_cleanup):
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

        if index < 5:
            alerts_response = client.get(
                "/api/alerts",
                headers=analyst_headers,
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
        "/api/alerts",
        headers=analyst_headers,
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
        "/api/events",
        headers=analyst_headers,
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


@pytest.fixture
def detection_scenario():
    assert POSTGRES_DB == "casezero_test"
    user_id = uuid4()
    source = f"pytest-detection-{user_id.hex}"
    with psycopg.connect(
        dbname=POSTGRES_DB,
        user=POSTGRES_USER,
        password=POSTGRES_PASSWORD,
        host=POSTGRES_HOST,
        port=POSTGRES_PORT,
        autocommit=True,
    ) as observer:
        try:
            yield source, create_analyst_headers(user_id), observer
        finally:
            with observer.transaction():
                observer.execute(
                    """DELETE FROM alerts USING security_events
                       WHERE alerts.source_event_id = security_events.id
                       AND security_events.source = %s""",
                    (source,),
                )
                observer.execute("DELETE FROM security_events WHERE source = %s", (source,))
                observer.execute("DELETE FROM users WHERE id = %s", (user_id,))


def authentication_payload(source, event_time):
    return {
        "event_type": "authentication",
        "source": source,
        "event_time": event_time.isoformat(),
        "hostname": "TEST-AUTH-HOST",
        "username": source,
        "source_ip": "203.0.113.99",
        "raw_data": {"outcome": "failure"},
    }


def scenario_alerts(observer, source):
    return observer.execute(
        """SELECT alerts.source_event_id, alerts.detection_rule_id, alerts.description
           FROM alerts JOIN security_events ON alerts.source_event_id = security_events.id
           WHERE security_events.source = %s""",
        (source,),
    ).fetchall()


@pytest.mark.parametrize(
    ("extra_rows", "expected_match"),
    [
        pytest.param([], False, id="four"),
        pytest.param([(-300, {})], True, id="five-inclusive-lower-bound"),
        pytest.param([(-300.000001, {})], False, id="outside-lower-bound"),
        pytest.param([(1, {})], False, id="future-event"),
        pytest.param([(-1, {"username": "different-user"})], False, id="wrong-user"),
        pytest.param([(-1, {"source_ip": "203.0.113.100"})], False, id="wrong-ip"),
        pytest.param([(-1, {"raw_data": {"outcome": "success"}})], False, id="success"),
        pytest.param(
            [(-1, {"raw_data": {"outcome": "success"}}), (-300, {})],
            True,
            id="success-does-not-reset-count",
        ),
        pytest.param([(-20, {}), (-20, {})], False, id="six-qualifying-failures"),
    ],
)
def test_authentication_correlation_filters_postgresql_history(
    detection_scenario, extra_rows, expected_match
):
    source, headers, observer = detection_scenario
    trigger_time = datetime(2026, 8, 16, 12, tzinfo=timezone.utc)

    # Seed history directly so only the incoming event can generate an alert.
    with observer.transaction():
        for offset, overrides in [(-180, {}), (-120, {}), (-60, {}), *extra_rows]:
            event_time = trigger_time + timedelta(seconds=offset)
            payload = authentication_payload(source, event_time)
            payload.update(overrides)
            observer.execute(
                """INSERT INTO security_events
                       (id, event_type, source, event_time, username, source_ip, raw_data)
                   VALUES (%s, %s, %s, %s, %s, %s, json_build_object('outcome', %s::text))""",
                (
                    uuid4(), payload["event_type"], source, event_time,
                    payload["username"], payload["source_ip"], payload["raw_data"]["outcome"],
                ),
            )

    response = client.post(
        "/api/events", json=authentication_payload(source, trigger_time), headers=headers
    )
    assert response.status_code == 201, response.text
    alerts = scenario_alerts(observer, source)
    if expected_match:
        trigger_id = UUID(response.json()["id"])
        assert alerts == [(
            trigger_id,
            "auth-brute-force",
            "CASE//ZERO correlated repeated authentication failures. "
            "5 failed authentication attempts were observed within 5 minutes "
            f"for user {source} from source IP 203.0.113.99. "
            f"Host: TEST-AUTH-HOST. Triggering Security Event ID: {trigger_id}.",
        )]
    else:
        assert alerts == []


def test_equal_timestamp_duplicate_records_count_separately(detection_scenario):
    source, headers, observer = detection_scenario
    payload = authentication_payload(source, datetime(2026, 8, 16, 12, tzinfo=timezone.utc))
    event_ids = []
    for _ in range(6):
        response = client.post("/api/events", json=payload, headers=headers)
        assert response.status_code == 201, response.text
        event_ids.append(UUID(response.json()["id"]))

    assert len(set(event_ids)) == 6
    assert [(event_id, rule) for event_id, rule, _ in scenario_alerts(observer, source)] == [
        (event_ids[4], "auth-brute-force")
    ]


def test_late_authentication_does_not_reevaluate_prior_events(detection_scenario):
    source, headers, observer = detection_scenario
    start = datetime(2026, 8, 16, 12, tzinfo=timezone.utc)
    for minute in (1, 2, 3, 4, 0):
        response = client.post(
            "/api/events",
            json=authentication_payload(source, start + timedelta(minutes=minute)),
            headers=headers,
        )
        assert response.status_code == 201, response.text

    # The late row would have completed the window at minute four if present then.
    assert scenario_alerts(observer, source) == []


def test_ingest_rolls_back_when_evaluation_fails_after_flush(detection_scenario, monkeypatch):
    source, headers, observer = detection_scenario
    evaluate = event_routes.evaluate_security_event
    flushed_ids = []

    async def fail_during_evaluation(event, session):
        with session.no_autoflush:
            event_id = await session.scalar(
                select(SecurityEvent.id).where(SecurityEvent.source == source)
            )
        assert event_id is not None and event_id == event.id
        alerts = await evaluate(event, session)
        assert len(alerts) == 1
        # Stage a real generated alert before failing to exercise rollback of both rows.
        session.add_all(alerts)
        await session.flush()
        flushed_ids.extend((event_id, alerts[0].id))
        raise RuntimeError("injected detection failure")

    monkeypatch.setattr(event_routes, "evaluate_security_event", fail_during_evaluation)
    failure_client = create_test_client(raise_server_exceptions=False)
    with failure_client:
        response = failure_client.post(
            "/api/events",
            json={
                "event_type": "process_creation",
                "source": source,
                "event_time": "2026-08-16T12:00:00Z",
                "process_name": "powershell.exe",
                "command_line": "powershell.exe -enc TEST",
            },
            headers=headers,
        )
    assert response.status_code == 500
    event_id, alert_id = flushed_ids
    assert event_id is not None and alert_id is not None
    persisted_event = observer.execute(
        "SELECT id FROM security_events WHERE id = %s", (event_id,)
    ).fetchone()
    assert persisted_event is None
    assert observer.execute("SELECT id FROM alerts WHERE id = %s", (alert_id,)).fetchone() is None
