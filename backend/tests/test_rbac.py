import pytest
from fastapi import HTTPException

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


@pytest.mark.asyncio
async def test_administrator_can_access_admin_role():
    user = create_user(
        "administrator"
    )

    dependency = require_roles(
        "administrator"
    )

    result = await dependency(
        current_user=user
    )

    assert result is user


@pytest.mark.asyncio
async def test_analyst_can_access_analyst_role():
    user = create_user(
        "analyst"
    )

    dependency = require_roles(
        "administrator",
        "analyst",
    )

    result = await dependency(
        current_user=user
    )

    assert result is user


@pytest.mark.asyncio
async def test_viewer_is_denied_analyst_role():
    user = create_user(
        "viewer"
    )

    dependency = require_roles(
        "administrator",
        "analyst",
    )

    with pytest.raises(
        HTTPException
    ) as error:
        await dependency(
            current_user=user
        )

    assert (
        error.value.status_code
        == 403
    )

    assert (
        error.value.detail
        == "Insufficient permissions"
    )


@pytest.mark.asyncio
async def test_viewer_can_access_read_only_role_set():
    user = create_user(
        "viewer"
    )

    dependency = require_roles(
        "administrator",
        "analyst",
        "viewer",
    )

    result = await dependency(
        current_user=user
    )

    assert result is user