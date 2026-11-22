"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { changeKeys, gradeKeys, type Comparison, type ComparisonState, type Evidence, type EvidenceState } from "@/lib/comparison-preview-contract";
import { REPLAY_RULE, REPLAY_SCENARIO } from "@/lib/replay-preview-contract";
import { inspectEvidenceAction, runComparisonAction } from "./actions";

const failures = {
  unauthenticated: "Your session is missing or has expired.",
  forbidden: "Only active analysts and administrators can use the comparison preview.",
  disabled: "Comparison preview is disabled. Check the local frontend and API preview flags.",
  unavailable: "The comparison preview could not load. Try again.",
  "invalid-response": "The API response did not match the preview contract. Run the comparison again.",
  "evidence-not-found": "Evidence for this expectation is unavailable. Run the comparison again.",
};

const classifications = {
  true_positive: "True positive",
  true_negative: "True negative",
  false_positive: "False positive",
  false_negative: "False negative",
  evaluation_error: "Evaluation error",
  unsupported: "Unsupported",
};

const metrics = {
  true_positive: "TP", true_negative: "TN", false_positive: "FP", false_negative: "FN",
  evaluation_error: "Errors", unsupported: "Unsupported",
};

const changes = { improved: "Improved", regressed: "Regressed", unchanged: "Unchanged", inconclusive: "Inconclusive" };
const explanations = {
  expected_match_observed: "The executed version matched the expected detection.",
  expected_non_match_observed: "The executed version did not match, as expected.",
  expected_detection_missed: "The executed version did not match an expected detection.",
};
const primaryButton = "cz-focus-ring rounded-lg border border-[var(--cz-gold)]/40 bg-[var(--cz-gold-soft)] px-4 py-2.5 text-sm font-semibold text-[var(--cz-gold-bright)] hover:bg-[var(--cz-gold)]/20 disabled:opacity-60";
const evidenceButton = "cz-focus-ring rounded-md border border-[var(--cz-cyan)]/30 bg-[var(--cz-cyan-soft)] px-3 py-2 text-xs font-semibold text-[var(--cz-cyan-bright)] hover:border-[var(--cz-cyan)] disabled:opacity-60";

function Outcome({ value }: { value: "match" | "no_match" }) {
  return value === "match" ? "Match" : "No match";
}

function Digest({ label, value }: { label: string; value: string }) {
  return (
    <details className="min-w-0">
      <summary className="cz-focus-ring cursor-pointer rounded text-[var(--cz-cyan-bright)]">
        {label} <span className="font-mono">{value.slice(0, 12)}…</span>
      </summary>
      <code className="mt-1 block break-all text-[var(--cz-text-soft)]">{value}</code>
    </details>
  );
}

function FailureMessage({ status }: { status: keyof typeof failures }) {
  return (
    <p role="alert" className="cz-panel-muted p-4 text-sm text-[var(--cz-text-soft)]">
      {failures[status]}
      {status === "unauthenticated" && (
        <Link href="/login" className="cz-focus-ring ml-2 rounded text-[var(--cz-cyan-bright)] underline">Sign in</Link>
      )}
    </p>
  );
}

export default function ComparisonWorkspace({ canRun }: { canRun: boolean }) {
  const [state, run, pending] = useActionState<ComparisonState, FormData>(runComparisonAction, { status: "idle" });
  return (
    <section className="space-y-5" aria-labelledby="comparison-title">
      <header className="cz-panel flex flex-wrap items-center justify-between gap-5 p-5 sm:p-6">
        <div className="min-w-0">
          <h2 id="comparison-title" className="text-lg font-semibold">Detection comparison</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--cz-text-soft)]">
            Compare two versions of a detection against the same authored expectations on bundled synthetic data.
          </p>
          <dl className="mt-3 grid gap-x-5 gap-y-2 text-xs sm:grid-cols-[auto_minmax(0,1fr)]">
            <dt className="text-[var(--cz-text-muted)]">Scenario</dt>
            <dd className="break-all font-mono text-[var(--cz-text-soft)]">{REPLAY_SCENARIO}</dd>
            <dt className="text-[var(--cz-text-muted)]">Rule</dt>
            <dd className="break-all font-mono text-[var(--cz-cyan-bright)]">{REPLAY_RULE}</dd>
          </dl>
        </div>
        {canRun ? (
          <form action={run}>
            <button type="submit" disabled={pending} className={primaryButton}>
              {pending ? "Running comparison…" : "Run comparison"}
            </button>
          </form>
        ) : <p className="max-w-xs text-sm text-[var(--cz-text-muted)]">{failures.forbidden}</p>}
      </header>
      {canRun && (
        <div role="status" aria-live="polite" className="text-sm text-[var(--cz-text-soft)]">
          {pending ? "Comparing the two rule versions…" :
            state.status === "idle" ? "Run the comparison to inspect the three authored expectations." :
            state.status === "success" ? "Comparison ready." : ""}
        </div>
      )}
      {!pending && canRun && (state.status === "success" ? (
        <ComparisonResults key={state.preview.comparison_sha256} comparison={state.preview} />
      ) : state.status !== "idle" ? <FailureMessage status={state.status} /> : null)}
    </section>
  );
}

export function ComparisonResults({ comparison }: { comparison: Comparison }) {
  const [evidence, inspect, pending] = useActionState(
    inspectEvidenceAction.bind(null, comparison.comparison_sha256), { status: "idle" } as EvidenceState,
  );
  const [selected, setSelected] = useState<string>();
  return (
    <div className="space-y-5">
      <section className="cz-panel p-5 sm:p-6" aria-labelledby="versions-title">
        <h3 id="versions-title" className="font-semibold">Rule versions</h3>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {(["baseline", "candidate"] as const).map((side) => {
            const run = comparison[side];
            return (
              <article key={side} className="cz-panel-muted min-w-0 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold">{side === "baseline" ? "Weakened baseline" : "Corrected candidate"}</h4>
                  <span className={run.passed ? "text-sm font-semibold text-[var(--cz-success)]" : "text-sm font-semibold text-[var(--cz-danger)]"}>
                    {run.passed ? "Pass" : "Fail"}
                  </span>
                </div>
                <p className="mt-3 text-lg font-semibold tabular-nums">
                  {run.labeled_satisfaction ? `${run.labeled_satisfaction.numerator}/${run.labeled_satisfaction.denominator} labels satisfied` : "Labeled satisfaction unavailable"}
                </p>
                <dl className="my-4 grid grid-cols-3 gap-x-3 gap-y-3 text-xs">
                  {gradeKeys.map((key) => (
                    <div key={key}>
                      <dt className="text-[var(--cz-text-muted)]" title={classifications[key]}>{metrics[key]}</dt>
                      <dd className="mt-1 text-base font-semibold tabular-nums">{run.totals[key]}</dd>
                    </div>
                  ))}
                </dl>
                <div className="text-xs"><Digest label="Requested version SHA-256" value={run.requested_version_id[1]} /></div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="cz-panel p-5 sm:p-6" aria-labelledby="regression-title">
        <h3 id="regression-title" className="font-semibold">Regression summary</h3>
        <p className="mt-2 text-sm text-[var(--cz-text-soft)]">
          {comparison.labeled_events} authored expectations across {comparison.total_events} events · {comparison.unlabeled_events} unlabeled
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {changeKeys.map((key) => (
            <div key={key} className="cz-panel-muted p-3">
              <dt className="text-xs text-[var(--cz-text-muted)]">{changes[key]}</dt>
              <dd className={`mt-1 text-xl font-semibold tabular-nums ${changeColor(key)}`}>{comparison.change_totals[key]}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="cz-panel" aria-labelledby="expectation-title">
        <h3 id="expectation-title" className="p-5 font-semibold sm:px-6">Expectation results</h3>
        <form action={inspect}>
          <div className="cz-focus-ring overflow-x-auto" tabIndex={0} role="region" aria-label="Scrollable expectation results table">
            <table className="w-full min-w-[640px] text-left text-sm">
              <caption className="sr-only">Baseline and candidate outcomes for each authored expectation</caption>
              <thead className="text-xs text-[var(--cz-text-muted)]">
                <tr>
                  {["Expectation", "Baseline", "Candidate", "Change", "Evidence"].map((heading) => (
                    <th scope="col" key={heading} className="px-4 pb-3 font-medium">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparison.expectations.map((row) => (
                  <tr key={row.expectation_id} className={`border-t border-[var(--cz-border)] ${selected === row.expectation_id ? "bg-[var(--cz-cyan-soft)]" : ""}`}>
                    <th scope="row" className="px-4 py-3 text-xs font-medium">
                      <span className="font-mono">{row.expectation_id}</span>
                      <span className="mt-1 block text-[var(--cz-text-muted)]">Expected: <Outcome value={row.expected_outcome} /></span>
                    </th>
                    <td className={`px-4 py-3 ${classificationColor(row.baseline_classification)}`}>{classifications[row.baseline_classification]}</td>
                    <td className={`px-4 py-3 ${classificationColor(row.candidate_classification)}`}>{classifications[row.candidate_classification]}</td>
                    <td className={`px-4 py-3 font-medium ${changeColor(row.change)}`}>{changes[row.change]}</td>
                    <td className="px-4 py-3">
                      <button type="submit" name="expectation" value={row.expectation_id}
                        aria-label={`Inspect evidence for ${row.expectation_id}`} aria-controls="comparison-evidence"
                        aria-pressed={selected === row.expectation_id} disabled={pending}
                        onClick={() => setSelected(row.expectation_id)} className={evidenceButton}>
                        Inspect evidence
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </form>
      </section>

      <section id="comparison-evidence" className="cz-panel p-5 sm:p-6" aria-labelledby="comparison-evidence-title" aria-busy={pending}>
        <h3 id="comparison-evidence-title" className="font-semibold">Evidence investigation</h3>
        <div role="status" aria-live="polite" className="mt-2 text-sm text-[var(--cz-text-soft)]">
          {pending ? "Loading selected evidence…" : evidence.status === "idle" ? "Select an expectation to inspect its evidence." :
            evidence.status === "success" ? `Evidence loaded for ${evidence.preview.expectation_id}.` : ""}
        </div>
        {!pending && evidence.status !== "idle" && (evidence.status === "success" ?
          <EvidenceDetails evidence={evidence.preview} /> : <FailureMessage status={evidence.status} />)}
      </section>
    </div>
  );
}

function changeColor(value: keyof typeof changes) {
  if (value === "improved") return "text-[var(--cz-success)]";
  if (value === "regressed") return "text-[var(--cz-danger)]";
  return "text-[var(--cz-text-soft)]";
}

function classificationColor(value: keyof typeof classifications) {
  return value === "false_negative" || value === "false_positive" ? "text-[var(--cz-danger)]" : "text-[var(--cz-text-soft)]";
}

export function EvidenceDetails({ evidence }: { evidence: Evidence }) {
  return (
    <div className="mt-4 space-y-4">
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-[var(--cz-text-muted)]">Expectation</dt><dd className="break-all font-mono">{evidence.expectation_id}</dd></div>
        <div><dt className="text-[var(--cz-text-muted)]">Source event</dt><dd className="break-all font-mono">{evidence.source_event_id} · Ordinal {evidence.source_event_ordinal}</dd></div>
        <div><dt className="text-[var(--cz-text-muted)]">Event time (UTC)</dt><dd><time dateTime={evidence.event_time} className="break-all font-mono text-xs">{evidence.event_time}</time></dd></div>
        <div><dt className="text-[var(--cz-text-muted)]">Expected outcome</dt><dd><Outcome value={evidence.expected_outcome} /></dd></div>
      </dl>
      <div className="grid gap-3 lg:grid-cols-2">
        {(["baseline", "candidate"] as const).map((side) => {
          const run = evidence[side];
          return (
            <article key={side} className="cz-panel-muted min-w-0 space-y-2 p-4 text-xs text-[var(--cz-text-soft)]">
              <h4 className="text-sm font-semibold">{side === "baseline" ? "Baseline evidence" : "Candidate evidence"}</h4>
              <p>Observed: <Outcome value={run.observed_outcome} /> · {classifications[run.classification]}</p>
              <p>{explanations[run.diagnostic_code]} <code className="break-all">{run.diagnostic_code}</code></p>
              <p className="font-mono">{run.requested_version_id[0]}</p>
              <Digest label="Requested version SHA-256" value={run.requested_version_id[1]} />
              <Digest label="Executed version SHA-256" value={run.executed_version_id[1]} />
            </article>
          );
        })}
      </div>
      <div className="space-y-2 text-xs">
        <p className="text-[var(--cz-text-muted)]">Backend-supplied evidence identities</p>
        <Digest label="Parent comparison SHA-256" value={evidence.comparison_sha256} />
        <Digest label="Evidence SHA-256" value={evidence.evidence_sha256} />
      </div>
    </div>
  );
}
