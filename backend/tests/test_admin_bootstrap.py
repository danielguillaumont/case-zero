import uuid
from unittest.mock import MagicMock

import pytest

from scripts import create_admin


def build_database_mocks(
    *,
    fetch_results,
):
    cursor = MagicMock()

    cursor.__enter__.return_value = (
        cursor
    )

    cursor.fetchone.side_effect = (
        fetch_results
    )

    connection = MagicMock()

    connection.__enter__.return_value = (
        connection
    )

    connection.cursor.return_value = (
        cursor
    )

    return connection, cursor


def clear_bootstrap_environment(
    monkeypatch,
):
    monkeypatch.delenv(
        create_admin.BOOTSTRAP_EMAIL_ENV,
        raising=False,
    )

    monkeypatch.delenv(
        create_admin.BOOTSTRAP_DISPLAY_NAME_ENV,
        raising=False,
    )

    monkeypatch.delenv(
        create_admin.BOOTSTRAP_PASSWORD_ENV,
        raising=False,
    )


def test_bootstrap_environment_skips_when_absent(
    monkeypatch,
):
    clear_bootstrap_environment(
        monkeypatch
    )

    result = (
        create_admin
        .read_bootstrap_environment()
    )

    assert result is None


def test_bootstrap_environment_rejects_partial_configuration(
    monkeypatch,
):
    clear_bootstrap_environment(
        monkeypatch
    )

    monkeypatch.setenv(
        create_admin.BOOTSTRAP_EMAIL_ENV,
        "bootstrap-test@casezero.dev",
    )

    with pytest.raises(
        SystemExit,
        match=(
            "Incomplete administrator "
            "bootstrap configuration"
        ),
    ):
        create_admin.read_bootstrap_environment()


def test_bootstrap_environment_validates_values(
    monkeypatch,
):
    clear_bootstrap_environment(
        monkeypatch
    )

    monkeypatch.setenv(
        create_admin.BOOTSTRAP_EMAIL_ENV,
        " Bootstrap-Test@casezero.dev ",
    )

    monkeypatch.setenv(
        create_admin
        .BOOTSTRAP_DISPLAY_NAME_ENV,
        " Bootstrap Test Admin ",
    )

    monkeypatch.setenv(
        create_admin.BOOTSTRAP_PASSWORD_ENV,
        "Bootstrap-Test-Password-2026!",
    )

    result = (
        create_admin
        .read_bootstrap_environment()
    )

    assert result == (
        "bootstrap-test@casezero.dev",
        "Bootstrap Test Admin",
        "Bootstrap-Test-Password-2026!",
    )


def test_bootstrap_existing_active_admin_is_safe_noop(
    monkeypatch,
):
    existing_user_id = uuid.uuid4()

    connection, cursor = (
        build_database_mocks(
            fetch_results=[
                (
                    existing_user_id,
                    "administrator",
                    True,
                ),
            ]
        )
    )

    monkeypatch.setattr(
        create_admin.psycopg,
        "connect",
        MagicMock(
            return_value=connection
        ),
    )

    password_hasher = MagicMock()

    monkeypatch.setattr(
        create_admin,
        "hash_password",
        password_hasher,
    )

    create_admin.provision_administrator(
        email=(
            "bootstrap-test@casezero.dev"
        ),
        display_name=(
            "Bootstrap Test Admin"
        ),
        password=(
            "Bootstrap-Test-Password-2026!"
        ),
        bootstrap_only=True,
    )

    password_hasher.assert_not_called()

    connection.commit.assert_not_called()

    assert cursor.execute.call_count == 1


def test_bootstrap_refuses_initialized_database(
    monkeypatch,
):
    connection, cursor = (
        build_database_mocks(
            fetch_results=[
                None,
                (1,),
            ]
        )
    )

    monkeypatch.setattr(
        create_admin.psycopg,
        "connect",
        MagicMock(
            return_value=connection
        ),
    )

    password_hasher = MagicMock()

    monkeypatch.setattr(
        create_admin,
        "hash_password",
        password_hasher,
    )

    with pytest.raises(
        SystemExit,
        match=(
            "database already contains users"
        ),
    ):
        create_admin.provision_administrator(
            email=(
                "bootstrap-test@casezero.dev"
            ),
            display_name=(
                "Bootstrap Test Admin"
            ),
            password=(
                "Bootstrap-Test-Password-2026!"
            ),
            bootstrap_only=True,
        )

    password_hasher.assert_not_called()

    connection.commit.assert_not_called()

    assert cursor.execute.call_count == 2


def test_bootstrap_creates_first_administrator(
    monkeypatch,
):
    connection, cursor = (
        build_database_mocks(
            fetch_results=[
                None,
                (0,),
            ]
        )
    )

    monkeypatch.setattr(
        create_admin.psycopg,
        "connect",
        MagicMock(
            return_value=connection
        ),
    )

    password_hasher = MagicMock(
        return_value="hashed-password"
    )

    monkeypatch.setattr(
        create_admin,
        "hash_password",
        password_hasher,
    )

    create_admin.provision_administrator(
        email=(
            "bootstrap-test@casezero.dev"
        ),
        display_name=(
            "Bootstrap Test Admin"
        ),
        password=(
            "Bootstrap-Test-Password-2026!"
        ),
        bootstrap_only=True,
    )

    password_hasher.assert_called_once_with(
        "Bootstrap-Test-Password-2026!"
    )

    connection.commit.assert_called_once()

    executed_queries = [
        " ".join(
            call.args[0].split()
        )
        for call
        in cursor.execute.call_args_list
    ]

    assert any(
        "INSERT INTO users"
        in query
        for query
        in executed_queries
    )