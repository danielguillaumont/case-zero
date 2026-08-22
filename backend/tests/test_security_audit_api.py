import asyncio
import json
import selectors
import sys
from uuid import uuid4

import psycopg
from fastapi.testclient import (
    TestClient,
)

from app.config import (
    LOGIN_THROTTLE_MAX_FAILURES,
    POSTGRES_DB,
    POSTGRES_HOST,
    POSTGRES_PASSWORD,
    POSTGRES_PORT,
    POSTGRES_USER,
)
from app.main import app
from app.security import (
    create_access_token,
    hash_password,
)
from app.services.login_throttle import (
    hash_login_identity,
)


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


def clear_audit_test_data():
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
                DELETE FROM security_audit_events
                """
            )

            cursor.execute(
                """
                DELETE FROM login_throttles
                """
            )

            cursor.execute(
                """
                DELETE FROM users
                WHERE email LIKE %s
                """,
                (
                    "%@audit.casezero.dev",
                ),
            )


def create_audit_test_user(
    *,
    email: str,
    password: str,
    role: str = "analyst",
    is_active: bool = True,
):
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
                    (
                        "CASE ZERO "
                        "Audit Test User"
                    ),
                    password_hash,
                    role,
                    is_active,
                ),
            )

    return user_id


def get_audit_events(
    event_type: str,
):
    with psycopg.connect(
        dbname=POSTGRES_DB,
        user=POSTGRES_USER,
        password=POSTGRES_PASSWORD,
        host=POSTGRES_HOST,
        port=POSTGRES_PORT,
    ) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    event_type,
                    outcome,
                    severity,
                    user_id,
                    identity_hash,
                    request_method,
                    request_path,
                    source_ip,
                    details
                FROM security_audit_events
                WHERE event_type = %s
                ORDER BY created_at ASC
                """,
                (
                    event_type,
                ),
            )

            return cursor.fetchall()


def setup_function():
    clear_audit_test_data()


def teardown_function():
    clear_audit_test_data()


def test_successful_login_is_audited():
    email = (
        "success@audit.casezero.dev"
    )

    password = (
        "Audit-Success-Password-2026!"
    )

    user_id = create_audit_test_user(
        email=email,
        password=password,
    )

    response = client.post(
        "/api/auth/login",
        data={
            "username": email,
            "password": password,
        },
    )

    assert (
        response.status_code
        == 200
    )

    events = get_audit_events(
        "auth.login_success"
    )

    assert len(events) == 1

    event = events[0]

    assert event[1] == "success"
    assert event[2] == "info"

    assert (
        str(event[3])
        == str(user_id)
    )

    assert (
        event[4]
        == hash_login_identity(
            email
        )
    )

    assert event[5] == "POST"

    assert (
        event[6]
        == "/api/auth/login"
    )

    assert event[7] is not None

    assert event[8] == {
        "role": "analyst",
    }


def test_failed_login_is_audited():
    email = (
        "failure@audit.casezero.dev"
    )

    create_audit_test_user(
        email=email,
        password=(
            "Correct-Password-2026!"
        ),
    )

    response = client.post(
        "/api/auth/login",
        data={
            "username": email,
            "password":
                "Wrong-Password-2026!",
        },
    )

    assert (
        response.status_code
        == 401
    )

    events = get_audit_events(
        "auth.login_failure"
    )

    assert len(events) == 1

    event = events[0]

    assert event[1] == "failure"
    assert event[2] == "warning"

    assert (
        event[4]
        == hash_login_identity(
            email
        )
    )


def test_unknown_identity_is_audited_without_email():
    email = (
        "unknown@audit.casezero.dev"
    )

    response = client.post(
        "/api/auth/login",
        data={
            "username": email,
            "password":
                "Wrong-Password-2026!",
        },
    )

    assert (
        response.status_code
        == 401
    )

    events = get_audit_events(
        "auth.login_failure"
    )

    assert len(events) == 1

    event = events[0]

    assert event[3] is None

    assert (
        event[4]
        == hash_login_identity(
            email
        )
    )

    serialized_event = json.dumps(
        event,
        default=str,
    )

    assert (
        email
        not in serialized_event
    )


def test_throttled_login_is_audited():
    email = (
        "throttle@audit.casezero.dev"
    )

    create_audit_test_user(
        email=email,
        password=(
            "Correct-Password-2026!"
        ),
    )

    response = None

    for _ in range(
        LOGIN_THROTTLE_MAX_FAILURES
    ):
        response = client.post(
            "/api/auth/login",
            data={
                "username": email,
                "password":
                    "Wrong-Password-2026!",
            },
        )

    assert response is not None

    assert (
        response.status_code
        == 429
    )

    events = get_audit_events(
        "auth.login_throttled"
    )

    assert len(events) == 1

    event = events[0]

    assert event[1] == "throttled"
    assert event[2] == "high"

    assert (
        event[8][
            "retry_after_seconds"
        ]
        > 0
    )


def test_invalid_token_is_audited_without_token():
    invalid_token = (
        "definitely-not-a-valid-token"
    )

    response = client.get(
        "/api/auth/me",
        headers={
            "Authorization":
                f"Bearer {invalid_token}"
        },
    )

    assert (
        response.status_code
        == 401
    )

    events = get_audit_events(
        "auth.invalid_token"
    )

    assert len(events) == 1

    event = events[0]

    assert event[1] == "failure"
    assert event[2] == "warning"

    assert event[8] == {
        "reason":
            "token_validation_failed",
    }

    serialized_event = json.dumps(
        event,
        default=str,
    )

    assert (
        invalid_token
        not in serialized_event
    )


def test_inactive_session_is_audited():
    email = (
        "inactive@audit.casezero.dev"
    )

    user_id = create_audit_test_user(
        email=email,
        password=(
            "Inactive-Password-2026!"
        ),
        is_active=False,
    )

    token = create_access_token(
        user_id=user_id,
        role="analyst",
    )

    response = client.get(
        "/api/auth/me",
        headers={
            "Authorization":
                f"Bearer {token}"
        },
    )

    assert (
        response.status_code
        == 403
    )

    events = get_audit_events(
        "auth.inactive_session"
    )

    assert len(events) == 1

    event = events[0]

    assert event[1] == "denied"

    assert (
        str(event[3])
        == str(user_id)
    )

    serialized_event = json.dumps(
        event,
        default=str,
    )

    assert token not in serialized_event


def test_viewer_denial_is_persisted_as_rbac_audit_event():
    email = (
        "viewer-rbac@audit.casezero.dev"
    )

    user_id = create_audit_test_user(
        email=email,
        password=(
            "Viewer-Password-2026!"
        ),
        role="viewer",
    )

    token = create_access_token(
        user_id=user_id,
        role="viewer",
    )

    response = client.post(
        "/api/hunt",
        headers={
            "Authorization":
                f"Bearer {token}"
        },
        json={},
    )

    assert (
        response.status_code
        == 403
    )

    assert response.json() == {
        "detail":
            "Insufficient permissions"
    }

    events = get_audit_events(
        "rbac.access_denied"
    )

    assert len(events) == 1

    event = events[0]

    assert event[1] == "denied"
    assert event[2] == "warning"

    assert (
        str(event[3])
        == str(user_id)
    )

    assert event[5] == "POST"

    assert (
        event[6]
        == "/api/hunt"
    )

    details = event[8]

    assert (
        details["current_role"]
        == "viewer"
    )

    assert set(
        details["allowed_roles"]
    ) == {
        "administrator",
        "analyst",
    }

    serialized_event = json.dumps(
        event,
        default=str,
    )

    assert token not in serialized_event