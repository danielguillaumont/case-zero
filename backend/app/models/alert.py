import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    String,
    Text,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )

    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    severity: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="medium",
    )

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="new",
    )

    source: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        default="case-zero",
    )

    detection_rule_id: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        index=True,
    )

    assigned_analyst: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    case_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey(
            "cases.id",
            name="fk_alerts_case_id_cases",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    source_event_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey(
            "security_events.id",
            name="fk_alerts_source_event_id_security_events",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
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