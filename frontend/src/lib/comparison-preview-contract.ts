import { REPLAY_RULE, REPLAY_SCENARIO } from "./replay-preview-contract";

export const gradeKeys = [
  "true_positive", "true_negative", "false_positive", "false_negative", "evaluation_error", "unsupported",
] as const;
export const changeKeys = ["improved", "regressed", "unchanged", "inconclusive"] as const;
export type Classification = (typeof gradeKeys)[number];
export type Change = (typeof changeKeys)[number];
type Outcome = "match" | "no_match";
type Version = [typeof REPLAY_RULE, string];
type Totals = Record<Classification, number>;
type Run = {
  grade_sha256: string;
  requested_version_id: Version;
  executed_version_id: Version | null;
  passed: boolean;
  labeled_satisfaction: { numerator: number; denominator: 3 } | null;
  totals: Totals;
};
type Expectation = {
  expectation_id: string;
  event_id: string;
  expected_outcome: Outcome;
  baseline_classification: Classification;
  candidate_classification: Classification;
  change: Change;
};
export type Comparison = {
  schema_version: 1;
  fixture_id: typeof REPLAY_SCENARIO;
  fixture_sha256: string;
  expectations_sha256: string;
  authoring_version_id: Version;
  total_events: 3;
  labeled_events: 3;
  unlabeled_events: 0;
  baseline: Run;
  candidate: Run;
  candidate_minus_baseline: Totals;
  change_totals: Record<Change, number>;
  expectations: Expectation[];
  comparison_sha256: string;
};

const evidenceCodes = {
  true_positive: "expected_match_observed",
  true_negative: "expected_non_match_observed",
  false_negative: "expected_detection_missed",
} as const;
type EvidenceClassification = keyof typeof evidenceCodes;
type EvidenceRun = {
  requested_version_id: Version;
  executed_version_id: Version;
  grade_sha256: string;
  observed_outcome: Outcome;
  classification: EvidenceClassification;
  diagnostic_code: (typeof evidenceCodes)[EvidenceClassification];
};
export type Evidence = {
  schema_version: 1;
  fixture_id: typeof REPLAY_SCENARIO;
  fixture_sha256: string;
  expectations_sha256: string;
  expectation_id: string;
  source_event_id: string;
  source_event_ordinal: number;
  event_time: string;
  expected_outcome: Outcome;
  baseline: EvidenceRun;
  candidate: EvidenceRun;
  change: "improved" | "unchanged";
  comparison_sha256: string;
  evidence_sha256: string;
};

type Failure = "unauthenticated" | "forbidden" | "disabled" | "unavailable" | "invalid-response" | "evidence-not-found";
type PreviewState<T> = { status: "idle" | Failure } | { status: "success"; preview: T };
export type ComparisonState = PreviewState<Comparison>;
export type EvidenceState = PreviewState<Evidence>;

// This is the authored reference contract, independent of observed outcomes.
const authored = [
  { expectation_id: "benign-get-date", event_id: "benign-tie", expected_outcome: "no_match" },
  { expectation_id: "benign-get-service", event_id: "benign-later", expected_outcome: "no_match" },
  { expectation_id: "encoded-switch", event_id: "encoded", expected_outcome: "match" },
] as const;

export function isComparisonExpectationId(value: unknown): value is string {
  return authored.some(({ expectation_id }) => expectation_id === value);
}

export function isPreviewDigest(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

export function comparisonFailure(status: number, evidence = false): Failure {
  switch (status) {
    case 401: return "unauthenticated";
    case 403: return "forbidden";
    case 404: return evidence ? "evidence-not-found" : "disabled";
    default: return status >= 500 ? "unavailable" : "invalid-response";
  }
}

function exact(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function version(value: unknown): value is Version {
  return Array.isArray(value) && value.length === 2 && value[0] === REPLAY_RULE && isPreviewDigest(value[1]);
}

function count(value: unknown, min = 0): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= 3;
}

function counts<K extends string>(value: unknown, keys: readonly K[], min = 0): value is Record<K, number> {
  return exact(value, keys) && keys.every((key) => count(value[key], min));
}

function parseRun(value: unknown): Run | null {
  if (!exact(value, ["grade_sha256", "requested_version_id", "executed_version_id", "passed", "labeled_satisfaction", "totals"])) return null;
  const { grade_sha256, requested_version_id, executed_version_id, passed, labeled_satisfaction, totals } = value;
  if (!isPreviewDigest(grade_sha256) || !version(requested_version_id) ||
      (executed_version_id !== null && (!version(executed_version_id) || executed_version_id[1] !== requested_version_id[1])) ||
      !counts(totals, gradeKeys) || typeof passed !== "boolean") return null;
  const numerator = totals.true_positive + totals.true_negative;
  const decisive = numerator + totals.false_positive + totals.false_negative;
  if (passed !== (numerator === 3) || decisive + totals.evaluation_error + totals.unsupported !== 3 ||
      totals.unsupported !== (executed_version_id === null ? 3 : 0)) return null;
  if (decisive === 0 && labeled_satisfaction === null) {
    return { grade_sha256, requested_version_id, executed_version_id, passed, labeled_satisfaction, totals };
  }
  if (decisive === 0 || !exact(labeled_satisfaction, ["numerator", "denominator"]) ||
      labeled_satisfaction.numerator !== numerator || labeled_satisfaction.denominator !== 3) return null;
  return { grade_sha256, requested_version_id, executed_version_id, passed, labeled_satisfaction: { numerator, denominator: 3 }, totals };
}

function classification(value: unknown, expected: Outcome): value is Classification {
  return value === "evaluation_error" || value === "unsupported" ||
    (expected === "match" ? value === "true_positive" || value === "false_negative" :
      value === "true_negative" || value === "false_positive");
}

function changeFor(before: Classification, after: Classification): Change {
  if (before === "evaluation_error" || after === "evaluation_error" || before === "unsupported" || after === "unsupported") {
    return "inconclusive";
  }
  const satisfied = (value: Classification) => value === "true_positive" || value === "true_negative";
  return satisfied(before) === satisfied(after) ? "unchanged" : satisfied(after) ? "improved" : "regressed";
}

export function parseComparison(value: unknown): Comparison | null {
  if (!exact(value, [
    "schema_version", "fixture_id", "fixture_sha256", "expectations_sha256", "authoring_version_id",
    "total_events", "labeled_events", "unlabeled_events", "baseline", "candidate",
    "candidate_minus_baseline", "change_totals", "expectations", "comparison_sha256",
  ])) return null;
  const {
    schema_version, fixture_id, fixture_sha256, expectations_sha256, authoring_version_id,
    total_events, labeled_events, unlabeled_events, candidate_minus_baseline, change_totals, comparison_sha256,
  } = value;
  const baseline = parseRun(value.baseline);
  const candidate = parseRun(value.candidate);
  if (schema_version !== 1 || fixture_id !== REPLAY_SCENARIO || total_events !== 3 || labeled_events !== 3 || unlabeled_events !== 0 ||
      !isPreviewDigest(fixture_sha256) || !isPreviewDigest(expectations_sha256) || !isPreviewDigest(comparison_sha256) ||
      !version(authoring_version_id) || !baseline || !candidate || baseline.requested_version_id[1] === candidate.requested_version_id[1] ||
      !counts(candidate_minus_baseline, gradeKeys, -3) || !counts(change_totals, changeKeys) ||
      !Array.isArray(value.expectations) || value.expectations.length !== authored.length) return null;

  const expectations: Expectation[] = [];
  for (const [index, reference] of authored.entries()) {
    const row: unknown = value.expectations[index];
    if (!exact(row, ["expectation_id", "event_id", "expected_outcome", "baseline_classification", "candidate_classification", "change"]) ||
        row.expectation_id !== reference.expectation_id || row.event_id !== reference.event_id ||
        row.expected_outcome !== reference.expected_outcome ||
        !classification(row.baseline_classification, reference.expected_outcome) ||
        !classification(row.candidate_classification, reference.expected_outcome)) return null;
    const change = changeFor(row.baseline_classification, row.candidate_classification);
    if (row.change !== change) return null;
    expectations.push({ ...reference, baseline_classification: row.baseline_classification, candidate_classification: row.candidate_classification, change });
  }
  for (const key of gradeKeys) {
    if (baseline.totals[key] !== expectations.filter((row) => row.baseline_classification === key).length ||
        candidate.totals[key] !== expectations.filter((row) => row.candidate_classification === key).length ||
        candidate_minus_baseline[key] !== candidate.totals[key] - baseline.totals[key]) return null;
  }
  if (changeKeys.some((key) => change_totals[key] !== expectations.filter((row) => row.change === key).length)) return null;
  return {
    schema_version, fixture_id, fixture_sha256, expectations_sha256, authoring_version_id, total_events, labeled_events,
    unlabeled_events, baseline, candidate, candidate_minus_baseline, change_totals, expectations, comparison_sha256,
  };
}

function parseEvidenceRun(value: unknown, run: Run, expected: Classification): EvidenceRun | null {
  if (!exact(value, ["requested_version_id", "executed_version_id", "grade_sha256", "observed_outcome", "classification", "diagnostic_code"])) return null;
  const { requested_version_id, executed_version_id, grade_sha256, observed_outcome, classification, diagnostic_code } = value;
  if (!version(requested_version_id) || requested_version_id[1] !== run.requested_version_id[1] ||
      !version(executed_version_id) || executed_version_id[1] !== run.executed_version_id?.[1] ||
      !isPreviewDigest(grade_sha256) || grade_sha256 !== run.grade_sha256 || classification !== expected ||
      (classification !== "true_positive" && classification !== "true_negative" && classification !== "false_negative") ||
      (observed_outcome !== "match" && observed_outcome !== "no_match") ||
      observed_outcome !== (classification === "true_positive" ? "match" : "no_match") ||
      diagnostic_code !== evidenceCodes[classification]) return null;
  return { requested_version_id, executed_version_id, grade_sha256, observed_outcome, classification, diagnostic_code: evidenceCodes[classification] };
}

export function parseEvidence(value: unknown, comparison: Comparison, selectedId: string): Evidence | null {
  if (!exact(value, [
    "schema_version", "fixture_id", "fixture_sha256", "expectations_sha256", "expectation_id", "source_event_id",
    "source_event_ordinal", "event_time", "expected_outcome", "baseline", "candidate", "change", "comparison_sha256", "evidence_sha256",
  ])) return null;
  const {
    schema_version, fixture_id, fixture_sha256, expectations_sha256, expectation_id, source_event_id,
    source_event_ordinal, event_time, expected_outcome, change, comparison_sha256, evidence_sha256,
  } = value;
  const row = comparison.expectations.find((item) => item.expectation_id === selectedId);
  if (!row || expectation_id !== row.expectation_id || source_event_id !== row.event_id || expected_outcome !== row.expected_outcome ||
      change !== row.change || (change !== "improved" && change !== "unchanged") ||
      schema_version !== 1 || fixture_id !== comparison.fixture_id || fixture_sha256 !== comparison.fixture_sha256 ||
      expectations_sha256 !== comparison.expectations_sha256 || comparison_sha256 !== comparison.comparison_sha256 ||
      !isPreviewDigest(evidence_sha256) || !count(source_event_ordinal) || source_event_ordinal >= comparison.total_events ||
      typeof event_time !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(event_time)) return null;
  const milliseconds = event_time.slice(0, 23) + "Z";
  const parsedTime = new Date(milliseconds);
  if (!Number.isFinite(parsedTime.valueOf()) || parsedTime.toISOString() !== milliseconds) return null;
  const baseline = parseEvidenceRun(value.baseline, comparison.baseline, row.baseline_classification);
  const candidate = parseEvidenceRun(value.candidate, comparison.candidate, row.candidate_classification);
  if (!baseline || !candidate) return null;
  return {
    schema_version, fixture_id, fixture_sha256, expectations_sha256, expectation_id, source_event_id, source_event_ordinal,
    event_time, expected_outcome: row.expected_outcome, baseline, candidate, change, comparison_sha256, evidence_sha256,
  };
}
