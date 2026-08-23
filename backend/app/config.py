import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy.engine import URL


ROOT_DIR = Path(
    __file__
).resolve().parents[2]

load_dotenv(
    ROOT_DIR / ".env"
)


VALID_APP_ENVIRONMENTS = {
    "development",
    "test",
    "production",
}


APP_ENV = os.getenv(
    "APP_ENV",
    "development",
).strip().lower()


if (
    APP_ENV
    not in VALID_APP_ENVIRONMENTS
):
    raise RuntimeError(
        "APP_ENV must be one of: "
        "development, test, production."
    )


IS_PRODUCTION = (
    APP_ENV == "production"
)


def parse_positive_integer(
    name: str,
    default: int,
) -> int:
    raw_value = os.getenv(
        name,
        str(default),
    )

    try:
        value = int(
            raw_value
        )

    except ValueError as exc:
        raise RuntimeError(
            f"{name} must be an integer."
        ) from exc

    if value <= 0:
        raise RuntimeError(
            f"{name} must be greater "
            "than zero."
        )

    return value


def parse_port(
    name: str,
    default: int,
) -> int:
    value = parse_positive_integer(
        name,
        default,
    )

    if value > 65535:
        raise RuntimeError(
            f"{name} must be between "
            "1 and 65535."
        )

    return value


def parse_boolean(
    value: str,
) -> bool:
    normalized_value = (
        value.strip().lower()
    )

    if normalized_value in {
        "1",
        "true",
        "yes",
        "on",
    }:
        return True

    if normalized_value in {
        "0",
        "false",
        "no",
        "off",
    }:
        return False

    raise RuntimeError(
        "Boolean environment values "
        "must be true or false."
    )


POSTGRES_USER = os.getenv(
    "POSTGRES_USER",
    "casezero",
).strip()


POSTGRES_PASSWORD = os.getenv(
    "POSTGRES_PASSWORD",
    "",
)


POSTGRES_DB = os.getenv(
    "POSTGRES_DB",
    "casezero",
).strip()


POSTGRES_HOST = os.getenv(
    "POSTGRES_HOST",
    "127.0.0.1",
).strip()


POSTGRES_PORT = parse_port(
    "POSTGRES_PORT",
    5432,
)


JWT_SECRET_KEY = os.getenv(
    "JWT_SECRET_KEY",
    "",
)


JWT_ALGORITHM = "HS256"


JWT_ACCESS_TOKEN_MINUTES = (
    parse_positive_integer(
        "JWT_ACCESS_TOKEN_MINUTES",
        60,
    )
)


LOGIN_THROTTLE_MAX_FAILURES = (
    parse_positive_integer(
        "LOGIN_THROTTLE_MAX_FAILURES",
        5,
    )
)


LOGIN_THROTTLE_WINDOW_MINUTES = (
    parse_positive_integer(
        "LOGIN_THROTTLE_WINDOW_MINUTES",
        15,
    )
)


LOGIN_THROTTLE_BLOCK_MINUTES = (
    parse_positive_integer(
        "LOGIN_THROTTLE_BLOCK_MINUTES",
        5,
    )
)


default_docs_enabled = (
    "false"
    if IS_PRODUCTION
    else "true"
)


API_DOCS_ENABLED = (
    parse_boolean(
        os.getenv(
            "CASE_ZERO_API_DOCS_ENABLED",
            default_docs_enabled,
        )
    )
)


allowed_hosts_value = os.getenv(
    "CASE_ZERO_ALLOWED_HOSTS",
    (
        "localhost,"
        "127.0.0.1,"
        "testserver"
    ),
)


ALLOWED_HOSTS = [
    host.strip()
    for host
    in allowed_hosts_value.split(",")
    if host.strip()
]


if not ALLOWED_HOSTS:
    raise RuntimeError(
        "CASE_ZERO_ALLOWED_HOSTS "
        "must contain at least one host."
    )


EXAMPLE_SECRET_VALUES = {
    (
        "replace_with_secure_"
        "database_password"
    ),
    (
        "replace_with_long_"
        "random_secret"
    ),
}


def validate_production_config():
    if not IS_PRODUCTION:
        return

    missing_settings = []

    if not POSTGRES_USER:
        missing_settings.append(
            "POSTGRES_USER"
        )

    if not POSTGRES_PASSWORD:
        missing_settings.append(
            "POSTGRES_PASSWORD"
        )

    if not POSTGRES_DB:
        missing_settings.append(
            "POSTGRES_DB"
        )

    if not POSTGRES_HOST:
        missing_settings.append(
            "POSTGRES_HOST"
        )

    if not JWT_SECRET_KEY:
        missing_settings.append(
            "JWT_SECRET_KEY"
        )

    if missing_settings:
        missing_text = ", ".join(
            missing_settings
        )

        raise RuntimeError(
            "Missing required production "
            "configuration: "
            f"{missing_text}"
        )

    if (
        POSTGRES_PASSWORD
        in EXAMPLE_SECRET_VALUES
    ):
        raise RuntimeError(
            "POSTGRES_PASSWORD must not "
            "use the example placeholder "
            "value in production."
        )

    if (
        JWT_SECRET_KEY
        in EXAMPLE_SECRET_VALUES
    ):
        raise RuntimeError(
            "JWT_SECRET_KEY must not use "
            "the example placeholder value "
            "in production."
        )

    if (
        len(
            JWT_SECRET_KEY.encode(
                "utf-8"
            )
        )
        < 32
    ):
        raise RuntimeError(
            "JWT_SECRET_KEY must be at "
            "least 32 bytes in production."
        )

    if "*" in ALLOWED_HOSTS:
        raise RuntimeError(
            "CASE_ZERO_ALLOWED_HOSTS "
            "must not contain '*' "
            "in production."
        )


validate_production_config()


DATABASE_URL = (
    URL.create(
        drivername=(
            "postgresql+psycopg"
        ),
        username=POSTGRES_USER,
        password=POSTGRES_PASSWORD,
        host=POSTGRES_HOST,
        port=POSTGRES_PORT,
        database=POSTGRES_DB,
    )
    .render_as_string(
        hide_password=False
    )
)