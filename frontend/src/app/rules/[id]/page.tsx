import Link from "next/link";
import { notFound } from "next/navigation";

import Sidebar from "@/components/Sidebar";

import {
  getDetectionRule,
  getPlaybooksForRule,
} from "@/lib/api";

import type {
  MitreAttackMapping,
  Playbook,
} from "@/lib/api";


export default async function DetectionRuleDetailPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const { id } =
    await params;

  const rule =
    await getDetectionRule(
      id
    );

  if (!rule) {
    notFound();
  }

  const playbooks =
    await getPlaybooksForRule(
      rule.id
    );

  const attackMappings =
    rule.mitre_attack;

  return (
    <div className="min-h-screen text-[#f1f4f7]">
      <div className="flex min-h-screen">
        <Sidebar />

        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-[1700px] px-8 py-8 xl:px-10 xl:py-10">

            {/* Breadcrumb */}
            <div className="mb-5 flex items-center gap-2 text-[10px]">
              <Link
                href="/rules"
                className="font-medium text-[#dce3e8] transition hover:text-[#c9a965]"
              >
                Detection Rules
              </Link>

              <span className="text-[#44525e]">
                /
              </span>

              <span className="text-[#62717e]">
                Rule Record
              </span>
            </div>

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

                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-[34px] font-semibold tracking-[-0.04em] text-[#f4f6f8]">
                    {rule.name}
                  </h1>

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

                <p className="mt-3 max-w-4xl text-[13px] leading-6 text-[#81909c]">
                  {rule.description}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-3 pt-1">
                <HeaderStatus
                  label="Engine"
                  value={
                    rule.enabled
                      ? "Evaluating"
                      : "Disabled"
                  }
                  active={
                    rule.enabled
                  }
                />

                <HeaderStatus
                  label="Response"
                  value={`${playbooks.length} mapped`}
                />
              </div>
            </header>

            <div className="h-px bg-gradient-to-r from-[#c9a965]/60 via-[#24323e] to-transparent" />

            {/* Snapshot */}
            <section className="mt-7">
              <div className="mb-3 flex items-end justify-between gap-6">
                <div>
                  <h2 className="text-[14px] font-medium text-[#dce3e8]">
                    Rule snapshot
                  </h2>

                  <p className="mt-1 text-[11px] text-[#657481]">
                    Detection configuration and
                    coverage state
                  </p>
                </div>

                <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-[#53636f]">
                  {rule.id}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                <SnapshotCard
                  label="Severity"
                  value={
                    rule.severity.toUpperCase()
                  }
                  context="Detection priority"
                  accent={
                    getSeverityAccent(
                      rule.severity
                    )
                  }
                />

                <SnapshotCard
                  label="Rule type"
                  value={
                    formatLabel(
                      rule.rule_type
                    )
                  }
                  context="Evaluation strategy"
                  accent="#c9a965"
                />

                <SnapshotCard
                  label="Event type"
                  value={
                    formatLabel(
                      rule.event_type
                    )
                  }
                  context="Telemetry coverage"
                  accent="#69c5d7"
                />

                <SnapshotCard
                  label="Engine state"
                  value={
                    rule.enabled
                      ? "Enabled"
                      : "Disabled"
                  }
                  context={
                    rule.enabled
                      ? "Currently evaluating"
                      : "Evaluation suspended"
                  }
                  accent={
                    rule.enabled
                      ? "#63cfa4"
                      : "#657481"
                  }
                />
              </div>
            </section>

            {/* Workspace */}
            <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">

              {/* Left column */}
              <div className="space-y-5">

                {/* Detection Logic */}
                <section className="overflow-hidden rounded-[14px] border border-[#1d2a35] bg-[#0b141d]/95 shadow-[0_18px_50px_rgba(0,0,0,0.16)]">
                  <PanelHeader
                    title="Detection logic"
                    description="Rule conditions evaluated by the CASE//ZERO detection engine."
                    accent="#69c5d7"
                    badge="RULE LOGIC"
                  />

                  <div className="p-6">
                    <div className="rounded-[10px] border border-[#1f2d38] bg-[#070e15] px-5 py-5">
                      <div className="mb-4 flex items-center justify-between gap-4">
                        <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#596976]">
                          Evaluation condition
                        </p>

                        <span className="rounded-md border border-[#69c5d7]/20 bg-[#69c5d7]/[0.05] px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.08em] text-[#83cbd7]">
                          {formatLabel(
                            rule.event_type
                          )}
                        </span>
                      </div>

                      <code className="block whitespace-pre-wrap break-words font-mono text-[12px] leading-7 text-[#c7d0d7]">
                        {rule.logic}
                      </code>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <MetadataTile
                        label="Rule identifier"
                        value={rule.id}
                        mono
                      />

                      <MetadataTile
                        label="Normalized event"
                        value={
                          rule.event_type
                        }
                        mono
                      />
                    </div>
                  </div>
                </section>

                {/* ATT&CK */}
                <section className="overflow-hidden rounded-[14px] border border-[#1d2a35] bg-[#0b141d]/95 shadow-[0_18px_50px_rgba(0,0,0,0.16)]">
                  <PanelHeader
                    title="ATT&CK coverage"
                    description="MITRE ATT&CK techniques and tactics associated with this detection."
                    accent="#c9a965"
                    badge={`${attackMappings.length} ${
                      attackMappings.length === 1
                        ? "MAPPING"
                        : "MAPPINGS"
                    }`}
                  />

                  {attackMappings.length > 0 ? (
                    <div className="grid gap-4 p-6 lg:grid-cols-2">
                      {attackMappings.map(
                        (mapping) => (
                          <MitreAttackCard
                            key={`${mapping.technique_id}-${mapping.tactic_id}`}
                            mapping={
                              mapping
                            }
                          />
                        )
                      )}
                    </div>
                  ) : (
                    <div className="px-6 py-12 text-center">
                      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-[#273540] bg-[#0d1720] text-[11px] text-[#778691]">
                        0
                      </div>

                      <p className="mt-4 text-[13px] font-medium text-[#dce3e8]">
                        No ATT&amp;CK mappings
                      </p>

                      <p className="mt-2 text-[11px] leading-5 text-[#657481]">
                        This detection has not
                        yet been associated with
                        a MITRE ATT&amp;CK
                        technique.
                      </p>
                    </div>
                  )}
                </section>
              </div>

              {/* Right column */}
              <div className="space-y-5">

                {/* Response mapping */}
                <section className="overflow-hidden rounded-[14px] border border-[#1d2a35] bg-[#0b141d]/95 shadow-[0_18px_50px_rgba(0,0,0,0.16)]">
                  <PanelHeader
                    title="Response mapping"
                    description="Incident-response workflows associated with this detection."
                    accent="#63cfa4"
                    badge={`${playbooks.length} MAPPED`}
                  />

                  {playbooks.length > 0 ? (
                    <div className="divide-y divide-[#1b2833]">
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
                  ) : (
                    <div className="p-5">
                      <div className="rounded-[10px] border border-[#c9a965]/20 bg-[#c9a965]/[0.045] p-4">
                        <div className="flex items-start gap-3">
                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#c9a965]" />

                          <div>
                            <p className="text-[12px] font-medium text-[#dac17d]">
                              No response playbook
                              mapped
                            </p>

                            <p className="mt-2 text-[10px] leading-5 text-[#71808c]">
                              CASE//ZERO does not
                              currently have an
                              incident-response
                              playbook mapped to
                              this detection.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </section>

                {/* Investigation pivots */}
                <section className="overflow-hidden rounded-[14px] border border-[#1d2a35] bg-[#0b141d]/95">
                  <PanelHeader
                    title="Investigation pivots"
                    description="Continue analysis from this detection rule."
                    accent="#69c5d7"
                    badge="ANALYST"
                  />

                  <div className="space-y-3 p-5">
                    <ResourceCard
                      title="Hunt matching telemetry"
                      description="Search telemetry for events covered by this detection."
                      href={`/hunt?event_type=${encodeURIComponent(
                        rule.event_type
                      )}&run=1`}
                      accent="#c9a965"
                    />

                    <ResourceCard
                      title="Review security events"
                      description="Inspect normalized telemetry available to the detection engine."
                      href="/events"
                      accent="#69c5d7"
                    />

                    <ResourceCard
                      title="Review alert queue"
                      description="Inspect detection records requiring analyst review."
                      href="/alerts"
                      accent="#63cfa4"
                    />
                  </div>
                </section>
              </div>
            </section>

            {/* Technical metadata */}
            <section className="mt-5 overflow-hidden rounded-[14px] border border-[#1d2a35] bg-[#0b141d]/95">
              <PanelHeader
                title="Technical metadata"
                description="Internal CASE//ZERO rule identifiers and engine configuration."
                accent="#71818e"
                badge="INTERNAL"
              />

              <div className="grid gap-px bg-[#1b2833] md:grid-cols-2 xl:grid-cols-4">
                <TechnicalField
                  label="Rule ID"
                  value={rule.id}
                />

                <TechnicalField
                  label="Event type"
                  value={
                    rule.event_type
                  }
                />

                <TechnicalField
                  label="Rule type"
                  value={
                    rule.rule_type
                  }
                />

                <TechnicalField
                  label="Engine state"
                  value={
                    rule.enabled
                      ? "enabled"
                      : "disabled"
                  }
                />
              </div>
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
    <div className="relative overflow-hidden rounded-[14px] border border-[#1e2c37] bg-gradient-to-b from-[#101b25] to-[#0c151e] p-5 shadow-[0_14px_35px_rgba(0,0,0,0.14)]">
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background:
            `linear-gradient(90deg, ${accent}, transparent 68%)`,
        }}
      />

      <div className="flex items-center justify-between gap-4">
        <p className="text-[12px] font-medium text-[#8996a1]">
          {label}
        </p>

        <span
          className="h-1.5 w-6 shrink-0 rounded-full"
          style={{
            background: accent,
            opacity: 0.74,
          }}
        />
      </div>

      <p className="mt-4 truncate text-[23px] font-semibold tracking-[-0.035em] text-[#f0f3f6]">
        {value}
      </p>

      <p className="mt-3 text-[10px] text-[#657481]">
        {context}
      </p>
    </div>
  );
}


function PanelHeader({
  title,
  description,
  accent,
  badge,
}: {
  title: string;
  description: string;
  accent: string;
  badge: string;
}) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-[#1d2a35] px-6 py-5">
      <div className="flex items-start gap-3">
        <span
          className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
          style={{
            background: accent,
          }}
        />

        <div>
          <h2 className="text-[14px] font-semibold text-[#e5eaee]">
            {title}
          </h2>

          <p className="mt-1 text-[10px] leading-5 text-[#657481]">
            {description}
          </p>
        </div>
      </div>

      <span className="shrink-0 rounded-md border border-[#263541] bg-[#0b141c] px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.08em] text-[#70808c]">
        {badge}
      </span>
    </div>
  );
}


function MitreAttackCard({
  mapping,
}: {
  mapping: MitreAttackMapping;
}) {
  return (
    <article className="rounded-[11px] border border-[#263440] bg-[#08111a]/85 p-5 transition hover:border-[#c9a965]/25">
      <div className="flex items-start justify-between gap-5">
        <div className="min-w-0">
          <p className="font-mono text-[10px] font-semibold tracking-[0.04em] text-[#d3b970]">
            {mapping.technique_id}
          </p>

          <h3 className="mt-2 text-[13px] font-semibold text-[#e1e7eb]">
            {mapping.technique_name}
          </h3>
        </div>

        <span className="rounded-md border border-[#c9a965]/20 bg-[#c9a965]/[0.05] px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.08em] text-[#cdb36d]">
          Technique
        </span>
      </div>

      <div className="mt-5 border-t border-[#1b2833] pt-4">
        <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-[#52626f]">
          ATT&amp;CK tactic
        </p>

        <div className="mt-2 flex items-center gap-3">
          <span className="font-mono text-[10px] text-[#8797a3]">
            {mapping.tactic_id}
          </span>

          <span className="h-3 w-px bg-[#26333d]" />

          <span className="text-[11px] font-medium text-[#bac5cd]">
            {mapping.tactic_name}
          </span>
        </div>
      </div>
    </article>
  );
}


function PlaybookCard({
  playbook,
}: {
  playbook: Playbook;
}) {
  return (
    <article className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge
              severity={
                playbook.severity
              }
            />

            <span className="rounded-md border border-[#63cfa4]/20 bg-[#63cfa4]/[0.05] px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.08em] text-[#80d5b4]">
              Mapped
            </span>

            <span className="rounded-md border border-[#263541] bg-[#0c151d] px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.08em] text-[#758490]">
              {playbook.steps.length}{" "}
              {playbook.steps.length === 1
                ? "step"
                : "steps"}
            </span>
          </div>

          <h3 className="mt-3 text-[13px] font-semibold text-[#e2e8ec]">
            {playbook.name}
          </h3>

          <p className="mt-2 text-[10px] leading-5 text-[#677682]">
            {playbook.description}
          </p>
        </div>
      </div>

      <Link
        href={`/playbooks/${playbook.id}`}
        className="mt-4 flex items-center justify-between rounded-[8px] border border-[#263541] bg-[#09121a] px-4 py-3 text-[10px] font-medium text-[#d5dde3] transition hover:border-[#c9a965]/30 hover:text-[#dec47e]"
      >
        <span>
          Open response playbook
        </span>

        <span className="text-[#c9a965]">
          →
        </span>
      </Link>
    </article>
  );
}


function ResourceCard({
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
      className="group block rounded-[10px] border border-[#22313c] bg-[#08111a]/80 p-4 transition hover:border-[#344550] hover:bg-[#0d1720]"
    >
      <div className="flex items-start gap-3">
        <span
          className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
          style={{
            background: accent,
          }}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-4">
            <p className="text-[11px] font-semibold text-[#dce3e8]">
              {title}
            </p>

            <span className="text-[11px] text-[#c9a965] transition group-hover:translate-x-0.5">
              →
            </span>
          </div>

          <p className="mt-2 text-[9px] leading-5 text-[#62717e]">
            {description}
          </p>
        </div>
      </div>
    </Link>
  );
}


function MetadataTile({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-[9px] border border-[#1f2d38] bg-[#09121a] px-4 py-4">
      <p className="text-[8px] font-semibold uppercase tracking-[0.11em] text-[#53636f]">
        {label}
      </p>

      <p
        className={`mt-2 break-words text-[10px] text-[#aebac3] ${
          mono
            ? "font-mono"
            : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}


function TechnicalField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="bg-[#0b141d] px-6 py-5">
      <p className="text-[8px] font-semibold uppercase tracking-[0.11em] text-[#52626f]">
        {label}
      </p>

      <code className="mt-2 block break-all font-mono text-[10px] text-[#a9b6bf]">
        {value}
      </code>
    </div>
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
      {formatLabel(
        ruleType
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


function getSeverityAccent(
  severity: string
) {
  switch (
    severity.toLowerCase()
  ) {
    case "critical":
      return "#e06d72";

    case "high":
      return "#dc9259";

    case "medium":
      return "#c9a965";

    case "low":
      return "#69c5d7";

    default:
      return "#71818e";
  }
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