from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

Sha256 = Annotated[str, StringConstraints(pattern=r"^[0-9a-f]{64}$")]
InvestigationId = Annotated[
    str, StringConstraints(pattern=r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$")
]
VersionId = tuple[Literal["encoded-powershell"], Sha256]
Count = Annotated[int, Field(ge=0, le=3)]
Delta = Annotated[int, Field(ge=-3, le=3)]
Classification = Literal[
    "true_positive",
    "true_negative",
    "false_positive",
    "false_negative",
    "evaluation_error",
    "unsupported",
]


class _PreviewModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class ComparisonDeltas(_PreviewModel):
    true_positive: Delta
    true_negative: Delta
    false_positive: Delta
    false_negative: Delta
    evaluation_error: Delta
    unsupported: Delta


class ComparisonTotals(ComparisonDeltas):
    true_positive: Count
    true_negative: Count
    false_positive: Count
    false_negative: Count
    evaluation_error: Count
    unsupported: Count


class ComparisonSatisfaction(_PreviewModel):
    numerator: Count
    denominator: Literal[3]


class ComparisonRun(_PreviewModel):
    grade_sha256: Sha256
    requested_version_id: VersionId
    executed_version_id: VersionId | None
    totals: ComparisonTotals
    passed: bool
    labeled_satisfaction: ComparisonSatisfaction | None


class ComparisonChanges(_PreviewModel):
    improved: Count
    regressed: Count
    unchanged: Count
    inconclusive: Count


class ComparisonExpectation(_PreviewModel):
    expectation_id: InvestigationId
    event_id: InvestigationId
    expected_outcome: Literal["match", "no_match"]
    baseline_classification: Classification
    candidate_classification: Classification
    change: Literal["improved", "regressed", "unchanged", "inconclusive"]


class ComparisonPreviewResponse(_PreviewModel):
    schema_version: Literal[1]
    fixture_id: Literal["synthetic-encoded-powershell"]
    fixture_sha256: Sha256
    expectations_sha256: Sha256
    authoring_version_id: VersionId
    total_events: Literal[3]
    labeled_events: Literal[3]
    unlabeled_events: Literal[0]
    baseline: ComparisonRun
    candidate: ComparisonRun
    candidate_minus_baseline: ComparisonDeltas
    change_totals: ComparisonChanges
    expectations: Annotated[
        list[ComparisonExpectation], Field(min_length=3, max_length=3)
    ]
    comparison_sha256: Sha256
