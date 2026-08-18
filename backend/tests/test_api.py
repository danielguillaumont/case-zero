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


def clear_read_api_test_users() -> None:
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
                    "%-read-api"
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
        "-read-api"
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
                    "not-used-by-read-api-test",
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


def setup_function() -> None:
    clear_read_api_test_users()


def teardown_function() -> None:
    clear_read_api_test_users()


def test_root_endpoint():
    response = client.get("/")

    assert response.status_code == 200

    data = response.json()

    assert data["name"] == "CASE//ZERO"

    assert (
        data["message"]
        == (
            "Security Operations "
            "Platform API"
        )
    )


def test_unauthenticated_rules_are_rejected():
    response = client.get(
        "/api/rules"
    )

    assert response.status_code == 401


def test_detection_rules_endpoint():
    headers = create_role_headers(
        "viewer"
    )

    response = client.get(
        "/api/rules",
        headers=headers,
    )

    assert response.status_code == 200

    rules = response.json()

    assert len(rules) == 3

    rule_ids = {
        rule["id"]
        for rule in rules
    }

    assert (
        "encoded-powershell"
        in rule_ids
    )

    assert (
        "powershell-download-cradle"
        in rule_ids
    )

    assert (
        "auth-brute-force"
        in rule_ids
    )


def test_encoded_powershell_rule_endpoint():
    headers = create_role_headers(
        "viewer"
    )

    response = client.get(
        "/api/rules/encoded-powershell",
        headers=headers,
    )

    assert response.status_code == 200

    rule = response.json()

    assert (
        rule["id"]
        == "encoded-powershell"
    )

    assert (
        rule["severity"]
        == "high"
    )

    assert (
        rule["rule_type"]
        == "single_event"
    )

    assert (
        rule["event_type"]
        == "process_creation"
    )

    assert (
        rule["mitre_attack"][0][
            "technique_id"
        ]
        == "T1059.001"
    )


def test_unknown_rule_returns_404():
    headers = create_role_headers(
        "viewer"
    )

    response = client.get(
        "/api/rules/not-a-real-rule",
        headers=headers,
    )

    assert response.status_code == 404


def test_unauthenticated_playbooks_are_rejected():
    response = client.get(
        "/api/playbooks"
    )

    assert response.status_code == 401


def test_playbooks_endpoint():
    headers = create_role_headers(
        "viewer"
    )

    response = client.get(
        "/api/playbooks",
        headers=headers,
    )

    assert response.status_code == 200

    playbooks = response.json()

    assert len(playbooks) == 3

    playbook_ids = {
        playbook["id"]
        for playbook in playbooks
    }

    assert (
        "encoded-powershell-investigation"
        in playbook_ids
    )

    assert (
        "powershell-download-cradle-response"
        in playbook_ids
    )

    assert (
        "account-compromise-investigation"
        in playbook_ids
    )


def test_rule_to_playbook_mapping():
    headers = create_role_headers(
        "viewer"
    )

    response = client.get(
        (
            "/api/playbooks/rule/"
            "auth-brute-force"
        ),
        headers=headers,
    )

    assert response.status_code == 200

    playbooks = response.json()

    assert len(playbooks) == 1

    playbook = playbooks[0]

    assert (
        playbook["id"]
        == (
            "account-compromise-"
            "investigation"
        )
    )

    assert (
        "auth-brute-force"
        in playbook[
            "trigger_rule_ids"
        ]
    )


def test_playbook_detail_endpoint():
    headers = create_role_headers(
        "viewer"
    )

    response = client.get(
        (
            "/api/playbooks/"
            "encoded-powershell-"
            "investigation"
        ),
        headers=headers,
    )

    assert response.status_code == 200

    playbook = response.json()

    assert (
        playbook["id"]
        == (
            "encoded-powershell-"
            "investigation"
        )
    )

    assert (
        playbook["enabled"]
        is True
    )

    assert (
        len(
            playbook["steps"]
        )
        == 6
    )


def test_unknown_playbook_returns_404():
    headers = create_role_headers(
        "viewer"
    )

    response = client.get(
        (
            "/api/playbooks/"
            "not-a-real-playbook"
        ),
        headers=headers,
    )

    assert response.status_code == 404