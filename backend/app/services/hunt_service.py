from sqlalchemy import (
    Text,
    cast,
    func,
    or_,
    select,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.security_event import SecurityEvent
from app.schemas.hunt import HuntQuery


async def search_security_events(
    hunt_query: HuntQuery,
    session: AsyncSession,
) -> list[SecurityEvent]:
    statement = select(
        SecurityEvent
    )

    if hunt_query.event_type:
        statement = statement.where(
            func.lower(
                SecurityEvent.event_type
            )
            == hunt_query.event_type.lower()
        )

    if hunt_query.source:
        statement = statement.where(
            func.lower(
                SecurityEvent.source
            )
            == hunt_query.source.lower()
        )

    if hunt_query.hostname:
        statement = statement.where(
            func.lower(
                SecurityEvent.hostname
            )
            == hunt_query.hostname.lower()
        )

    if hunt_query.username:
        statement = statement.where(
            func.lower(
                SecurityEvent.username
            )
            == hunt_query.username.lower()
        )

    if hunt_query.source_ip:
        statement = statement.where(
            SecurityEvent.source_ip
            == hunt_query.source_ip
        )

    if hunt_query.process_name:
        statement = statement.where(
            func.lower(
                SecurityEvent.process_name
            )
            == hunt_query.process_name.lower()
        )

    if hunt_query.start_time:
        statement = statement.where(
            SecurityEvent.event_time
            >= hunt_query.start_time
        )

    if hunt_query.end_time:
        statement = statement.where(
            SecurityEvent.event_time
            <= hunt_query.end_time
        )

    if hunt_query.contains:
        search_value = (
            f"%{hunt_query.contains}%"
        )

        statement = statement.where(
            or_(
                SecurityEvent.event_type.ilike(
                    search_value
                ),
                SecurityEvent.source.ilike(
                    search_value
                ),
                SecurityEvent.hostname.ilike(
                    search_value
                ),
                SecurityEvent.username.ilike(
                    search_value
                ),
                SecurityEvent.source_ip.ilike(
                    search_value
                ),
                SecurityEvent.destination_ip.ilike(
                    search_value
                ),
                SecurityEvent.process_name.ilike(
                    search_value
                ),
                SecurityEvent.command_line.ilike(
                    search_value
                ),
                cast(
                    SecurityEvent.raw_data,
                    Text,
                ).ilike(
                    search_value
                ),
            )
        )

    statement = (
        statement
        .order_by(
            SecurityEvent.event_time.desc()
        )
        .limit(
            hunt_query.limit
        )
    )

    result = await session.execute(
        statement
    )

    events = result.scalars().all()

    return list(events)