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


def read_email() -> str:
    raw_email = input(
        "Administrator email: "
    ).strip()

    try:
        validated_email = (
            email_validator.validate_python(
                raw_email
            )
        )
    except ValidationError:
        raise SystemExit(
            "Invalid email address."
        )

    return str(
        validated_email
    ).lower()


def read_display_name() -> str:
    display_name = input(
        "Display name: "
    ).strip()

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


def main() -> None:
    print(
        "CASE//ZERO Administrator Provisioning"
    )
    print(
        f"Target database: {POSTGRES_DB}"
    )
    print()

    email = read_email()
    display_name = read_display_name()
    password = read_password()

    password_hash = hash_password(
        password
    )

    user_id = uuid.uuid4()

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
                SELECT id
                FROM users
                WHERE lower(email) = lower(%s)
                """,
                (email,),
            )

            existing_user = (
                cursor.fetchone()
            )

            if existing_user is not None:
                raise SystemExit(
                    "A user with that email "
                    "already exists."
                )

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


if __name__ == "__main__":
    main()