from fastapi import (
    APIRouter,
    HTTPException,
    status,
)

from app.schemas.detection_rule import (
    DetectionRuleRead,
)
from app.services.detection_engine import (
    get_detection_rules,
)


router = APIRouter(
    prefix="/api/rules",
    tags=["Detection Rules"],
)


@router.get(
    "",
    response_model=list[DetectionRuleRead],
)
async def get_rules() -> list[dict]:
    return get_detection_rules()


@router.get(
    "/{rule_id}",
    response_model=DetectionRuleRead,
)
async def get_rule(
    rule_id: str,
) -> dict:
    rules = get_detection_rules()

    rule = next(
        (
            rule
            for rule in rules
            if rule["id"] == rule_id
        ),
        None,
    )

    if rule is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Detection rule not found",
        )

    return rule