from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException
from starlette.requests import Request

import app.auth as auth_module
from app.auth import require_roles
from app.models.user import User


def create_user(
    role: str,
) -> User:
    return User(
        email=f"{role}@casezero.dev",
        display_name=(
            f"CASE ZERO {role.title()}"
        ),
        password_hash="test-password-hash",
        role=role,
        is_active=True,
    )


def create_request(
    *,
    method: str = "GET",
    path: str = "/api/test",
) -> Request:
    scope = {
        "type": "http",
        "asgi": {
            "version": "3.0",
        },
        "http_version": "1.1",
        "method": method,
        "scheme": "http",
        "path": path,
        "raw_path": path.encode(
            "utf-8"
        ),
        "query_string": b"",
        "headers": [],
        "client": (
            "127.0.0.1",
            12345,
        ),
        "server": (
            "testserver",
            80,
        ),
    }

    return Request(
        scope
    )


@pytest.mark.asyncio
async def test_administrator_can_access_admin_role():
    user = create_user(
        "administrator"
    )

    request = create_request()

    dependency = require_roles(
        "administrator"
    )

    result = await dependency(
        request=request,
        current_user=user,
    )

    assert result is user


@pytest.mark.asyncio
async def test_analyst_can_access_analyst_role():
    user = create_user(
        "analyst"
    )

    request = create_request()

    dependency = require_roles(
        "administrator",
        "analyst",
    )

    result = await dependency(
        request=request,
        current_user=user,
    )

    assert result is user


@pytest.mark.asyncio
async def test_viewer_is_denied_analyst_role(
    monkeypatch,
):
    user = create_user(
        "viewer"
    )

    request = create_request(
        method="POST",
        path="/api/events",
    )

    audit_mock = AsyncMock()

    monkeypatch.setattr(
        auth_module,
        "record_security_audit_event",
        audit_mock,
    )

    dependency = require_roles(
        "administrator",
        "analyst",
    )

    with pytest.raises(
        HTTPException
    ) as error:
        await dependency(
            request=request,
            current_user=user,
        )

    assert (
        error.value.status_code
        == 403
    )

    assert (
        error.value.detail
        == "Insufficient permissions"
    )

    audit_mock.assert_awaited_once()

    audit_call = (
        audit_mock.await_args.kwargs
    )

    assert (
        audit_call["request"]
        is request
    )

    assert (
        audit_call["event_type"]
        == "rbac.access_denied"
    )

    assert (
        audit_call["outcome"]
        == "denied"
    )

    assert (
        audit_call["severity"]
        == "warning"
    )

    assert (
        audit_call["user_id"]
        == user.id
    )

    assert (
        audit_call["details"]
        == {
            "current_role":
                "viewer",
            "allowed_roles": [
                "administrator",
                "analyst",
            ],
        }
    )


@pytest.mark.asyncio
async def test_viewer_can_access_read_only_role_set():
    user = create_user(
        "viewer"
    )

    request = create_request()

    dependency = require_roles(
        "administrator",
        "analyst",
        "viewer",
    )

    result = await dependency(
        request=request,
        current_user=user,
    )

    assert result is user