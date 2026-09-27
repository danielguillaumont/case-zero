import Link from "next/link";

import Sidebar from "@/components/Sidebar";

import {
  getDetectionRules,
} from "@/lib/api";

import type {
  DetectionRule,
} from "@/lib/api";


export default async function RulesPage() {
  const rules =
    await getDetectionRules();

  const enabledRules =
    rules.filter(
      (rule) => rule.enabled
    );

  const disabledRules =
    rules.filter(
      (rule) => !rule.enabled
    );

  const singleEventRules =
    rules.filter(
      (rule) =>
        rule.rule_type ===
        "single_event"
    );

  const correlationRules =
    rules.filter(
      (rule) =>
        rule.rule_type ===
        "correlation"
    );

  const eventTypes =
    new Set(
      rules
        .map(
          (rule) =>
            rule.event_type
        )
        .filter(Boolean)
    );

  const metrics = [
    {
      label: "Detection rules",
      value: rules.length,
      context:
        `${eventTypes.size} event type${
          eventTypes.size === 1
            ? ""
            : "s"
        } covered`,
      accent: "#c9a965",
    },
    {
      label: "Enabled",
      value: enabledRules.length,
      context:
        disabledRules.length === 0
          ? "All rules evaluating"
          : `${disabledRules.length} disabled`,
      accent: "#63cfa4",
    },
    {
      label: "Single event",
      value: singleEventRules.length,
      context:
        "Direct telemetry evaluation",
      accent: "#69c5d7",
    },
    {
      label: "Correlation",
      value: correlationRules.length,
      context:
        "Multi-event detection logic",
      accent: "#b58b61",
    },
  ];

  return (
    <div className="min-h-screen text-[#f1f4f7]">
      <div className="flex min-h-screen">
        <Sidebar />

        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-[1700px] px-8 py-8 xl:px-10 xl:py-10">

            {/* Header */}
            <header className="mb-7 flex items-start justify-between gap-8">
              <div className="min-w-0">
                <div className="mb-3 flex items-center gap-3">
                  <span className="text-[12px] font-semibold text-[#c9a965]">
                    Security Operations
                  </span>

                  <span className="h-px w-8 bg-[#c9a965]/40" />

                  <span className="text-[11px] text-[#667583]">
                    Detection Engineering
                  </span>
                </div>

                <h1 className="text-[34px] font-semibold tracking-[-0.04em] text-[#f4f6f8]">
                  Detection Rules
                </h1>

                <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[#81909c]">
                  Review the detection logic,
                  telemetry coverage, severity,
                  correlation strategy, and
                  response mappings evaluated by
                  the CASE//ZERO detection engine.
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-3 pt-1">
                <HeaderStatus
                  label="Engine"
                  value="Operational"
                  active
                />

                <HeaderStatus
                  label="Catalog"
                  value={`${rules.length} ${
                    rules.length === 1
                      ? "rule"
                      : "rules"
                  }`}
                />
              </div>
            </header>

            <div className="h-px bg-gradient-to-r from-[#c9a965]/60 via-[#24323e] to-transparent" />

            {/* Rule posture */}
            <section className="mt-7">
              <div className="mb-3 flex items-end justify-between gap-6">
                <div>
                  <h2 className="text-[14px] font-medium text-[#dce3e8]">
                    Detection posture
                  </h2>

                  <p className="mt-1 text-[11px] text-[#657481]">
                    Current detection-engine
                    coverage and evaluation state
                  </p>
                </div>

                <p className="text-[10px] text-[#5e6d79]">
                  {enabledRules.length} active
                  {" · "}
                  {disabledRules.length} disabled
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                {metrics.map(
                  (metric) => (
                    <MetricCard
                      key={metric.label}
                      label={metric.label}
                      value={metric.value}
                      context={metric.context}
                      accent={metric.accent}
                    />
                  )
                )}
              </div>
            </section>

            {/* Detection catalog */}
            <section className="mt-5 overflow-hidden rounded-[14px] border border-[#1d2a35] bg-[#0b141d]/95 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
              <div className="flex items-center justify-between gap-6 border-b border-[#1d2a35] px-6 py-5">
                <div className="flex items-start gap-3">
                  <span className="mt-1.5 h-2 w-2 rounded-full bg-[#c9a965]" />

                  <div>
                    <h2 className="text-[15px] font-semibold text-[#e8edf1]">
                      Detection catalog
                    </h2>

                    <p className="mt-1 text-[11px] text-[#667582]">
                      Detection logic currently
                      evaluated against normalized
                      CASE//ZERO telemetry.
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-[11px] font-medium text-[#d8e0e6]">
                    {rules.length}{" "}
                    {rules.length === 1
                      ? "rule"
                      : "rules"}
                  </p>

                  <p className="mt-1 text-[9px] uppercase tracking-[0.12em] text-[#4f5e6b]">
                    Detection Engine
                  </p>
                </div>
              </div>

              {rules.length === 0 ? (
                <div className="flex min-h-64 items-center justify-center px-6 py-16">
                  <div className="text-center">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-[#263541] bg-[#0d1720] text-[#71818e]">
                      0
                    </div>

                    <p className="mt-4 text-[13px] font-medium text-[#d8e0e6]">
                      No detection rules available
                    </p>

                    <p className="mt-2 text-[11px] text-[#667582]">
                      Rules exposed by the
                      CASE//ZERO API will appear
                      here.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="min-w-[1120px]">

                    {/* Table header */}
                    <div className="grid grid-cols-[140px_minmax(360px,1fr)_160px_140px_210px_90px] gap-5 border-b border-[#1b2833] bg-[#08111a]/70 px-6 py-3">
                      <span className="cz-table-head">
                        State
                      </span>

                      <span className="cz-table-head">
                        Detection
                      </span>

                      <span className="cz-table-head">
                        Rule type
                      </span>

                      <span className="cz-table-head">
                        Severity
                      </span>

                      <span className="cz-table-head">
                        Event coverage
                      </span>

                      <span className="cz-table-head text-right">
                        Record
                      </span>
                    </div>

                    <div className="divide-y divide-[#1b2833]">
                      {rules.map(
                        (rule) => (
                          <DetectionRuleRow
                            key={rule.id}
                            rule={rule}
                          />
                        )
                      )}
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}


function HeaderStatus({
  label,
  value,
  active = false,
}: {
  label: string;
  value: string;
  active?: boolean;
}) {
  return (
    <div
      className={`rounded-[10px] border px-4 py-3 ${
        active
          ? "border-[#63cfa4]/20 bg-[#63cfa4]/[0.045]"
          : "border-[#1f2c36] bg-[#0a121a]/75"
      }`}
    >
      <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#62717e]">
        {label}
      </p>

      <div className="mt-1 flex items-center gap-2">
        {active && (
          <span className="h-2 w-2 rounded-full bg-[#63cfa4] shadow-[0_0_10px_rgba(99,207,164,0.3)]" />
        )}

        <p
          className={`text-[11px] font-medium ${
            active
              ? "text-[#84d8b7]"
              : "text-[#d7dee4]"
          }`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}


function MetricCard({
  label,
  value,
  context,
  accent,
}: {
  label: string;
  value: number;
  context: string;
  accent: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-[14px] border border-[#1e2c37] bg-gradient-to-b from-[#101b25] to-[#0c151e] p-5 shadow-[0_14px_35px_rgba(0,0,0,0.14)]">
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background:
            `linear-gradient(90deg, ${accent}, transparent 68%)`,
        }}
      />

      <div className="flex items-center justify-between">
        <p className="text-[12px] font-medium text-[#8996a1]">
          {label}
        </p>

        <span
          className="h-1.5 w-6 rounded-full"
          style={{
            background: accent,
            opacity: 0.72,
          }}
        />
      </div>

      <p className="mt-4 text-[38px] font-semibold leading-none tracking-[-0.05em] text-[#f3f5f7]">
        {value}
      </p>

      <p className="mt-4 text-[11px] text-[#657481]">
        {context}
      </p>
    </div>
  );
}


function DetectionRuleRow({
  rule,
}: {
  rule: DetectionRule;
}) {
  return (
    <Link
      href={`/rules/${rule.id}`}
      className="group grid grid-cols-[140px_minmax(360px,1fr)_160px_140px_210px_90px] items-center gap-5 px-6 py-5 transition duration-150 hover:bg-[#101b25]/80"
    >
      <div>
        <EnabledBadge
          enabled={rule.enabled}
        />
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <p className="truncate text-[13px] font-semibold text-[#e6ebef] transition group-hover:text-white">
            {rule.name}
          </p>
        </div>

        <p className="mt-1.5 truncate text-[10px] leading-5 text-[#64727e]">
          {rule.description}
        </p>

        <p className="mt-1 truncate font-mono text-[9px] text-[#4e606d]">
          {rule.logic}
        </p>
      </div>

      <div>
        <RuleTypeBadge
          ruleType={rule.rule_type}
        />
      </div>

      <div>
        <SeverityBadge
          severity={rule.severity}
        />
      </div>

      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium text-[#bcc7cf]">
          {formatLabel(
            rule.event_type
          )}
        </p>

        <p className="mt-1 text-[8px] uppercase tracking-[0.1em] text-[#4d5d69]">
          Normalized event
        </p>
      </div>

      <div className="text-right">
        <span className="inline-flex items-center gap-2 text-[11px] font-medium text-[#c9a965] transition group-hover:text-[#e3c779]">
          Inspect
          <span aria-hidden="true">
            →
          </span>
        </span>
      </div>
    </Link>
  );
}


function SeverityBadge({
  severity,
}: {
  severity: string;
}) {
  const normalized =
    severity.toLowerCase();

  const styles: Record<
    string,
    string
  > = {
    low:
      "border-[#69c5d7]/25 bg-[#69c5d7]/[0.07] text-[#8bd4e0]",

    medium:
      "border-[#c9a965]/30 bg-[#c9a965]/[0.07] text-[#ddc37e]",

    high:
      "border-[#dc9259]/30 bg-[#dc9259]/[0.075] text-[#eba36c]",

    critical:
      "border-[#e06d72]/30 bg-[#e06d72]/[0.075] text-[#ef8b90]",
  };

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.05em] ${
        styles[normalized]
        ?? "border-[#34414c] bg-[#141d25] text-[#8b98a3]"
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-90" />
      {severity}
    </span>
  );
}


function RuleTypeBadge({
  ruleType,
}: {
  ruleType: string;
}) {
  const correlation =
    ruleType === "correlation";

  return (
    <span
      className={`inline-flex rounded-md border px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.05em] ${
        correlation
          ? "border-[#69c5d7]/25 bg-[#69c5d7]/[0.06] text-[#8bd4e0]"
          : "border-[#c9a965]/25 bg-[#c9a965]/[0.06] text-[#d8bd76]"
      }`}
    >
      {formatLabel(ruleType)}
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
      className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.05em] ${
        enabled
          ? "border-[#63cfa4]/25 bg-[#63cfa4]/[0.06] text-[#83d8b7]"
          : "border-[#34414c] bg-[#141d25] text-[#75838f]"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          enabled
            ? "bg-[#63cfa4]"
            : "bg-[#64727e]"
        }`}
      />

      {enabled
        ? "Enabled"
        : "Disabled"}
    </span>
  );
}


function formatLabel(
  value: string
) {
  return value
    .replaceAll("_", " ")
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase()
    );
}