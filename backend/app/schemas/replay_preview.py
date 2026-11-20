from typing import Literal

from pydantic import BaseModel, ConfigDict


class ReplayEvaluationError(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: Literal["missing_field", "invalid_field"]
    field: Literal["event_type", "process_name", "command_line"]


class ReplayPreviewEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_event_id: str
    ordinal: int
    event_time: str
    rule_id: Literal["encoded-powershell"]
    outcome: Literal["match", "no_match", "error"]
    error: ReplayEvaluationError | None


class ReplayPreviewManifest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    manifest_version: Literal[1]
    fixture_id: Literal["synthetic-encoded-powershell"]
    provenance: dict[str, str]
    input_sha256: str
    output_sha256: str
    rule_id: Literal["encoded-powershell"]
    evaluator_contract: Literal["encoded-powershell/v1"]
    status: Literal["completed"]
    event_count: Literal[3]
    match_count: int
    non_match_count: int
    error_count: Literal[0]
    results: list[ReplayPreviewEvent]


class ReplayPreviewVerification(BaseModel):
    status: Literal["verified"]
    reason: None


class ReplayPreviewResponse(BaseModel):
    manifest: ReplayPreviewManifest
    verification: ReplayPreviewVerification
