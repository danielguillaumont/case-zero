import json
import stat
from dataclasses import asdict
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from starlette.requests import ClientDisconnect

from app.auth import require_roles
from app.models.user import User
from app.schemas.replay_preview import ReplayPreviewResponse
from app.services.replay_evaluator import ENCODED_POWERSHELL_RULE_ID
from app.services.replay_evidence import verify_replay_evidence
from app.services.replay_fixtures import load_replay_fixture
from app.services.replay_harness import run_replay


router = APIRouter(prefix="/api/lab", tags=["Detection Lab"])
_ASSETS = Path(__file__).resolve().parents[2] / "replay_assets"
_FIXTURE_PATH = _ASSETS / "encoded_powershell.json"
_MANIFEST_PATH = _ASSETS / "encoded_powershell.manifest.json"
_FIXTURE_ID = "synthetic-encoded-powershell"
_INPUT_SHA256 = "025c8bb93536b73227406c8c74e2f64d8592350b328792147a77f628357beb6d"
_MAX_ASSET_BYTES = 16 * 1024
_MAX_RESPONSE_BYTES = 16 * 1024


async def _require_empty_request(request: Request) -> None:
    if request.scope["query_string"]:
        raise HTTPException(status_code=400, detail="Replay preview does not accept query parameters.")
    if request.headers.get("content-length", "0") != "0":
        raise HTTPException(status_code=400, detail="Replay preview does not accept a request body.")
    try:
        async for chunk in request.stream():
            if chunk:
                raise HTTPException(status_code=400, detail="Replay preview does not accept a request body.")
    except ClientDisconnect:
        raise HTTPException(status_code=400, detail="Incomplete replay preview request.") from None


def _check_asset(path: Path) -> None:
    metadata = path.lstat()
    if not stat.S_ISREG(metadata.st_mode) or not 0 < metadata.st_size <= _MAX_ASSET_BYTES:
        raise ValueError("Invalid replay preview asset.")


@router.post("/replay-preview", response_model=ReplayPreviewResponse)
def replay_preview(
    _user: User = Depends(require_roles("administrator", "analyst")),
    _empty_request: None = Depends(_require_empty_request),
) -> JSONResponse:
    try:
        _check_asset(_FIXTURE_PATH)
        _check_asset(_MANIFEST_PATH)
        fixture = load_replay_fixture(_FIXTURE_PATH)
        if fixture.fixture_id != _FIXTURE_ID or fixture.content_hash != _INPUT_SHA256 or len(fixture.events) != 3:
            raise ValueError("Unexpected replay preview fixture.")

        rule_id = ENCODED_POWERSHELL_RULE_ID
        manifest = run_replay(fixture, rule_id)
        if manifest.status != "completed" or manifest.rule_id != rule_id:
            raise ValueError("Replay preview did not complete with the supported rule.")
        verification = verify_replay_evidence(_MANIFEST_PATH, _FIXTURE_PATH, rule_id)
        if verification.status != "verified":
            raise ValueError("Replay preview evidence failed verification.")

        canonical = manifest.canonical_json()
        with _MANIFEST_PATH.open("rb") as bundle:
            # Exact agreement includes both manifests' output SHA-256 fields.
            if bundle.read(_MAX_ASSET_BYTES + 1) != canonical:
                raise ValueError("Replay preview differs from the expected manifest.")
        result = ReplayPreviewResponse(
            manifest=json.loads(canonical),
            verification=asdict(verification),
        )
        response = JSONResponse(result.model_dump(mode="json"), headers={"Cache-Control": "no-store"})
        if len(response.body) > _MAX_RESPONSE_BYTES:
            raise ValueError("Replay preview response exceeds its size limit.")
        return response
    except (OSError, RuntimeError, ValueError):
        raise HTTPException(status_code=503, detail={"code": "preview_unavailable"}) from None
