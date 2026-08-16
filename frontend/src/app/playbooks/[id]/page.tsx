import Link from "next/link";
import { notFound } from "next/navigation";

import Sidebar from "@/components/Sidebar";

import {
  getPlaybook,
} from "@/lib/api";

import type {
  PlaybookStep,
} from "@/lib/api";


export default async function PlaybookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } =
    await params;

  const playbook =
    await getPlaybook(id);

  if (!playbook) {
    notFound();
  }

  const sortedSteps =
    [...playbook.steps].sort(
      (
        firstStep,
        secondStep
      ) =>
        firstStep.order
        - secondStep.order
    );

  const categories =
    Array.from(
      new Set(
        sortedSteps.map(
          (step) =>
            step.category
        )
      )
    );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">

      <div className="flex min-h-screen">

        <Sidebar />

        <main className="flex-1 p-10">

          {/* Back */}
          <div className="mb-8">

            <Link
              href="/playbooks"
              className="text-sm text-zinc-500 transition hover:text-zinc-200"
            >
              &larr; Back to Playbooks
            </Link>

          </div>

          {/* Header */}
          <header className="mb-8 flex items-start justify-between gap-8">

            <div className="min-w-0">

              <p className="text-sm text-emerald-400">
                CASE//ZERO / PLAYBOOK
              </p>

              <h2 className="mt-2 text-3xl font-semibold">
                {playbook.name}
              </h2>

              <p className="mt-3 max-w-4xl text-sm leading-6 text-zinc-500">
                {playbook.description}
              </p>

            </div>

            <div className="flex shrink-0 items-center gap-3">

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

            </div>

          </header>

          {/* Overview */}
          <section className="rounded-xl border border-zinc-800 bg-zinc-900">

            <div className="border-b border-zinc-800 px-6 py-5">

              <h3 className="font-medium">
                Playbook Overview
              </h3>

              <p className="mt-1 text-sm text-zinc-500">
                Detection mapping and response procedure metadata.
              </p>

            </div>

            <div className="grid grid-cols-4 gap-8 p-6">

              <OverviewField
                label="Severity"
                value={
                  playbook.severity.toUpperCase()
                }
              />

              <OverviewField
                label="Status"
                value={
                  playbook.enabled
                    ? "ENABLED"
                    : "DISABLED"
                }
              />

              <OverviewField
                label="Response Steps"
                value={String(
                  playbook.steps.length
                )}
              />

              <OverviewField
                label="Categories"
                value={String(
                  categories.length
                )}
              />

            </div>

          </section>

          {/* Trigger Mapping */}
          <section className="mt-6 rounded-xl border border-violet-900/60 bg-zinc-900">

            <div className="border-b border-zinc-800 px-6 py-5">

              <p className="text-xs font-medium uppercase tracking-[0.18em] text-violet-400">
                Detection Mapping
              </p>

              <h3 className="mt-2 font-medium">
                Trigger Rules
              </h3>

              <p className="mt-1 text-sm text-zinc-500">
                Detection rules associated with this response procedure.
              </p>

            </div>

            <div className="p-6">

              <div className="flex flex-wrap gap-3">

                {playbook.trigger_rule_ids.map(
                  (ruleId) => (
                    <Link
                      key={ruleId}
                      href={`/rules/${ruleId}`}
                      className="rounded-lg border border-violet-900 bg-violet-950/50 px-4 py-3 transition hover:bg-violet-900/60"
                    >

                      <p className="text-xs uppercase tracking-wider text-violet-500">
                        Detection Rule
                      </p>

                      <p className="mt-1 text-sm font-medium text-violet-300">
                        {ruleId} &rarr;
                      </p>

                    </Link>
                  )
                )}

              </div>

              <Link
                href="/rules"
                className="mt-5 inline-flex text-sm font-medium text-emerald-400 transition hover:text-emerald-300"
              >
                Review Detection Rules &rarr;
              </Link>

            </div>

          </section>

          {/* Response Workflow */}
          <section className="mt-6 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">

            <div className="flex items-start justify-between gap-6 border-b border-zinc-800 px-6 py-5">

              <div>

                <h3 className="font-medium">
                  Response Workflow
                </h3>

                <p className="mt-1 text-sm text-zinc-500">
                  Ordered analyst procedure for investigating and responding to this detection.
                </p>

              </div>

              <div className="flex flex-wrap justify-end gap-2">

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

            <div className="p-6">

              <div className="space-y-4">

                {sortedSteps.map(
                  (
                    step,
                    index
                  ) => (
                    <ResponseStep
                      key={step.id}
                      step={step}
                      isLast={
                        index
                        ===
                        sortedSteps.length - 1
                      }
                    />
                  )
                )}

              </div>

            </div>

          </section>

          {/* Analyst Resources */}
          <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900">

            <div className="border-b border-zinc-800 px-6 py-5">

              <h3 className="font-medium">
                Analyst Resources
              </h3>

              <p className="mt-1 text-sm text-zinc-500">
                CASE//ZERO tools that can support execution of this playbook.
              </p>

            </div>

            <div className="grid grid-cols-3 gap-4 p-6">

              <ResourceCard
                title="Threat Hunting"
                description="Search related telemetry by user, host, IP address, event type, process, or indicator."
                href="/hunt"
                action="Open Hunt"
              />

              <ResourceCard
                title="Security Events"
                description="Review normalized endpoint and authentication telemetry available to the platform."
                href="/events"
                action="View Events"
              />

              <ResourceCard
                title="Investigation Cases"
                description="Document findings, analyst actions, linked alerts, and investigation activity."
                href="/cases"
                action="View Cases"
              />

            </div>

          </section>

          {/* Metadata */}
          <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6">

            <h3 className="font-medium">
              Technical Metadata
            </h3>

            <p className="mt-1 text-sm text-zinc-500">
              Internal CASE//ZERO playbook identifiers.
            </p>

            <div className="mt-6">

              <p className="text-xs uppercase tracking-wider text-zinc-500">
                Playbook ID
              </p>

              <code className="mt-2 block rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-400">
                {playbook.id}
              </code>

            </div>

          </section>

        </main>

      </div>

    </div>
  );
}


function ResponseStep({
  step,
  isLast,
}: {
  step: PlaybookStep;
  isLast: boolean;
}) {
  return (
    <article className="relative flex gap-5">

      <div className="relative flex w-12 shrink-0 justify-center">

        {!isLast && (
          <div className="absolute bottom-0 top-11 w-px bg-zinc-800" />
        )}

        <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950 text-sm font-semibold text-zinc-300">
          {step.order}
        </div>

      </div>

      <div className="min-w-0 flex-1 pb-6">

        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-5">

          <div className="flex items-start justify-between gap-4">

            <div>

              <p className="text-xs uppercase tracking-wider text-zinc-600">
                Step {step.order}
              </p>

              <h4 className="mt-2 text-base font-medium text-zinc-200">
                {step.title}
              </h4>

            </div>

            <CategoryBadge
              category={
                step.category
              }
            />

          </div>

          <p className="mt-4 max-w-4xl text-sm leading-7 text-zinc-500">
            {step.description}
          </p>

        </div>

      </div>

    </article>
  );
}


function ResourceCard({
  title,
  description,
  href,
  action,
}: {
  title: string;
  description: string;
  href: string;
  action: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-5 transition hover:border-zinc-700 hover:bg-zinc-950"
    >

      <h4 className="text-sm font-medium text-zinc-200">
        {title}
      </h4>

      <p className="mt-2 text-xs leading-5 text-zinc-600">
        {description}
      </p>

      <p className="mt-4 text-sm font-medium text-emerald-400">
        {action} &rarr;
      </p>

    </Link>
  );
}


function OverviewField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>

      <p className="text-xs uppercase tracking-wider text-zinc-500">
        {label}
      </p>

      <p className="mt-2 text-sm font-medium text-zinc-200">
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
      className={`rounded-md border px-3 py-1.5 text-xs font-medium uppercase ${
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
      className={`rounded-md border px-3 py-1.5 text-xs font-medium uppercase ${
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
      className={`rounded-md border px-2.5 py-1 text-xs font-medium uppercase ${
        styles[normalized]
        ?? "border-zinc-700 bg-zinc-800 text-zinc-400"
      }`}
    >
      {category}
    </span>
  );
}