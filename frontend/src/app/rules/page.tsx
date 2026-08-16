import Link from "next/link";

import Sidebar from "@/components/Sidebar";

import {
  getDetectionRules,
} from "@/lib/api";

import type {
  DetectionRule,
} from "@/lib/api";


export default async function RulesPage() {
  const rules = await getDetectionRules();

  const enabledRules = rules.filter(
    (rule) => rule.enabled
  );

  const singleEventRules = rules.filter(
    (rule) =>
      rule.rule_type === "single_event"
  );

  const correlationRules = rules.filter(
    (rule) =>
      rule.rule_type === "correlation"
  );

  const metrics = [
    {
      label: "Total Rules",
      value: rules.length,
    },
    {
      label: "Enabled",
      value: enabledRules.length,
    },
    {
      label: "Single Event",
      value: singleEventRules.length,
    },
    {
      label: "Correlation",
      value: correlationRules.length,
    },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">

      <div className="flex min-h-screen">

        <Sidebar />

        <main className="flex-1 p-10">

          <header className="mb-10 flex items-center justify-between">

            <div>

              <p className="text-sm text-emerald-400">
                CASE//ZERO
              </p>

              <h2 className="mt-1 text-3xl font-semibold">
                Detection Rules
              </h2>

              <p className="mt-2 text-sm text-zinc-500">
                Review active single-event and correlation detections.
              </p>

            </div>

            <div className="rounded-full border border-emerald-900 bg-emerald-950 px-4 py-2 text-sm text-emerald-400">
              Detection Engine Active
            </div>

          </header>

          <section>

            <h3 className="mb-4 text-sm font-medium uppercase tracking-wider text-zinc-500">
              Rule Overview
            </h3>

            <div className="grid grid-cols-4 gap-4">

              {metrics.map(
                (metric) => (
                  <div
                    key={metric.label}
                    className="rounded-xl border border-zinc-800 bg-zinc-900 p-6"
                  >

                    <p className="text-sm text-zinc-500">
                      {metric.label}
                    </p>

                    <p className="mt-3 text-3xl font-semibold">
                      {metric.value}
                    </p>

                  </div>
                )
              )}

            </div>

          </section>

          <section className="mt-8 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">

            <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-5">

              <div>

                <h3 className="font-medium">
                  Detection Catalog
                </h3>

                <p className="mt-1 text-sm text-zinc-500">
                  Detection logic currently evaluated by CASE//ZERO.
                </p>

              </div>

              <span className="text-xs text-zinc-500">
                {rules.length}{" "}
                {rules.length === 1
                  ? "rule"
                  : "rules"}
              </span>

            </div>

            {rules.length === 0 ? (
              <div className="px-6 py-16 text-center">

                <p className="text-sm font-medium text-zinc-300">
                  No detection rules available
                </p>

                <p className="mt-2 text-sm text-zinc-500">
                  Detection rules exposed by the CASE//ZERO API will appear here.
                </p>

              </div>
            ) : (
              <div className="divide-y divide-zinc-800">

                {rules.map(
                  (rule) => (
                    <DetectionRuleRow
                      key={rule.id}
                      rule={rule}
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


function DetectionRuleRow({
  rule,
}: {
  rule: DetectionRule;
}) {
  return (
    <article className="px-6 py-6 transition hover:bg-zinc-800/30">

      <div className="flex items-start justify-between gap-8">

        <div className="min-w-0 flex-1">

          <div className="flex flex-wrap items-center gap-3">

            <SeverityBadge
              severity={rule.severity}
            />

            <RuleTypeBadge
              ruleType={rule.rule_type}
            />

            <EnabledBadge
              enabled={rule.enabled}
            />

          </div>

          <Link
            href={`/rules/${rule.id}`}
            className="mt-4 inline-flex text-lg font-medium text-zinc-100 transition hover:text-emerald-400"
          >
            {rule.name}
          </Link>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
            {rule.description}
          </p>

          <div className="mt-5 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-4">

            <p className="text-xs uppercase tracking-wider text-zinc-600">
              Detection Logic
            </p>

            <p className="mt-2 text-sm leading-6 text-zinc-300">
              {rule.logic}
            </p>

          </div>

          <Link
            href={`/rules/${rule.id}`}
            className="mt-5 inline-flex rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-emerald-800 hover:bg-emerald-950 hover:text-emerald-400"
          >
            View Rule Details &rarr;
          </Link>

        </div>

        <div className="w-56 shrink-0 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">

          <MetadataField
            label="Rule ID"
            value={rule.id}
          />

          <div className="mt-4">

            <MetadataField
              label="Event Type"
              value={rule.event_type.replaceAll(
                "_",
                " "
              )}
            />

          </div>

        </div>

      </div>

    </article>
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
  const normalizedSeverity =
    severity.toLowerCase();

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

  return (
    <span
      className={`rounded-md border px-2.5 py-1 text-xs font-medium uppercase ${
        styles[
          normalizedSeverity
        ] ??
        "border-zinc-700 bg-zinc-800 text-zinc-400"
      }`}
    >
      {severity}
    </span>
  );
}


function RuleTypeBadge({
  ruleType,
}: {
  ruleType: string;
}) {
  const isCorrelation =
    ruleType === "correlation";

  return (
    <span
      className={`rounded-md border px-2.5 py-1 text-xs font-medium uppercase ${
        isCorrelation
          ? "border-violet-900 bg-violet-950 text-violet-400"
          : "border-blue-900 bg-blue-950 text-blue-400"
      }`}
    >
      {ruleType.replaceAll(
        "_",
        " "
      )}
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