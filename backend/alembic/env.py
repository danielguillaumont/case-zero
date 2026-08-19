import asyncio
import selectors
import sys
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import (
    async_engine_from_config,
)

from app.config import DATABASE_URL
from app.models.alert import Alert
from app.models.base import Base
from app.models.case import Case
from app.models.case_activity import (
    CaseActivity,
)
from app.models.case_note import CaseNote
from app.models.login_throttle import (
    LoginThrottle,
)
from app.models.security_event import (
    SecurityEvent,
)
from app.models.threat_indicator import (
    ThreatIndicator,
)
from app.models.user import User


config = context.config

config.set_main_option(
    "sqlalchemy.url",
    DATABASE_URL.replace(
        "%",
        "%%",
    ),
)

if (
    config.config_file_name
    is not None
):
    fileConfig(
        config.config_file_name
    )


target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option(
        "sqlalchemy.url"
    )

    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={
            "paramstyle": "named"
        },
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(
    connection: Connection
) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = (
        async_engine_from_config(
            config.get_section(
                config.config_ini_section,
                {},
            ),
            prefix="sqlalchemy.",
            poolclass=pool.NullPool,
        )
    )

    async with (
        connectable.connect()
        as connection
    ):
        await connection.run_sync(
            do_run_migrations
        )

    await connectable.dispose()


def create_selector_event_loop():
    loop = asyncio.SelectorEventLoop(
        selectors.SelectSelector()
    )

    asyncio.set_event_loop(
        loop
    )

    return loop


def run_migrations_online() -> None:
    if sys.platform == "win32":
        asyncio.run(
            run_async_migrations(),
            loop_factory=(
                create_selector_event_loop
            ),
        )

    else:
        asyncio.run(
            run_async_migrations()
        )


if context.is_offline_mode():
    run_migrations_offline()

else:
    run_migrations_online()