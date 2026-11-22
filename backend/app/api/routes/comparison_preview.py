import hashlib
import json
import stat
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import JSONResponse

from app.api.routes.replay_preview import _require_empty_request
from app.auth import require_roles
from app.models.user import User
from app.schemas.comparison_preview import (
    ComparisonPreviewResponse,
    ExpectationEvidenceResponse,
)
from app.services.replay_comparison import compare_replay_summaries
from app.services.replay_expectations import (
    ReplayExpectations,
    parse_replay_expectations,
)
from app.services.replay_fixtures import ReplayFixture, parse_replay_fixture
from app.services.replay_grading import grade_loaded_replay
from app.services.replay_regression_proof import CORRECTED, WEAKENED
from app.services.replay_summary import ReplaySummary, summarize_replay_grade

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
_EVIDENCE_CODES = {
    "true_positive": "expected_match_observed",
    "true_negative": "expected_non_match_observed",
    "false_negative": "expected_detection_missed",
}


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


def _load_bundle() -> tuple[ReplayFixture, ReplayExpectations]:
    fixture = parse_replay_fixture(_read_bundled_asset(_FIXTURE_PATH))
    if fixture.content_hash != _FIXTURE_SHA256:
        raise ValueError("Unexpected comparison fixture.")
    expectations = parse_replay_expectations(
        _read_bundled_asset(_EXPECTATIONS_PATH), fixture, CORRECTED
    )
    if expectations.content_sha256 != _EXPECTATIONS_SHA256:
        raise ValueError("Unexpected comparison expectations.")
    return fixture, expectations


def _verified_comparison(
    fixture: ReplayFixture,
    expectations: ReplayExpectations,
) -> tuple[bytes, ComparisonPreviewResponse, tuple[ReplaySummary, ReplaySummary]]:
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
    comparison = ComparisonPreviewResponse.model_validate_json(canonical)
    if hashlib.sha256(canonical).hexdigest() != _RESPONSE_SHA256:
        raise ValueError("Comparison preview differs from the expected result.")
    return canonical, comparison, (baseline, candidate)


@router.get("/comparison-preview", response_model=ComparisonPreviewResponse)
def comparison_preview(
    _user: User = Depends(require_roles("administrator", "analyst")),
    _empty_request: None = Depends(_require_empty_request),
) -> Response:
    try:
        canonical, _, _ = _verified_comparison(*_load_bundle())
        return Response(canonical, media_type="application/json", headers=_NO_STORE)
    except Exception:
        # Authentication and request validation run before this boundary.
        raise HTTPException(
            status_code=503,
            detail={"code": "comparison_preview_unavailable"},
            headers=_NO_STORE,
        ) from None


def _encode_evidence(payload: dict) -> bytes:
    return json.dumps(
        payload, sort_keys=True, ensure_ascii=True, separators=(",", ":")
    ).encode("utf-8")


@router.get(
    "/comparison-preview/expectations/{expectation_id}/evidence",
    response_model=ExpectationEvidenceResponse,
)
def expectation_evidence(
    expectation_id: str,
    _user: User = Depends(require_roles("administrator", "analyst")),
    _empty_request: None = Depends(_require_empty_request),
) -> Response:
    try:
        fixture, expectations = _load_bundle()
        label = next(
            (
                item
                for item in expectations.expectations
                if item.expectation_id == expectation_id
            ),
            None,
        )
        if label is None:
            return JSONResponse(
                {"detail": {"code": "expectation_not_found"}},
                status_code=404,
                headers=_NO_STORE,
            )
        event = next(item for item in fixture.events if item.event_id == label.event_id)
        _, comparison, summaries = _verified_comparison(fixture, expectations)
        change = next(
            item
            for item in comparison.expectations
            if item.expectation_id == label.expectation_id
        )
        if (change.event_id, change.expected_outcome) != (
            event.event_id,
            label.expected_outcome,
        ):
            raise ValueError("Evidence reference disagrees with the comparison.")
        runs = {}
        for name, summary in zip(("baseline", "candidate"), summaries, strict=True):
            reference = next(
                item
                for item in summary.expectations
                if item.expectation_id == label.expectation_id
            )
            run = getattr(comparison, name)
            classification = getattr(change, f"{name}_classification")
            if (
                (
                    reference.event_id,
                    reference.expected_outcome,
                    reference.classification,
                )
                != (event.event_id, label.expected_outcome, classification)
                or summary.executed_version_id != run.executed_version_id
                or summary.requested_version_id != run.requested_version_id
                or summary.grade_sha256 != run.grade_sha256
            ):
                raise ValueError("Evidence outcome disagrees with the comparison.")
            runs[name] = {
                "requested_version_id": run.requested_version_id,
                "executed_version_id": run.executed_version_id,
                "grade_sha256": run.grade_sha256,
                "observed_outcome": reference.actual_outcome,
                "classification": classification,
                "diagnostic_code": _EVIDENCE_CODES[classification],
            }
        payload = {
            "schema_version": 1,
            "fixture_id": fixture.fixture_id,
            "fixture_sha256": fixture.content_hash,
            "expectations_sha256": expectations.content_sha256,
            "expectation_id": label.expectation_id,
            "source_event_id": event.event_id,
            "source_event_ordinal": event.ordinal,
            "event_time": event.event_time.isoformat(timespec="microseconds").replace(
                "+00:00", "Z"
            ),
            "expected_outcome": label.expected_outcome,
            "change": change.change,
            "comparison_sha256": comparison.comparison_sha256,
            **runs,
        }
        digest = hashlib.sha256(_encode_evidence(payload)).hexdigest()
        canonical = _encode_evidence({**payload, "evidence_sha256": digest})
        if len(canonical) > _MAX_RESPONSE_BYTES:
            raise ValueError("Evidence preview exceeds its response size limit.")
        ExpectationEvidenceResponse.model_validate_json(canonical)
        return Response(canonical, media_type="application/json", headers=_NO_STORE)
    except Exception:
        raise HTTPException(
            status_code=503,
            detail={"code": "evidence_preview_unavailable"},
            headers=_NO_STORE,
        ) from None
