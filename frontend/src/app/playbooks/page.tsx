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

  const categories =
    new Set(
      playbooks.flatMap(
        (playbook) =>
          playbook.steps.map(
            (step) =>
              step.category
          )
      )
    );

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
                    Response Engineering
                  </span>

                </div>

                <h1 className="text-[34px] font-semibold tracking-[-0.04em] text-[#f4f6f8]">
                  Incident Response Playbooks
                </h1>

                <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[#81909c]">
                  Standardized analyst procedures for triage,
                  investigation, containment, recovery, and
                  documentation across CASE//ZERO detections.
                </p>

              </div>

              <div className="flex shrink-0 items-center gap-3 pt-1">

                <HeaderStatus
                  label="Library"
                  value="Operational"
                  accent="#63cfa4"
                  showDot
                />

                <HeaderStatus
                  label="Catalog"
                  value={`${playbooks.length} playbooks`}
                  accent="#c9a965"
                />

              </div>

            </header>

            <div className="mb-7 h-px bg-gradient-to-r from-[#c9a965]/55 via-[#23313e] to-transparent" />

            {/* Overview */}
            <section>

              <div className="mb-3 flex items-end justify-between">

                <div>

                  <h2 className="text-[14px] font-medium text-[#dce3e8]">
                    Response posture
                  </h2>

                  <p className="mt-1 text-[11px] text-[#657481]">
                    Current response-library coverage and workflow state
                  </p>

                </div>

                <p className="text-[10px] text-[#5e6d79]">
                  {enabledPlaybooks.length} active ·{" "}
                  {playbooks.length - enabledPlaybooks.length} disabled
                </p>

              </div>

              <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">

                <MetricCard
                  label="Playbooks"
                  value={playbooks.length}
                  context={`${categories.size} response categories`}
                  accent="#c9a965"
                />

                <MetricCard
                  label="Enabled"
                  value={enabledPlaybooks.length}
                  context={
                    playbooks.length > 0
                      ? `${Math.round(
                          (
                            enabledPlaybooks.length
                            / playbooks.length
                          )
                          * 100
                        )}% currently active`
                      : "No response procedures"
                  }
                  accent="#63cfa4"
                />

                <MetricCard
                  label="Response steps"
                  value={totalSteps}
                  context="Ordered analyst actions"
                  accent="#69c5d7"
                />

                <MetricCard
                  label="Rules mapped"
                  value={coveredRules.size}
                  context="Detection-to-response mappings"
                  accent="#7d96bf"
                />

              </div>

            </section>

            {/* Library */}
            <section className="mt-5 overflow-hidden rounded-[14px] border border-[#22303c] bg-[#0c151f]/95">

              <div className="flex items-start justify-between gap-6 border-b border-[#22303c] px-6 py-5">

                <div className="flex items-start gap-3">

                  <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-[#d8b85e]" />

                  <div>

                    <h2 className="text-[15px] font-semibold text-[#e8edf1]">
                      Response library
                    </h2>

                    <p className="mt-1 text-[11px] text-[#677684]">
                      Detection-mapped investigation and response procedures
                      available to CASE//ZERO analysts.
                    </p>

                  </div>

                </div>

                <div className="text-right">

                  <p className="text-[11px] font-semibold text-[#cbd3da]">
                    {playbooks.length}{" "}
                    {playbooks.length === 1
                      ? "playbook"
                      : "playbooks"}
                  </p>

                  <p className="mt-1 text-[9px] uppercase tracking-[0.13em] text-[#536270]">
                    Response catalog
                  </p>

                </div>

              </div>

              {playbooks.length === 0 ? (
                <div className="flex min-h-[280px] items-center justify-center px-6 py-16">

                  <div className="max-w-md text-center">

                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-[#2b3945] bg-[#101a24] text-[#6fc8d5]">
                      0
                    </div>

                    <h3 className="mt-4 text-[14px] font-medium text-[#dce3e8]">
                      No response playbooks available
                    </h3>

                    <p className="mt-2 text-[12px] leading-6 text-[#657481]">
                      Incident response procedures exposed through
                      the CASE//ZERO API will appear here.
                    </p>

                  </div>

                </div>
              ) : (
                <div className="divide-y divide-[#22303c]">

                  {playbooks.map(
                    (playbook) => (
                      <PlaybookRecord
                        key={playbook.id}
                        playbook={playbook}
                      />
                    )
                  )}

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
  accent,
  showDot = false,
}: {
  label: string;
  value: string;
  accent: string;
  showDot?: boolean;
}) {
  return (
    <div className="min-w-[108px] rounded-[10px] border border-[#22303c] bg-[#0c151f]/80 px-4 py-3">

      <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#647380]">
        {label}
      </p>

      <div className="mt-1.5 flex items-center gap-2">

        {showDot && (
          <span
            className="h-2 w-2 rounded-full"
            style={{
              background: accent,
              boxShadow:
                `0 0 12px ${accent}45`,
            }}
          />
        )}

        <p
          className="text-[11px] font-medium"
          style={{
            color:
              showDot
                ? accent
                : "#dce3e8",
          }}
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
    <div className="relative overflow-hidden rounded-[14px] border border-[#23313e] bg-[#0e1822]/95 p-5">

      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background:
            `linear-gradient(90deg, ${accent}, transparent 72%)`,
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


function PlaybookRecord({
  playbook,
}: {
  playbook: Playbook;
}) {
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

  const severityTone =
    getSeverityTone(
      playbook.severity
    );

  return (
    <article className="bg-[#0c151f]/55 transition hover:bg-[#0e1822]/80">

      {/* Playbook identity */}
      <div className="grid gap-6 px-6 py-6 xl:grid-cols-[minmax(0,1fr)_270px]">

        <div className="min-w-0">

          <div className="flex flex-wrap items-center gap-2">

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

            <span className="rounded-[6px] border border-[#2a3743] bg-[#09121a] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-[#83909b]">
              {playbook.steps.length} steps
            </span>

            <span className="rounded-[6px] border border-[#2a3743] bg-[#09121a] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-[#83909b]">
              {categories.length} phases
            </span>

          </div>

          <div className="mt-4 flex items-start justify-between gap-8">

            <div className="min-w-0">

              <Link
                href={`/playbooks/${playbook.id}`}
                className="inline-flex text-[18px] font-semibold tracking-[-0.02em] text-[#eef2f5] transition hover:text-[#dcc178]"
              >
                {playbook.name}
              </Link>

              <p className="mt-2 max-w-4xl text-[12px] leading-6 text-[#778692]">
                {playbook.description}
              </p>

            </div>

            <Link
              href={`/playbooks/${playbook.id}`}
              className="hidden shrink-0 items-center gap-2 rounded-[8px] border border-[#4b432e] bg-[#c9a965]/[0.05] px-4 py-2.5 text-[11px] font-semibold text-[#d8bc74] transition hover:border-[#6d5d36] hover:bg-[#c9a965]/[0.09] xl:inline-flex"
            >
              Open runbook
              <span aria-hidden>
                →
              </span>
            </Link>

          </div>

        </div>

        <div className="rounded-[10px] border border-[#22303c] bg-[#09121a]/80 p-4">

          <MetadataField
            label="Playbook ID"
            value={
              playbook.id
            }
          />

          <div className="mt-4 border-t border-[#202d38] pt-4">

            <div className="flex items-center justify-between">

              <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#5f6f7d]">
                Trigger rules
              </p>

              <span className="text-[10px] text-[#8b98a3]">
                {playbook.trigger_rule_ids.length}
              </span>

            </div>

            {playbook.trigger_rule_ids.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">

                {playbook.trigger_rule_ids.map(
                  (ruleId) => (
                    <Link
                      key={ruleId}
                      href={`/rules/${ruleId}`}
                      className="rounded-[6px] border border-[#32414e] bg-[#101a24] px-2.5 py-1 text-[9px] font-medium text-[#9fb3c3] transition hover:border-[#c9a965]/40 hover:text-[#d7bd7a]"
                    >
                      {ruleId}
                    </Link>
                  )
                )}

              </div>
            ) : (
              <p className="mt-2 text-[11px] text-[#596875]">
                No rules mapped
              </p>
            )}

          </div>

          <div className="mt-4 border-t border-[#202d38] pt-4">

            <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#5f6f7d]">
              Response priority
            </p>

            <div className="mt-2 flex items-center gap-2">

              <span
                className="h-2 w-2 rounded-full"
                style={{
                  background:
                    severityTone.accent,
                }}
              />

              <p
                className="text-[11px] font-medium"
                style={{
                  color:
                    severityTone.text,
                }}
              >
                {formatLabel(
                  playbook.severity
                )}
              </p>

            </div>

          </div>

        </div>

      </div>

      {/* Workflow */}
      <div className="border-t border-[#22303c] bg-[#09121a]/35 px-6 py-5">

        <div className="flex flex-wrap items-end justify-between gap-4">

          <div>

            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6b7b88]">
              Response workflow
            </p>

            <p className="mt-1 text-[11px] text-[#586875]">
              Ordered analyst runbook from initial triage through closure.
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

        {sortedSteps.length === 0 ? (
          <div className="mt-5 rounded-[10px] border border-dashed border-[#293743] px-5 py-8 text-center">

            <p className="text-[11px] text-[#667582]">
              No response steps configured.
            </p>

          </div>
        ) : (
          <div className="mt-5 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">

            {sortedSteps.map(
              (step) => (
                <PlaybookStepPreview
                  key={step.id}
                  step={step}
                />
              )
            )}

          </div>
        )}

        <div className="mt-5 flex justify-end xl:hidden">

          <Link
            href={`/playbooks/${playbook.id}`}
            className="inline-flex items-center gap-2 rounded-[8px] border border-[#4b432e] bg-[#c9a965]/[0.05] px-4 py-2.5 text-[11px] font-semibold text-[#d8bc74]"
          >
            Open runbook
            <span aria-hidden>
              →
            </span>
          </Link>

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
  const categoryTone =
    getCategoryTone(
      step.category
    );

  return (
    <div className="group relative overflow-hidden rounded-[10px] border border-[#22303c] bg-[#0c151f] p-4 transition hover:border-[#31404d] hover:bg-[#101a24]">

      <div
        className="absolute bottom-0 left-0 top-0 w-[2px]"
        style={{
          background:
            categoryTone.accent,
          opacity: 0.8,
        }}
      />

      <div className="flex items-center justify-between gap-4">

        <div className="flex items-center gap-3">

          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold"
            style={{
              borderColor:
                `${categoryTone.accent}45`,
              background:
                `${categoryTone.accent}10`,
              color:
                categoryTone.text,
            }}
          >
            {step.order}
          </div>

          <CategoryBadge
            category={
              step.category
            }
          />

        </div>

        <span className="text-[9px] font-medium uppercase tracking-[0.1em] text-[#52616e]">
          Step {step.order}
        </span>

      </div>

      <h3 className="mt-4 text-[12px] font-semibold text-[#dfe5e9]">
        {step.title}
      </h3>

      <p className="mt-2 line-clamp-3 text-[10px] leading-5 text-[#687783]">
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

      <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#5f6f7d]">
        {label}
      </p>

      <p className="mt-1.5 break-words font-mono text-[10px] leading-5 text-[#bac4cc]">
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
  const tone =
    getSeverityTone(
      severity
    );

  return (
    <span
      className="inline-flex items-center gap-2 rounded-[6px] border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.08em]"
      style={{
        borderColor:
          `${tone.accent}50`,
        background:
          `${tone.accent}0c`,
        color:
          tone.text,
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{
          background:
            tone.accent,
        }}
      />

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
      className={`inline-flex items-center gap-2 rounded-[6px] border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] ${
        enabled
          ? "border-[#63cfa4]/30 bg-[#63cfa4]/[0.06] text-[#7dd6b4]"
          : "border-[#647380]/25 bg-[#647380]/[0.05] text-[#7d8994]"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          enabled
            ? "bg-[#63cfa4]"
            : "bg-[#647380]"
        }`}
      />

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
  const tone =
    getCategoryTone(
      category
    );

  return (
    <span
      className="rounded-[6px] border px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.08em]"
      style={{
        borderColor:
          `${tone.accent}45`,
        background:
          `${tone.accent}0d`,
        color:
          tone.text,
      }}
    >
      {formatLabel(
        category
      )}
    </span>
  );
}


function getSeverityTone(
  severity: string
) {
  const normalized =
    severity.toLowerCase();

  const tones: Record<
    string,
    {
      accent: string;
      text: string;
    }
  > = {
    low: {
      accent: "#69c5d7",
      text: "#8fd5df",
    },
    medium: {
      accent: "#d8b85e",
      text: "#e2c97d",
    },
    high: {
      accent: "#d89258",
      text: "#e7aa74",
    },
    critical: {
      accent: "#d66b70",
      text: "#e58b8f",
    },
  };

  return (
    tones[normalized]
    ?? {
      accent: "#71808d",
      text: "#a2adb6",
    }
  );
}


function getCategoryTone(
  category: string
) {
  const normalized =
    category.toLowerCase();

  const tones: Record<
    string,
    {
      accent: string;
      text: string;
    }
  > = {
    triage: {
      accent: "#6f96c8",
      text: "#91add2",
    },
    investigation: {
      accent: "#8e77c9",
      text: "#a995dc",
    },
    containment: {
      accent: "#d89258",
      text: "#e4a66f",
    },
    eradication: {
      accent: "#d66b70",
      text: "#e58b8f",
    },
    recovery: {
      accent: "#63cfa4",
      text: "#84d8b7",
    },
    documentation: {
      accent: "#69c5d7",
      text: "#8fd5df",
    },
  };

  return (
    tones[normalized]
    ?? {
      accent: "#71808d",
      text: "#9aa6b0",
    }
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