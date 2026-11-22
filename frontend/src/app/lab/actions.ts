"use server";

import { requestComparisonPreview, requestExpectationEvidence, requestReplayPreview } from "@/lib/api";
import type { ComparisonState, EvidenceState } from "@/lib/comparison-preview-contract";
import type { ReplayPreviewState } from "@/lib/replay-preview-contract";

export async function runReplayAction(): Promise<ReplayPreviewState> {
  // The API checks the signed-in user's stored role on every run.
  return requestReplayPreview();
}

export async function runComparisonAction(): Promise<ComparisonState> {
  return requestComparisonPreview();
}

export async function inspectEvidenceAction(
  comparisonDigest: string, _previous: EvidenceState, formData: FormData,
): Promise<EvidenceState> {
  return requestExpectationEvidence(formData.get("expectation"), comparisonDigest);
}
