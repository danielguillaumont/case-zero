from datetime import (
    datetime,
    timedelta,
    timezone,
)
from hashlib import sha256
from math import ceil

from sqlalchemy import (
    delete,
    select,
)
from sqlalchemy.dialects.postgresql import (
    insert as postgres_insert,
)
from sqlalchemy.ext.asyncio import (
    AsyncSession,
)

from app.config import (
    LOGIN_THROTTLE_BLOCK_MINUTES,
    LOGIN_THROTTLE_MAX_FAILURES,
    LOGIN_THROTTLE_WINDOW_MINUTES,
)
from app.models.login_throttle import (
    LoginThrottle,
)


def normalize_login_identity(
    identity: str,
) -> str:
    return (
        identity
        .strip()
        .lower()
    )


def hash_login_identity(
    identity: str,
) -> str:
    normalized_identity = (
        normalize_login_identity(
            identity
        )
    )

    return sha256(
        normalized_identity.encode(
            "utf-8"
        )
    ).hexdigest()


def current_utc_time() -> datetime:
    return datetime.now(
        timezone.utc
    )


def seconds_until(
    future_time: datetime,
    now: datetime,
) -> int:
    remaining_seconds = ceil(
        (
            future_time
            - now
        ).total_seconds()
    )

    return max(
        1,
        remaining_seconds,
    )


async def get_login_retry_after(
    session: AsyncSession,
    identity_hash: str,
    *,
    now: datetime | None = None,
) -> int | None:
    if now is None:
        now = current_utc_time()

    throttle = await session.get(
        LoginThrottle,
        identity_hash,
    )

    if (
        throttle is None
        or throttle.blocked_until
        is None
    ):
        return None

    if (
        throttle.blocked_until
        <= now
    ):
        return None

    return seconds_until(
        throttle.blocked_until,
        now,
    )


async def record_login_failure(
    session: AsyncSession,
    identity_hash: str,
    *,
    now: datetime | None = None,
) -> int | None:
    if now is None:
        now = current_utc_time()

    insert_statement = (
        postgres_insert(
            LoginThrottle
        )
        .values(
            identity_hash=(
                identity_hash
            ),
            failure_count=0,
            window_started_at=now,
            created_at=now,
            updated_at=now,
        )
        .on_conflict_do_nothing(
            index_elements=[
                "identity_hash"
            ]
        )
    )

    await session.execute(
        insert_statement
    )

    result = await session.execute(
        select(
            LoginThrottle
        )
        .where(
            LoginThrottle.identity_hash
            == identity_hash
        )
        .with_for_update()
    )

    throttle = (
        result.scalar_one()
    )

    if (
        throttle.blocked_until
        is not None
    ):
        if (
            throttle.blocked_until
            > now
        ):
            retry_after = (
                seconds_until(
                    throttle.blocked_until,
                    now,
                )
            )

            await session.commit()

            return retry_after

        throttle.failure_count = 0
        throttle.window_started_at = now
        throttle.last_failed_at = None
        throttle.blocked_until = None

    window_expires_at = (
        throttle.window_started_at
        + timedelta(
            minutes=(
                LOGIN_THROTTLE_WINDOW_MINUTES
            )
        )
    )

    if now >= window_expires_at:
        throttle.failure_count = 0
        throttle.window_started_at = now
        throttle.blocked_until = None

    throttle.failure_count += 1
    throttle.last_failed_at = now
    throttle.updated_at = now

    retry_after = None

    if (
        throttle.failure_count
        >= LOGIN_THROTTLE_MAX_FAILURES
    ):
        throttle.blocked_until = (
            now
            + timedelta(
                minutes=(
                    LOGIN_THROTTLE_BLOCK_MINUTES
                )
            )
        )

        retry_after = seconds_until(
            throttle.blocked_until,
            now,
        )

    await session.commit()

    return retry_after


async def clear_login_failures(
    session: AsyncSession,
    identity_hash: str,
) -> None:
    await session.execute(
        delete(
            LoginThrottle
        ).where(
            LoginThrottle.identity_hash
            == identity_hash
        )
    )

    await session.commit()