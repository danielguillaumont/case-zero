import os
from pathlib import Path


from dotenv import load_dotenv


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


POSTGRES_PORT = os.getenv(
    "POSTGRES_PORT",
    "5432",
).strip()


JWT_SECRET_KEY = os.getenv(
    "JWT_SECRET_KEY",
    "",
)


JWT_ALGORITHM = "HS256"


JWT_ACCESS_TOKEN_MINUTES = int(
    os.getenv(
        "JWT_ACCESS_TOKEN_MINUTES",
        "60",
    )
)


if JWT_ACCESS_TOKEN_MINUTES <= 0:
    raise RuntimeError(
        "JWT_ACCESS_TOKEN_MINUTES "
        "must be greater than zero."
    )


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


validate_production_config()


DATABASE_URL = (
    "postgresql+psycopg://"
    f"{POSTGRES_USER}:"
    f"{POSTGRES_PASSWORD}"
    f"@{POSTGRES_HOST}:"
    f"{POSTGRES_PORT}/"
    f"{POSTGRES_DB}"
)