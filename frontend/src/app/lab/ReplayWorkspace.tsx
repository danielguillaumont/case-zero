"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  REPLAY_RULE,
  REPLAY_SCENARIO,
  type ReplayPreview,
  type ReplayPreviewState,
} from "@/lib/replay-preview-contract";
import { runReplayAction } from "./actions";

const failures = {
  unauthenticated: "Your session is missing or has expired. Sign in to run a replay.",
  forbidden: "Only active analysts and administrators can run a replay.",
  disabled: "Replay preview is disabled. Check the local frontend and API preview flags.",
  unavailable: "The replay preview API is unavailable or could not verify the run. Try again.",
  "invalid-response": "The API returned an unexpected replay response.",
};

const outcomes = {
  match: { label: "Match", style: "border-[var(--cz-cyan)]/25 bg-[var(--cz-cyan-soft)] text-[var(--cz-cyan-bright)]" },
  no_match: { label: "No match", style: "border-[var(--cz-border-strong)] text-[var(--cz-text-soft)]" },
  error: { label: "Evaluation error", style: "border-[var(--cz-danger)]/25 bg-[var(--cz-danger)]/10 text-[var(--cz-danger)]" },
};

export default function ReplayWorkspace({ canRun }: { canRun: boolean }) {
  const [state, run, pending] = useActionState<ReplayPreviewState, FormData>(runReplayAction, { status: "idle" });

  return (
    <div className="space-y-5">
      <section className="cz-panel p-5 sm:p-6" aria-labelledby="scenario-title">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="min-w-0">
            <h2 id="scenario-title" className="text-base font-semibold">Encoded PowerShell</h2>
            <dl className="mt-3 grid gap-x-5 gap-y-2 text-xs sm:grid-cols-[auto_minmax(0,1fr)]">
              <dt className="text-[var(--cz-text-muted)]">Synthetic scenario</dt>
              <dd className="break-all font-mono text-[var(--cz-text-soft)]">{REPLAY_SCENARIO}</dd>
              <dt className="text-[var(--cz-text-muted)]">Rule</dt>
              <dd className="break-all font-mono text-[var(--cz-cyan-bright)]">{REPLAY_RULE}</dd>
            </dl>
          </div>
          {canRun ? (
            <form action={run}>
              <button
                type="submit"
                disabled={pending}
                className="cz-focus-ring rounded-lg border border-[var(--cz-gold)]/40 bg-[var(--cz-gold-soft)] px-4 py-2.5 text-sm font-semibold text-[var(--cz-gold-bright)] hover:bg-[var(--cz-gold)]/20 disabled:cursor-wait disabled:opacity-60"
              >
                {pending ? "Running replay…" : "Run replay"}
              </button>
            </form>
          ) : (
            <p className="text-sm text-[var(--cz-text-muted)]">{failures.forbidden}</p>
          )}
        </div>
      </section>

      <div aria-live="polite" aria-busy={pending}>
        {pending ? (
          <p className="cz-panel-muted p-4 text-sm text-[var(--cz-cyan-bright)]">Evaluating the synthetic fixture…</p>
        ) : state.status === "success" ? (
          <ReplayResults preview={state.preview} />
        ) : state.status !== "idle" ? (
          <div role="alert" className="cz-panel-muted border-[var(--cz-warning)]/30 p-4 text-sm text-[var(--cz-text-soft)]">
            {failures[state.status]}
            {state.status === "unauthenticated" && (
              <Link href="/login" className="cz-focus-ring ml-2 rounded text-[var(--cz-cyan-bright)] underline">
                Sign in
              </Link>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ReplayResults({ preview }: { preview: ReplayPreview }) {
  const { manifest, verification } = preview;
  const metrics = [
    ["Events", manifest.event_count],
    ["Matches", manifest.match_count],
    ["No matches", manifest.non_match_count],
    ["Evaluation errors", manifest.error_count],
  ] as const;

  return (
    <div className="space-y-5">
      <section className="cz-panel" aria-labelledby="results-title">
        <div className="border-b border-[var(--cz-border)] p-5 sm:p-6">
          <h2 id="results-title" className="text-base font-semibold">Replay results</h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
            {metrics.map(([label, count]) => (
              <div key={label} className="cz-panel-muted px-4 py-3">
                <dt className="text-xs text-[var(--cz-text-muted)]">{label}</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums">{count}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[13px]">
            <caption className="sr-only">Event decisions in replay order</caption>
            <thead className="text-xs text-[var(--cz-text-muted)]">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium sm:px-6">Source event</th>
                <th scope="col" className="px-4 py-3 font-medium">Input ordinal</th>
                <th scope="col" className="px-4 py-3 font-medium">Event time (UTC)</th>
                <th scope="col" className="px-4 py-3 font-medium">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {manifest.results.map((event) => (
                <tr key={event.source_event_id} className="border-t border-[var(--cz-border)]">
                  <th scope="row" className="break-all px-5 py-3 text-left font-mono font-medium sm:px-6">
                    {event.source_event_id}
                  </th>
                  <td className="px-4 py-3 font-mono text-[var(--cz-text-soft)]">{event.ordinal}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-[var(--cz-text-muted)]">
                    <time dateTime={event.event_time}>{event.event_time}</time>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block whitespace-nowrap rounded-md border px-2 py-1 text-xs ${outcomes[event.outcome].style}`}>
                      {outcomes[event.outcome].label}
                    </span>
                    {event.error && <p className="mt-1 break-all text-xs text-[var(--cz-text-muted)]">{event.error.code} · {event.error.field}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="cz-panel p-5 sm:p-6" aria-labelledby="evidence-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="evidence-title" className="text-base font-semibold">Replay evidence</h2>
          {verification.status === "verified" && (
            <span className="rounded-md border border-[var(--cz-success)]/30 bg-[var(--cz-success)]/10 px-2.5 py-1 text-xs font-medium text-[var(--cz-success)]">
              Evidence verified
            </span>
          )}
        </div>
        <dl className="mt-4 grid gap-4 text-xs xl:grid-cols-2">
          <div>
            <dt className="mb-1 text-[var(--cz-text-muted)]">Input SHA-256</dt>
            <dd className="break-all font-mono text-[var(--cz-text-soft)]">{manifest.input_sha256}</dd>
          </div>
          <div>
            <dt className="mb-1 text-[var(--cz-text-muted)]">Output SHA-256</dt>
            <dd className="break-all font-mono text-[var(--cz-text-soft)]">{manifest.output_sha256}</dd>
          </div>
          <div>
            <dt className="mb-1 text-[var(--cz-text-muted)]">Evaluator contract</dt>
            <dd className="font-mono text-[var(--cz-cyan-bright)]">{manifest.evaluator_contract}</dd>
          </div>
          <div>
            <dt className="mb-1 text-[var(--cz-text-muted)]">Provenance</dt>
            <dd className="text-[var(--cz-text-soft)]">
              {manifest.provenance.source}
              {manifest.provenance.description && ` · ${manifest.provenance.description}`}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
