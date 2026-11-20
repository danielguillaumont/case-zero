export const REPLAY_SCENARIO = "synthetic-encoded-powershell";
export const REPLAY_RULE = "encoded-powershell";

type ReplayOutcome = "match" | "no_match" | "error";

type ReplayEvent = {
  source_event_id: string;
  ordinal: number;
  event_time: string;
  rule_id: typeof REPLAY_RULE;
  outcome: ReplayOutcome;
  error: { code: string; field: string } | null;
};

export type ReplayPreview = {
  manifest: {
    manifest_version: 1;
    fixture_id: typeof REPLAY_SCENARIO;
    provenance: { source: string; description?: string };
    input_sha256: string;
    output_sha256: string;
    rule_id: typeof REPLAY_RULE;
    evaluator_contract: "encoded-powershell/v1";
    status: "completed";
    event_count: number;
    match_count: number;
    non_match_count: number;
    error_count: 0;
    results: ReplayEvent[];
  };
  verification: { status: "verified"; reason: null };
};

type ReplayFailure = "unauthenticated" | "forbidden" | "disabled" | "unavailable" | "invalid-response";

export type ReplayPreviewState =
  | { status: "idle" }
  | { status: ReplayFailure }
  | { status: "success"; preview: ReplayPreview };

export function canRunReplay(role: string): boolean {
  return role === "analyst" || role === "administrator";
}

export function replayPreviewEnabled(environment: string | undefined, flag: string | undefined): boolean {
  return environment === "development" && flag === "true";
}

export function replayFailure(status: number): ReplayFailure {
  switch (status) {
    case 401: return "unauthenticated";
    case 403: return "forbidden";
    case 404: return "disabled";
    case 503: return "unavailable";
    default: return status >= 500 ? "unavailable" : "invalid-response";
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function digest(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

function parseEvent(value: unknown): ReplayEvent | null {
  if (!record(value)) return null;
  const { source_event_id, ordinal, event_time, rule_id, outcome, error } = value;
  if (typeof source_event_id !== "string" || !source_event_id ||
      typeof ordinal !== "number" || !Number.isInteger(ordinal) || ordinal < 0 ||
      typeof event_time !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(event_time) ||
      rule_id !== REPLAY_RULE || (outcome !== "match" && outcome !== "no_match" && outcome !== "error")) {
    return null;
  }

  if (outcome === "error") {
    if (!record(error) || (error.code !== "missing_field" && error.code !== "invalid_field") ||
        (error.field !== "event_type" && error.field !== "process_name" && error.field !== "command_line")) {
      return null;
    }
    return { source_event_id, ordinal, event_time, rule_id, outcome, error: { code: error.code, field: error.field } };
  }
  return error === null ? { source_event_id, ordinal, event_time, rule_id, outcome, error } : null;
}

export function parseReplayPreview(value: unknown): ReplayPreview | null {
  if (!record(value) || !record(value.manifest) || !record(value.verification)) return null;
  const { manifest, verification } = value;
  const {
    manifest_version, fixture_id, provenance, input_sha256, output_sha256, rule_id,
    evaluator_contract, status, event_count, match_count, non_match_count, error_count, results,
  } = manifest;
  if (manifest_version !== 1 || fixture_id !== REPLAY_SCENARIO || rule_id !== REPLAY_RULE ||
      evaluator_contract !== "encoded-powershell/v1" || status !== "completed" ||
      verification.status !== "verified" || verification.reason !== null ||
      !digest(input_sha256) || !digest(output_sha256) ||
      !record(provenance) || typeof provenance.source !== "string" ||
      (provenance.description !== undefined && typeof provenance.description !== "string") ||
      !Array.isArray(results) || event_count !== 3 || results.length !== event_count || error_count !== 0) {
    return null;
  }

  const events: ReplayEvent[] = [];
  const counts: Record<ReplayOutcome, number> = { match: 0, no_match: 0, error: 0 };
  const ids = new Set<string>();
  const ordinals = new Set<number>();
  for (const result of results) {
    const parsed = parseEvent(result);
    const previous = events.at(-1);
    if (!parsed || ids.has(parsed.source_event_id) || ordinals.has(parsed.ordinal) ||
        parsed.ordinal >= event_count ||
        (previous && (previous.event_time > parsed.event_time ||
          (previous.event_time === parsed.event_time && previous.ordinal >= parsed.ordinal)))) {
      return null;
    }
    events.push(parsed);
    ids.add(parsed.source_event_id);
    ordinals.add(parsed.ordinal);
    counts[parsed.outcome]++;
  }
  if (match_count !== counts.match || non_match_count !== counts.no_match || error_count !== counts.error) {
    return null;
  }

  return {
    manifest: {
      manifest_version, fixture_id, input_sha256, output_sha256, rule_id, evaluator_contract, status,
      provenance: { source: provenance.source, description: provenance.description },
      event_count, match_count, non_match_count, error_count, results: events,
    },
    verification: { status: "verified", reason: null },
  };
}
