from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
)


UserRole = Literal[
    "administrator",
    "analyst",
    "viewer",
]


class UserCreate(BaseModel):
    email: EmailStr

    display_name: str = Field(
        min_length=1,
        max_length=255,
    )

    password: str = Field(
        min_length=12,
        max_length=128,
    )

    role: UserRole = "analyst"


class UserUpdate(BaseModel):
    display_name: str | None = Field(
        default=None,
        min_length=1,
        max_length=255,
    )

    role: UserRole | None = None

    is_active: bool | None = None


class UserRead(BaseModel):
    model_config = ConfigDict(
        from_attributes=True
    )

    id: UUID
    email: EmailStr
    display_name: str
    role: UserRole
    is_active: bool
    created_at: datetime
    updated_at: datetime