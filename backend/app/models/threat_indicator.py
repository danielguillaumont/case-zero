import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import (
    Mapped,
    mapped_column,
)

from app.models.base import Base


class ThreatIndicator(Base):
    __tablename__ = "threat_indicators"

    __table_args__ = (
        UniqueConstraint(
            "indicator_type",
            "value",
            name=(
                "uq_threat_indicators_"
                "type_value"
            ),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )

    indicator_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        index=True,
    )

    value: Mapped[str] = mapped_column(
        String(2048),
        nullable=False,
        index=True,
    )

    reputation: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="unknown",
        index=True,
    )

    confidence: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=50,
    )

    source: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        default="analyst",
        index=True,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    tags: Mapped[list[str]] = mapped_column(
        JSON,
        nullable=False,
        default=list,
    )

    first_seen: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    last_seen: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )