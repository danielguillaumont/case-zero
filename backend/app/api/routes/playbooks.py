from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)

from app.auth import require_roles
from app.models.user import User
from app.schemas.playbook import (
    PlaybookRead,
)
from app.services.playbook_service import (
    get_playbook,
    get_playbooks,
    get_playbooks_for_rule,
)


router = APIRouter(
    prefix="/api/playbooks",
    tags=["Playbooks"],
)


@router.get(
    "",
    response_model=list[PlaybookRead],
)
async def list_playbooks(
    _current_user: User = Depends(
        require_roles(
            "administrator",
            "analyst",
            "viewer",
        )
    ),
) -> list[dict]:
    return get_playbooks()


@router.get(
    "/rule/{rule_id}",
    response_model=list[PlaybookRead],
)
async def list_playbooks_for_rule(
    rule_id: str,
    _current_user: User = Depends(
        require_roles(
            "administrator",
            "analyst",
            "viewer",
        )
    ),
) -> list[dict]:
    return get_playbooks_for_rule(
        rule_id
    )


@router.get(
    "/{playbook_id}",
    response_model=PlaybookRead,
)
async def read_playbook(
    playbook_id: str,
    _current_user: User = Depends(
        require_roles(
            "administrator",
            "analyst",
            "viewer",
        )
    ),
) -> dict:
    playbook = get_playbook(
        playbook_id
    )

    if playbook is None:
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
            ),
            detail="Playbook not found",
        )

    return playbook