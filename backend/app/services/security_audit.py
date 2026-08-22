import logging
from typing import Any
from uuid import UUID

from fastapi import Request

from app.database import AsyncSessionLocal
from app.models.security_audit_event import (
    SecurityAuditEvent,
)


logger = logging.getLogger(__name__)


def get_request_source_ip(
    request: Request,
) -> str | None:
    if request.client is None:
        return None

    return request.client.host


async def record_security_audit_event(
    *,
    request: Request,
    event_type: str,
    outcome: str,
    severity: str,
    user_id: UUID | None = None,
    identity_hash: str | None = None,
    details: dict[str, Any] | None = None,
) -> None:
    audit_event = SecurityAuditEvent(
        event_type=event_type,
        outcome=outcome,
        severity=severity,
        user_id=user_id,
        identity_hash=identity_hash,
        request_method=request.method,
        request_path=request.url.path,
        source_ip=get_request_source_ip(
            request
        ),
        details=details,
    )

    try:
        async with (
            AsyncSessionLocal()
            as audit_session
        ):
            audit_session.add(
                audit_event
            )

            await audit_session.commit()

    except Exception:
        logger.exception(
            (
                "Failed to persist "
                "security audit event: %s"
            ),
            event_type,
        )