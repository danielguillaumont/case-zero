import argparse
import os
import uuid
from getpass import getpass

import psycopg
from pydantic import (
    EmailStr,
    TypeAdapter,
    ValidationError,
)

from app.config import (
    POSTGRES_DB,
    POSTGRES_HOST,
    POSTGRES_PASSWORD,
    POSTGRES_PORT,
    POSTGRES_USER,
)
from app.security import hash_password


email_validator = TypeAdapter(
    EmailStr
)


BOOTSTRAP_EMAIL_ENV = (
    "CASE_ZERO_BOOTSTRAP_ADMIN_EMAIL"
)

BOOTSTRAP_DISPLAY_NAME_ENV = (
    "CASE_ZERO_BOOTSTRAP_ADMIN_DISPLAY_NAME"
)

BOOTSTRAP_PASSWORD_ENV = (
    "CASE_ZERO_BOOTSTRAP_ADMIN_PASSWORD"
)


def validate_email(
    raw_email: str,
) -> str:
    try:
        validated_email = (
            email_validator.validate_python(
                raw_email.strip()
            )
        )

    except ValidationError:
        raise SystemExit(
            "Invalid email address."
        )

    return str(
        validated_email
    ).lower()


def validate_display_name(
    raw_display_name: str,
) -> str:
    display_name = (
        raw_display_name.strip()
    )

    if not display_name:
        raise SystemExit(
            "Display name cannot be empty."
        )

    if len(display_name) > 255:
        raise SystemExit(
            "Display name must be "
            "255 characters or fewer."
        )

    return display_name


def validate_password(
    password: str,
) -> str:
    if len(password) < 12:
        raise SystemExit(
            "Password must contain "
            "at least 12 characters."
        )

    if len(password) > 128:
        raise SystemExit(
            "Password must contain "
            "128 characters or fewer."
        )

    return password


def read_email() -> str:
    return validate_email(
        input(
            "Administrator email: "
        )
    )


def read_display_name() -> str:
    return validate_display_name(
        input(
            "Display name: "
        )
    )


def read_password() -> str:
    password = getpass(
        "Password: "
    )

    confirmation = getpass(
        "Confirm password: "
    )

    if password != confirmation:
        raise SystemExit(
            "Passwords do not match."
        )

    return validate_password(
        password
    )


def read_bootstrap_environment():
    raw_email = os.getenv(
        BOOTSTRAP_EMAIL_ENV
    )

    raw_display_name = os.getenv(
        BOOTSTRAP_DISPLAY_NAME_ENV
    )

    raw_password = os.getenv(
        BOOTSTRAP_PASSWORD_ENV
    )

    values = {
        BOOTSTRAP_EMAIL_ENV:
            raw_email,
        BOOTSTRAP_DISPLAY_NAME_ENV:
            raw_display_name,
        BOOTSTRAP_PASSWORD_ENV:
            raw_password,
    }

    configured_values = [
        value
        for value in values.values()
        if value not in {
            None,
            "",
        }
    ]

    if not configured_values:
        return None

    missing_variables = [
        name
        for name, value
        in values.items()
        if value in {
            None,
            "",
        }
    ]

    if missing_variables:
        raise SystemExit(
            (
                "Incomplete administrator "
                "bootstrap configuration. "
                "Missing: "
            )
            + ", ".join(
                missing_variables
            )
        )

    assert raw_email is not None
    assert raw_display_name is not None
    assert raw_password is not None

    return (
        validate_email(
            raw_email
        ),
        validate_display_name(
            raw_display_name
        ),
        validate_password(
            raw_password
        ),
    )


def provision_administrator(
    *,
    email: str,
    display_name: str,
    password: str,
    bootstrap_only: bool,
) -> None:
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
                    id,
                    role,
                    is_active
                FROM users
                WHERE lower(email) = lower(%s)
                """,
                (
                    email,
                ),
            )

            existing_user = (
                cursor.fetchone()
            )

            if existing_user is not None:
                (
                    existing_user_id,
                    existing_role,
                    existing_is_active,
                ) = existing_user

                if (
                    bootstrap_only
                    and existing_role
                    == "administrator"
                    and existing_is_active
                ):
                    print(
                        (
                            "Administrator already "
                            "provisioned. "
                            "No changes made."
                        )
                    )

                    print(
                        "User ID: "
                        f"{existing_user_id}"
                    )

                    return

                raise SystemExit(
                    "A user with that email "
                    "already exists."
                )

            if bootstrap_only:
                cursor.execute(
                    """
                    SELECT COUNT(*)
                    FROM users
                    """
                )

                user_count_row = (
                    cursor.fetchone()
                )

                assert (
                    user_count_row
                    is not None
                )

                user_count = int(
                    user_count_row[0]
                )

                if user_count > 0:
                    raise SystemExit(
                        (
                            "Administrator bootstrap "
                            "refused because the "
                            "database already contains "
                            "users."
                        )
                    )

            password_hash = (
                hash_password(
                    password
                )
            )

            user_id = uuid.uuid4()

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
                    password_hash,
                    "administrator",
                    True,
                ),
            )

        connection.commit()

    print()
    print(
        "Administrator created successfully."
    )
    print(
        f"User ID: {user_id}"
    )
    print(
        f"Email: {email}"
    )
    print(
        "Role: administrator"
    )


def parse_arguments():
    parser = argparse.ArgumentParser(
        description=(
            "Provision a CASE//ZERO "
            "administrator."
        )
    )

    parser.add_argument(
        "--bootstrap-if-configured",
        action="store_true",
        help=(
            "Create the first administrator "
            "from environment variables when "
            "bootstrap credentials are "
            "configured."
        ),
    )

    return parser.parse_args()


def main() -> None:
    arguments = parse_arguments()

    print(
        "CASE//ZERO Administrator Provisioning"
    )
    print(
        f"Target database: {POSTGRES_DB}"
    )
    print()

    if (
        arguments.bootstrap_if_configured
    ):
        bootstrap_values = (
            read_bootstrap_environment()
        )

        if bootstrap_values is None:
            print(
                (
                    "Administrator bootstrap "
                    "not configured. Skipping."
                )
            )

            return

        (
            email,
            display_name,
            password,
        ) = bootstrap_values

        provision_administrator(
            email=email,
            display_name=display_name,
            password=password,
            bootstrap_only=True,
        )

        return

    email = read_email()

    display_name = (
        read_display_name()
    )

    password = read_password()

    provision_administrator(
        email=email,
        display_name=display_name,
        password=password,
        bootstrap_only=False,
    )


if __name__ == "__main__":
    main()