"use server";

import { requestReplayPreview } from "@/lib/api";
import type { ReplayPreviewState } from "@/lib/replay-preview-contract";

export async function runReplayAction(): Promise<ReplayPreviewState> {
  // The API checks the signed-in user's stored role on every run.
  return requestReplayPreview();
}
