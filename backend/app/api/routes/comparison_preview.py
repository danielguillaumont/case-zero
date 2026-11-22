import hashlib
import stat
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Response

from app.api.routes.replay_preview import _require_empty_request
from app.auth import require_roles
from app.models.user import User
from app.schemas.comparison_preview import ComparisonPreviewResponse
from app.services.replay_comparison import compare_replay_summaries
from app.services.replay_expectations import parse_replay_expectations
from app.services.replay_fixtures import parse_replay_fixture
from app.services.replay_grading import grade_loaded_replay
from app.services.replay_regression_proof import CORRECTED, WEAKENED
from app.services.replay_summary import summarize_replay_grade

router = APIRouter(prefix="/api/lab", tags=["Detection Lab"])
_ASSETS = Path(__file__).resolve().parents[2] / "replay_assets"
_FIXTURE_PATH = _ASSETS / "encoded_powershell.json"
_EXPECTATIONS_PATH = _ASSETS / "encoded_powershell.expectations.json"
_FIXTURE_SHA256 = "025c8bb93536b73227406c8c74e2f64d8592350b328792147a77f628357beb6d"
_EXPECTATIONS_SHA256 = (
    "2b566489fdd31209b056c21a657749cef15467aaab61dff96261ff407ec42220"
)
# Digest of the full canonical v2.5-C response, including its comparison_sha256.
_RESPONSE_SHA256 = "61f50d1b4fc71f47092576afa32b133ad33b3d4d6949a1f2e808f41c4915cec9"
_MAX_ASSET_BYTES = 16 * 1024
_MAX_RESPONSE_BYTES = 16 * 1024
_NO_STORE = {"Cache-Control": "no-store"}


def _read_bundled_asset(path: Path) -> bytes:
    info = path.lstat()
    if (
        not stat.S_ISREG(info.st_mode)
        or getattr(info, "st_file_attributes", 0) & stat.FILE_ATTRIBUTE_REPARSE_POINT
        or not 0 < info.st_size <= _MAX_ASSET_BYTES
    ):
        raise ValueError("Invalid comparison asset.")
    with path.open("rb") as stream:
        data = stream.read(_MAX_ASSET_BYTES + 1)
    if not 0 < len(data) <= _MAX_ASSET_BYTES:
        raise ValueError("Invalid comparison asset size.")
    return data


@router.get("/comparison-preview", response_model=ComparisonPreviewResponse)
def comparison_preview(
    _user: User = Depends(require_roles("administrator", "analyst")),
    _empty_request: None = Depends(_require_empty_request),
) -> Response:
    try:
        fixture = parse_replay_fixture(_read_bundled_asset(_FIXTURE_PATH))
        if fixture.content_hash != _FIXTURE_SHA256:
            raise ValueError("Unexpected comparison fixture.")
        expectations = parse_replay_expectations(
            _read_bundled_asset(_EXPECTATIONS_PATH), fixture, CORRECTED
        )
        if expectations.content_sha256 != _EXPECTATIONS_SHA256:
            raise ValueError("Unexpected comparison expectations.")
        baseline, candidate = (
            summarize_replay_grade(
                grade_loaded_replay(fixture, expectations, version),
                fixture,
                expectations,
                version,
            )
            for version in (WEAKENED, CORRECTED)
        )
        canonical = compare_replay_summaries(baseline, candidate).canonical_json()
        if len(canonical) > _MAX_RESPONSE_BYTES:
            raise ValueError("Comparison preview exceeds its response size limit.")
        ComparisonPreviewResponse.model_validate_json(canonical)
        if hashlib.sha256(canonical).hexdigest() != _RESPONSE_SHA256:
            raise ValueError("Comparison preview differs from the expected result.")
        return Response(canonical, media_type="application/json", headers=_NO_STORE)
    except Exception:
        # Authentication and request validation run before this boundary.
        raise HTTPException(
            status_code=503,
            detail={"code": "comparison_preview_unavailable"},
            headers=_NO_STORE,
        ) from None
