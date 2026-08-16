import Link from "next/link";

import Sidebar from "@/components/Sidebar";

import {
  getPlaybooks,
} from "@/lib/api";

import type {
  Playbook,
  PlaybookStep,
} from "@/lib/api";


export default async function PlaybooksPage() {
  const playbooks =
    await getPlaybooks();

  const enabledPlaybooks =
    playbooks.filter(
      (playbook) =>
        playbook.enabled
    );

  const totalSteps =
    playbooks.reduce(
      (
        total,
        playbook
      ) =>
        total
        + playbook.steps.length,
      0
    );

  const coveredRules =
    new Set(
      playbooks.flatMap(
        (playbook) =>
          playbook.trigger_rule_ids
      )
    );

  const metrics = [
    {
      label: "Playbooks",
      value: playbooks.length,
    },
    {
      label: "Enabled",
      value:
        enabledPlaybooks.length,
    },
    {
      label: "Response Steps",
      value: totalSteps,
    },
    {
      label: "Rules Covered",
      value: coveredRules.size,
    },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">

      <div className="flex min-h-screen">

        <Sidebar />

        <main className="flex-1 p-10">

          {/* Header */}
          <header className="mb-10 flex items-start justify-between gap-6">

            <div>

              <p className="text-sm text-emerald-400">
                CASE//ZERO
              </p>

              <h2 className="mt-1 text-3xl font-semibold">
                Incident Response Playbooks
              </h2>

              <p className="mt-2 text-sm text-zinc-500">
                Standardized investigation and response procedures mapped to CASE//ZERO detections.
              </p>

            </div>

            <div className="rounded-full border border-emerald-900 bg-emerald-950 px-4 py-2 text-sm text-emerald-400">
              Response Library Active
            </div>

          </header>

          {/* Overview */}
          <section>

            <p className="mb-4 text-xs uppercase tracking-[0.15em] text-zinc-500">
              Playbook Overview
            </p>

            <div className="grid grid-cols-4 gap-4">

              {metrics.map(
                (metric) => (
                  <MetricCard
                    key={metric.label}
                    label={
                      metric.label
                    }
                    value={
                      metric.value
                    }
                  />
                )
              )}

            </div>

          </section>

          {/* Playbook Catalog */}
          <section className="mt-8">

            <div className="mb-5 flex items-end justify-between">

              <div>

                <h3 className="font-medium">
                  Response Library
                </h3>

                <p className="mt-1 text-sm text-zinc-500">
                  Available procedures for investigating and responding to detected security activity.
                </p>

              </div>

              <p className="text-xs text-zinc-500">
                {playbooks.length}{" "}
                {playbooks.length === 1
                  ? "playbook"
                  : "playbooks"}
              </p>

            </div>

            {playbooks.length === 0 ? (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-6 py-16 text-center">

                <p className="text-sm font-medium text-zinc-300">
                  No playbooks available
                </p>

                <p className="mt-2 text-sm text-zinc-500">
                  Incident response playbooks exposed by the CASE//ZERO API will appear here.
                </p>

              </div>
            ) : (
              <div className="space-y-6">

                {playbooks.map(
                  (playbook) => (
                    <PlaybookCard
                      key={
                        playbook.id
                      }
                      playbook={
                        playbook
                      }
                    />
                  )
                )}

              </div>
            )}

          </section>

        </main>

      </div>

    </div>
  );
}


function MetricCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">

      <p className="text-sm text-zinc-500">
        {label}
      </p>

      <p className="mt-3 text-3xl font-semibold">
        {value}
      </p>

    </div>
  );
}


function PlaybookCard({
  playbook,
}: {
  playbook: Playbook;
}) {
  const categories =
    Array.from(
      new Set(
        playbook.steps.map(
          (step) =>
            step.category
        )
      )
    );

  const sortedSteps =
    [...playbook.steps].sort(
      (
        firstStep,
        secondStep
      ) =>
        firstStep.order
        - secondStep.order
    );

  return (
    <article className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">

      {/* Playbook Header */}
      <div className="border-b border-zinc-800 p-6">

        <div className="flex items-start justify-between gap-8">

          <div className="min-w-0 flex-1">

            <div className="flex flex-wrap items-center gap-3">

              <SeverityBadge
                severity={
                  playbook.severity
                }
              />

              <EnabledBadge
                enabled={
                  playbook.enabled
                }
              />

              <span className="rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs font-medium uppercase text-zinc-400">
                {playbook.steps.length} Steps
              </span>

            </div>

            <h4 className="mt-4 text-xl font-medium text-zinc-100">
              {playbook.name}
            </h4>

            <p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-500">
              {playbook.description}
            </p>

            <Link
              href={`/playbooks/${playbook.id}`}
              className="mt-5 inline-flex rounded-lg border border-emerald-800 bg-emerald-950 px-4 py-2.5 text-sm font-medium text-emerald-400 transition hover:bg-emerald-900"
            >
              Open Playbook →
            </Link>

          </div>

          <div className="w-72 shrink-0 rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">

            <MetadataField
              label="Playbook ID"
              value={
                playbook.id
              }
            />

            <div className="mt-4">

              <p className="text-xs uppercase tracking-wider text-zinc-600">
                Trigger Rules
              </p>

              <div className="mt-2 flex flex-wrap gap-2">

                {playbook.trigger_rule_ids.map(
                  (ruleId) => (
                    <span
                      key={ruleId}
                      className="rounded-md border border-violet-900 bg-violet-950 px-2.5 py-1 text-xs text-violet-400"
                    >
                      {ruleId}
                    </span>
                  )
                )}

              </div>

            </div>

          </div>

        </div>

      </div>

      {/* Response Workflow */}
      <div className="p-6">

        <div className="flex items-center justify-between">

          <div>

            <p className="text-xs uppercase tracking-[0.15em] text-zinc-500">
              Response Workflow
            </p>

            <p className="mt-1 text-sm text-zinc-600">
              Ordered investigation and response procedure
            </p>

          </div>

          <div className="flex flex-wrap gap-2">

            {categories.map(
              (category) => (
                <CategoryBadge
                  key={category}
                  category={
                    category
                  }
                />
              )
            )}

          </div>

        </div>

        <div className="mt-6 grid grid-cols-3 gap-4">

          {sortedSteps.map(
            (step) => (
              <PlaybookStepPreview
                key={step.id}
                step={step}
              />
            )
          )}

        </div>

      </div>

    </article>
  );
}


function PlaybookStepPreview({
  step,
}: {
  step: PlaybookStep;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">

      <div className="flex items-center justify-between gap-3">

        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-xs font-semibold text-zinc-300">
          {step.order}
        </div>

        <CategoryBadge
          category={
            step.category
          }
        />

      </div>

      <h5 className="mt-4 text-sm font-medium text-zinc-200">
        {step.title}
      </h5>

      <p className="mt-2 text-xs leading-5 text-zinc-600">
        {step.description}
      </p>

    </div>
  );
}


function MetadataField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>

      <p className="text-xs uppercase tracking-wider text-zinc-600">
        {label}
      </p>

      <p className="mt-1 break-words text-sm text-zinc-300">
        {value}
      </p>

    </div>
  );
}


function SeverityBadge({
  severity,
}: {
  severity: string;
}) {
  const styles: Record<
    string,
    string
  > = {
    low:
      "border-blue-900 bg-blue-950 text-blue-400",

    medium:
      "border-yellow-900 bg-yellow-950 text-yellow-400",

    high:
      "border-orange-900 bg-orange-950 text-orange-400",

    critical:
      "border-red-900 bg-red-950 text-red-400",
  };

  const normalized =
    severity.toLowerCase();

  return (
    <span
      className={`rounded-md border px-2.5 py-1 text-xs font-medium uppercase ${
        styles[normalized]
        ?? "border-zinc-700 bg-zinc-800 text-zinc-400"
      }`}
    >
      {severity}
    </span>
  );
}


function EnabledBadge({
  enabled,
}: {
  enabled: boolean;
}) {
  return (
    <span
      className={`rounded-md border px-2.5 py-1 text-xs font-medium uppercase ${
        enabled
          ? "border-emerald-900 bg-emerald-950 text-emerald-400"
          : "border-zinc-700 bg-zinc-800 text-zinc-500"
      }`}
    >
      {enabled
        ? "Enabled"
        : "Disabled"}
    </span>
  );
}


function CategoryBadge({
  category,
}: {
  category: string;
}) {
  const styles: Record<
    string,
    string
  > = {
    triage:
      "border-blue-900 bg-blue-950 text-blue-400",

    investigation:
      "border-violet-900 bg-violet-950 text-violet-400",

    containment:
      "border-orange-900 bg-orange-950 text-orange-400",

    eradication:
      "border-red-900 bg-red-950 text-red-400",

    recovery:
      "border-emerald-900 bg-emerald-950 text-emerald-400",

    documentation:
      "border-cyan-900 bg-cyan-950 text-cyan-400",
  };

  const normalized =
    category.toLowerCase();

  return (
    <span
      className={`rounded-md border px-2 py-1 text-[10px] font-medium uppercase tracking-wide ${
        styles[normalized]
        ?? "border-zinc-700 bg-zinc-800 text-zinc-400"
      }`}
    >
      {category}
    </span>
  );
}