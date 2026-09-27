import Link from "next/link";

import {
  notFound,
} from "next/navigation";

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
  params: Promise<{
    id: string;
  }>;
}) {
  const { id } =
    await params;

  const playbook =
    await getPlaybook(
      id
    );

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

  const severityTone =
    getSeverityTone(
      playbook.severity
    );

  return (
    <div className="min-h-screen text-[#f1f4f7]">

      <div className="flex min-h-screen">

        <Sidebar />

        <main className="min-w-0 flex-1">

          <div className="mx-auto w-full max-w-[1700px] px-8 py-8 xl:px-10 xl:py-10">

            {/* Breadcrumb */}
            <div className="mb-5 flex items-center gap-2 text-[10px]">

              <Link
                href="/playbooks"
                className="font-medium text-[#d8dfe5] transition hover:text-[#dcc178]"
              >
                Response Playbooks
              </Link>

              <span className="text-[#465562]">
                /
              </span>

              <span className="text-[#657481]">
                Runbook
              </span>

            </div>

            {/* Header */}
            <header className="flex items-start justify-between gap-8">

              <div className="min-w-0">

                <div className="mb-3 flex items-center gap-3">

                  <span className="text-[12px] font-semibold text-[#c9a965]">
                    Security Operations
                  </span>

                  <span className="h-px w-8 bg-[#c9a965]/40" />

                  <span className="text-[11px] text-[#667583]">
                    Response Orchestration
                  </span>

                </div>

                <div className="flex flex-wrap items-center gap-3">

                  <h1 className="text-[34px] font-semibold tracking-[-0.04em] text-[#f4f6f8]">
                    {playbook.name}
                  </h1>

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

                <p className="mt-3 max-w-4xl text-[13px] leading-6 text-[#81909c]">
                  {playbook.description}
                </p>

              </div>

              <div className="flex shrink-0 items-center gap-3 pt-1">

                <HeaderStatus
                  label="Response engine"
                  value={
                    playbook.enabled
                      ? "Ready"
                      : "Disabled"
                  }
                  accent={
                    playbook.enabled
                      ? "#63cfa4"
                      : "#71808d"
                  }
                  showDot
                />

                <HeaderStatus
                  label="Workflow"
                  value={`${sortedSteps.length} steps`}
                  accent="#c9a965"
                />

              </div>

            </header>

            <div className="my-7 h-px bg-gradient-to-r from-[#c9a965]/55 via-[#23313e] to-transparent" />

            {/* Snapshot */}
            <section>

              <div className="mb-3 flex items-end justify-between">

                <div>

                  <h2 className="text-[14px] font-medium text-[#dce3e8]">
                    Runbook snapshot
                  </h2>

                  <p className="mt-1 text-[11px] text-[#657481]">
                    Response configuration, workflow scope, and detection mapping
                  </p>

                </div>

                <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-[#52616e]">
                  {playbook.id}
                </p>

              </div>

              <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">

                <SnapshotCard
                  label="Severity"
                  value={
                    formatLabel(
                      playbook.severity
                    )
                  }
                  context="Incident response priority"
                  accent={
                    severityTone.accent
                  }
                />

                <SnapshotCard
                  label="Engine state"
                  value={
                    playbook.enabled
                      ? "Enabled"
                      : "Disabled"
                  }
                  context={
                    playbook.enabled
                      ? "Available to analysts"
                      : "Procedure currently inactive"
                  }
                  accent={
                    playbook.enabled
                      ? "#63cfa4"
                      : "#71808d"
                  }
                />

                <SnapshotCard
                  label="Response steps"
                  value={
                    String(
                      sortedSteps.length
                    )
                  }
                  context={`${categories.length} workflow phases`}
                  accent="#69c5d7"
                />

                <SnapshotCard
                  label="Trigger rules"
                  value={
                    String(
                      playbook.trigger_rule_ids.length
                    )
                  }
                  context="Mapped detections"
                  accent="#c9a965"
                />

              </div>

            </section>

            {/* Main workspace */}
            <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">

              <div className="space-y-5">

                {/* Response workflow */}
                <section className="overflow-hidden rounded-[14px] border border-[#22303c] bg-[#0c151f]/95">

                  <div className="flex flex-wrap items-start justify-between gap-5 border-b border-[#22303c] px-6 py-5">

                    <div className="flex items-start gap-3">

                      <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-[#69c5d7]" />

                      <div>

                        <h2 className="text-[15px] font-semibold text-[#e8edf1]">
                          Response workflow
                        </h2>

                        <p className="mt-1 text-[11px] text-[#677684]">
                          Ordered analyst procedure for investigating,
                          containing, and documenting this detection.
                        </p>

                      </div>

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

                  {sortedSteps.length === 0 ? (
                    <div className="px-6 py-16 text-center">

                      <p className="text-[12px] text-[#677684]">
                        No response steps are configured for this playbook.
                      </p>

                    </div>
                  ) : (
                    <div className="px-6 py-6">

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
                  )}

                </section>

                {/* Detection mappings */}
                <section className="overflow-hidden rounded-[14px] border border-[#22303c] bg-[#0c151f]/95">

                  <div className="flex items-start justify-between gap-5 border-b border-[#22303c] px-6 py-5">

                    <div className="flex items-start gap-3">

                      <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-[#d8b85e]" />

                      <div>

                        <h2 className="text-[15px] font-semibold text-[#e8edf1]">
                          Detection mapping
                        </h2>

                        <p className="mt-1 text-[11px] text-[#677684]">
                          Detection rules capable of invoking this response procedure.
                        </p>

                      </div>

                    </div>

                    <span className="rounded-[6px] border border-[#2a3743] bg-[#09121a] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-[#778692]">
                      {playbook.trigger_rule_ids.length} mapped
                    </span>

                  </div>

                  <div className="p-6">

                    {playbook.trigger_rule_ids.length === 0 ? (
                      <div className="rounded-[10px] border border-dashed border-[#293743] px-5 py-8 text-center">

                        <p className="text-[11px] text-[#667582]">
                          No detection rules are currently mapped.
                        </p>

                      </div>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-2">

                        {playbook.trigger_rule_ids.map(
                          (ruleId) => (
                            <Link
                              key={ruleId}
                              href={`/rules/${ruleId}`}
                              className="group flex items-center justify-between rounded-[10px] border border-[#273541] bg-[#09121a]/80 px-4 py-4 transition hover:border-[#4c432c] hover:bg-[#101a24]"
                            >

                              <div className="min-w-0">

                                <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#647380]">
                                  Detection rule
                                </p>

                                <p className="mt-1 truncate font-mono text-[11px] text-[#c8d0d7] transition group-hover:text-[#dcc178]">
                                  {ruleId}
                                </p>

                              </div>

                              <span className="ml-4 text-[13px] text-[#c9a965]">
                                →
                              </span>

                            </Link>
                          )
                        )}

                      </div>
                    )}

                    <div className="mt-5 flex justify-end">

                      <Link
                        href="/rules"
                        className="text-[11px] font-semibold text-[#d1b66e] transition hover:text-[#ebd38f]"
                      >
                        Review detection catalog →
                      </Link>

                    </div>

                  </div>

                </section>

              </div>

              {/* Right rail */}
              <aside className="space-y-5">

                {/* Response profile */}
                <section className="overflow-hidden rounded-[14px] border border-[#22303c] bg-[#0c151f]/95">

                  <div className="flex items-center justify-between border-b border-[#22303c] px-5 py-5">

                    <div className="flex items-center gap-3">

                      <span className="h-2 w-2 rounded-full bg-[#d8b85e]" />

                      <h2 className="text-[14px] font-semibold text-[#e8edf1]">
                        Response profile
                      </h2>

                    </div>

                    <EnabledBadge
                      enabled={
                        playbook.enabled
                      }
                    />

                  </div>

                  <div className="divide-y divide-[#22303c]">

                    <ProfileField
                      label="Response priority"
                    >
                      <div className="flex items-center gap-2">

                        <span
                          className="h-2 w-2 rounded-full"
                          style={{
                            background:
                              severityTone.accent,
                          }}
                        />

                        <span
                          className="text-[12px] font-semibold"
                          style={{
                            color:
                              severityTone.text,
                          }}
                        >
                          {formatLabel(
                            playbook.severity
                          )}
                        </span>

                      </div>
                    </ProfileField>

                    <ProfileField
                      label="Procedure state"
                    >
                      <span className="text-[12px] font-medium text-[#dfe5e9]">
                        {playbook.enabled
                          ? "Available"
                          : "Disabled"}
                      </span>
                    </ProfileField>

                    <ProfileField
                      label="Workflow phases"
                    >
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
                    </ProfileField>

                  </div>

                </section>

                {/* Analyst pivots */}
                <section className="overflow-hidden rounded-[14px] border border-[#22303c] bg-[#0c151f]/95">

                  <div className="border-b border-[#22303c] px-5 py-5">

                    <div className="flex items-center gap-3">

                      <span className="h-2 w-2 rounded-full bg-[#69c5d7]" />

                      <h2 className="text-[14px] font-semibold text-[#e8edf1]">
                        Analyst pivots
                      </h2>

                    </div>

                    <p className="mt-2 text-[11px] leading-5 text-[#677684]">
                      Continue investigation from this response procedure.
                    </p>

                  </div>

                  <div className="space-y-3 p-5">

                    <PivotCard
                      title="Hunt related telemetry"
                      description="Search processes, users, hosts, IP addresses, and command-line activity."
                      href="/hunt"
                      accent="#d8b85e"
                    />

                    <PivotCard
                      title="Review security events"
                      description="Inspect normalized endpoint and identity telemetry."
                      href="/events"
                      accent="#69c5d7"
                    />

                    <PivotCard
                      title="Open alert queue"
                      description="Review detections requiring analyst triage."
                      href="/alerts"
                      accent="#d89258"
                    />

                    <PivotCard
                      title="Investigation cases"
                      description="Document findings and continue analyst casework."
                      href="/cases"
                      accent="#63cfa4"
                    />

                  </div>

                </section>

                {/* Technical record */}
                <section className="overflow-hidden rounded-[14px] border border-[#22303c] bg-[#0c151f]/95">

                  <div className="border-b border-[#22303c] px-5 py-5">

                    <h2 className="text-[14px] font-semibold text-[#e8edf1]">
                      Technical record
                    </h2>

                    <p className="mt-1 text-[11px] text-[#677684]">
                      Internal response-procedure metadata.
                    </p>

                  </div>

                  <div className="space-y-4 p-5">

                    <MetadataField
                      label="Playbook ID"
                      value={
                        playbook.id
                      }
                    />

                    <div className="border-t border-[#22303c] pt-4">

                      <MetadataField
                        label="Response steps"
                        value={
                          String(
                            sortedSteps.length
                          )
                        }
                      />

                    </div>

                    <div className="border-t border-[#22303c] pt-4">

                      <MetadataField
                        label="Trigger mappings"
                        value={
                          String(
                            playbook.trigger_rule_ids.length
                          )
                        }
                      />

                    </div>

                  </div>

                </section>

              </aside>

            </div>

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


function SnapshotCard({
  label,
  value,
  context,
  accent,
}: {
  label: string;
  value: string;
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
            background:
              accent,
            opacity:
              0.72,
          }}
        />

      </div>

      <p className="mt-4 text-[24px] font-semibold leading-tight tracking-[-0.035em] text-[#f1f4f6]">
        {value}
      </p>

      <p className="mt-4 text-[11px] text-[#657481]">
        {context}
      </p>

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
  const tone =
    getCategoryTone(
      step.category
    );

  return (
    <article className="relative flex gap-5">

      <div className="relative flex w-10 shrink-0 justify-center">

        {!isLast && (
          <div className="absolute bottom-0 top-9 w-px bg-[#263440]" />
        )}

        <div
          className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full border bg-[#09121a] text-[10px] font-semibold"
          style={{
            borderColor:
              `${tone.accent}55`,
            color:
              tone.text,
          }}
        >
          {step.order}
        </div>

      </div>

      <div
        className={`min-w-0 flex-1 ${
          isLast
            ? ""
            : "pb-5"
        }`}
      >

        <div className="group relative overflow-hidden rounded-[10px] border border-[#22303c] bg-[#09121a]/65 p-5 transition hover:border-[#31404d] hover:bg-[#0d1721]">

          <div
            className="absolute bottom-0 left-0 top-0 w-[2px]"
            style={{
              background:
                tone.accent,
              opacity:
                0.82,
            }}
          />

          <div className="flex items-start justify-between gap-5">

            <div>

              <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#5f6f7d]">
                Step {step.order}
              </p>

              <h3 className="mt-2 text-[13px] font-semibold text-[#e1e7eb]">
                {step.title}
              </h3>

            </div>

            <CategoryBadge
              category={
                step.category
              }
            />

          </div>

          <p className="mt-3 max-w-4xl text-[11px] leading-6 text-[#71808c]">
            {step.description}
          </p>

        </div>

      </div>

    </article>
  );
}


function ProfileField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-5 py-4">

      <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#5f6f7d]">
        {label}
      </p>

      {children}

    </div>
  );
}


function PivotCard({
  title,
  description,
  href,
  accent,
}: {
  title: string;
  description: string;
  href: string;
  accent: string;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-[10px] border border-[#263541] bg-[#09121a]/75 p-4 transition hover:border-[#3b4a56] hover:bg-[#101a24]"
    >

      <div className="flex items-center justify-between gap-4">

        <div className="flex items-center gap-3">

          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{
              background:
                accent,
            }}
          />

          <h3 className="text-[11px] font-semibold text-[#dfe5e9]">
            {title}
          </h3>

        </div>

        <span className="text-[12px] text-[#c9a965]">
          →
        </span>

      </div>

      <p className="mt-3 pl-5 text-[10px] leading-5 text-[#61717e]">
        {description}
      </p>

    </Link>
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