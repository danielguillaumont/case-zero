from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.config import DATABASE_URL


engine = create_async_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    connect_args={
        "connect_timeout": 2,
    },
)


async def check_database_connection() -> bool:
    try:
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))

        return True

    except Exception:
        return False