from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Integer,
    String,
    func,
)
from sqlalchemy.orm import (
    Mapped,
    mapped_column,
)

from app.models.base import Base


class LoginThrottle(Base):
    __tablename__ = "login_throttles"

    __table_args__ = (
        CheckConstraint(
            "failure_count >= 0",
            name=(
                "ck_login_throttles_"
                "failure_count"
            ),
        ),
    )

    identity_hash: Mapped[str] = (
        mapped_column(
            String(64),
            primary_key=True,
        )
    )

    failure_count: Mapped[int] = (
        mapped_column(
            Integer,
            nullable=False,
            default=0,
            server_default="0",
        )
    )

    window_started_at: Mapped[
        datetime
    ] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    last_failed_at: Mapped[
        datetime | None
    ] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    blocked_until: Mapped[
        datetime | None
    ] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    created_at: Mapped[datetime] = (
        mapped_column(
            DateTime(timezone=True),
            nullable=False,
            server_default=func.now(),
        )
    )

    updated_at: Mapped[datetime] = (
        mapped_column(
            DateTime(timezone=True),
            nullable=False,
            server_default=func.now(),
            onupdate=func.now(),
        )
    )