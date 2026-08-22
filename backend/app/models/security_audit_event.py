import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    String,
    Uuid,
    func,
)
from sqlalchemy.dialects.postgresql import (
    JSONB,
)
from sqlalchemy.orm import (
    Mapped,
    mapped_column,
)

from app.models.base import Base


class SecurityAuditEvent(Base):
    __tablename__ = (
        "security_audit_events"
    )

    __table_args__ = (
        CheckConstraint(
            (
                "outcome IN "
                "('success', 'failure', "
                "'denied', 'throttled')"
            ),
            name=(
                "ck_security_audit_events_"
                "outcome"
            ),
        ),
        CheckConstraint(
            (
                "severity IN "
                "('info', 'warning', 'high')"
            ),
            name=(
                "ck_security_audit_events_"
                "severity"
            ),
        ),
    )

    id: Mapped[uuid.UUID] = (
        mapped_column(
            Uuid,
            primary_key=True,
            default=uuid.uuid4,
        )
    )

    event_type: Mapped[str] = (
        mapped_column(
            String(100),
            nullable=False,
            index=True,
        )
    )

    outcome: Mapped[str] = (
        mapped_column(
            String(20),
            nullable=False,
            index=True,
        )
    )

    severity: Mapped[str] = (
        mapped_column(
            String(20),
            nullable=False,
            index=True,
        )
    )

    user_id: Mapped[
        uuid.UUID | None
    ] = mapped_column(
        Uuid,
        nullable=True,
        index=True,
    )

    identity_hash: Mapped[
        str | None
    ] = mapped_column(
        String(64),
        nullable=True,
        index=True,
    )

    request_method: Mapped[
        str | None
    ] = mapped_column(
        String(10),
        nullable=True,
    )

    request_path: Mapped[
        str | None
    ] = mapped_column(
        String(500),
        nullable=True,
    )

    source_ip: Mapped[
        str | None
    ] = mapped_column(
        String(45),
        nullable=True,
    )

    details: Mapped[
        dict[str, Any] | None
    ] = mapped_column(
        JSONB,
        nullable=True,
    )

    created_at: Mapped[datetime] = (
        mapped_column(
            DateTime(timezone=True),
            server_default=func.now(),
            nullable=False,
            index=True,
        )
    )