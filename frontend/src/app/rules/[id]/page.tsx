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
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const rule =
    await getDetectionRule(id);

  if (!rule) {
    notFound();
  }

  const playbooks =
    await getPlaybooksForRule(
      rule.id
    );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">

      <div className="flex min-h-screen">

        <Sidebar />

        <main className="flex-1 p-10">

          {/* Back */}
          <div className="mb-8">

            <Link
              href="/rules"
              className="text-sm text-zinc-500 transition hover:text-zinc-200"
            >
              &larr; Back to Detection Rules
            </Link>

          </div>

          {/* Header */}
          <header className="mb-8 flex items-start justify-between gap-8">

            <div className="min-w-0">

              <p className="text-sm text-emerald-400">
                CASE//ZERO / DETECTION RULE
              </p>

              <h2 className="mt-2 text-3xl font-semibold">
                {rule.name}
              </h2>

              <p className="mt-3 max-w-4xl text-sm leading-6 text-zinc-500">
                {rule.description}
              </p>

            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-end gap-3">

              <SeverityBadge
                severity={
                  rule.severity
                }
              />

              <RuleTypeBadge
                ruleType={
                  rule.rule_type
                }
              />

              <EnabledBadge
                enabled={
                  rule.enabled
                }
              />

            </div>

          </header>

          {/* Rule Overview */}
          <section className="rounded-xl border border-zinc-800 bg-zinc-900">

            <div className="border-b border-zinc-800 px-6 py-5">

              <h3 className="font-medium">
                Rule Overview
              </h3>

              <p className="mt-1 text-sm text-zinc-500">
                Detection metadata and event coverage.
              </p>

            </div>

            <div className="grid grid-cols-4 gap-8 p-6">

              <OverviewField
                label="Severity"
                value={
                  rule.severity.toUpperCase()
                }
              />

              <OverviewField
                label="Rule Type"
                value={
                  rule.rule_type
                    .replaceAll(
                      "_",
                      " "
                    )
                    .toUpperCase()
                }
              />

              <OverviewField
                label="Event Type"
                value={
                  rule.event_type
                    .replaceAll(
                      "_",
                      " "
                    )
                }
              />

              <OverviewField
                label="Status"
                value={
                  rule.enabled
                    ? "ENABLED"
                    : "DISABLED"
                }
              />

            </div>

          </section>

          {/* Detection Logic */}
          <section className="mt-6 rounded-xl border border-violet-900/70 bg-zinc-900">

            <div className="border-b border-zinc-800 px-6 py-5">

              <p className="text-xs font-medium uppercase tracking-[0.18em] text-violet-400">
                Detection Logic
              </p>

              <h3 className="mt-2 font-medium">
                Rule Conditions
              </h3>

              <p className="mt-1 text-sm text-zinc-500">
                Conditions evaluated by the CASE//ZERO detection engine.
              </p>

            </div>

            <div className="p-6">

              <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-5 py-4">

                <p className="text-sm leading-7 text-zinc-300">
                  {rule.logic}
                </p>

              </div>

            </div>

          </section>

          {/* MITRE ATT&CK */}
          <section className="mt-6 overflow-hidden rounded-xl border border-orange-900/70 bg-zinc-900">

            <div className="flex items-start justify-between gap-6 border-b border-zinc-800 px-6 py-5">

              <div>

                <p className="text-xs font-medium uppercase tracking-[0.18em] text-orange-400">
                  MITRE ATT&amp;CK
                </p>

                <h3 className="mt-2 font-medium">
                  Technique Mapping
                </h3>

                <p className="mt-1 text-sm text-zinc-500">
                  ATT&amp;CK techniques and tactics associated with this detection.
                </p>

              </div>

              <div className="rounded-md border border-orange-900 bg-orange-950 px-3 py-1.5 text-xs font-medium text-orange-400">
                {rule.mitre_attack.length}{" "}
                {rule.mitre_attack.length === 1
                  ? "Technique"
                  : "Techniques"}
              </div>

            </div>

            {rule.mitre_attack.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 p-6 lg:grid-cols-2">

                {rule.mitre_attack.map(
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
              <div className="px-6 py-10 text-center">

                <p className="text-sm font-medium text-zinc-300">
                  No ATT&amp;CK mapping available
                </p>

                <p className="mt-2 text-sm text-zinc-500">
                  This detection has not yet been mapped to a MITRE ATT&amp;CK technique.
                </p>

              </div>
            )}

          </section>

          {/* Response Mapping */}
          <section className="mt-6 overflow-hidden rounded-xl border border-emerald-900/70 bg-zinc-900">

            <div className="border-b border-zinc-800 px-6 py-5">

              <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-400">
                Response Mapping
              </p>

              <h3 className="mt-2 font-medium">
                Incident Response Playbooks
              </h3>

              <p className="mt-1 text-sm text-zinc-500">
                Analyst response procedures mapped to alerts produced by this rule.
              </p>

            </div>

            {playbooks.length > 0 ? (
              <div className="space-y-4 p-6">

                {playbooks.map(
                  (playbook) => (
                    <PlaybookCard
                      key={playbook.id}
                      playbook={
                        playbook
                      }
                    />
                  )
                )}

              </div>
            ) : (
              <div className="p-6">

                <div className="rounded-lg border border-yellow-900 bg-yellow-950/30 px-4 py-4">

                  <p className="text-sm font-medium text-yellow-400">
                    No response playbook mapped
                  </p>

                  <p className="mt-2 text-sm leading-6 text-zinc-500">
                    CASE//ZERO does not currently have an enabled incident response playbook mapped to this detection rule.
                  </p>

                </div>

              </div>
            )}

          </section>

          {/* Analyst Resources */}
          <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900">

            <div className="border-b border-zinc-800 px-6 py-5">

              <h3 className="font-medium">
                Analyst Resources
              </h3>

              <p className="mt-1 text-sm text-zinc-500">
                CASE//ZERO workflows that support investigation of this detection.
              </p>

            </div>

            <div className="grid grid-cols-3 gap-4 p-6">

              <ResourceCard
                title="Threat Hunting"
                description="Search related telemetry by user, host, IP address, event type, process, or indicator."
                href={`/hunt?event_type=${encodeURIComponent(
                  rule.event_type
                )}&run=1`}
                action="Open Hunt"
              />

              <ResourceCard
                title="Security Events"
                description="Review normalized security telemetry available to the CASE//ZERO detection engine."
                href="/events"
                action="View Events"
              />

              <ResourceCard
                title="Alerts"
                description="Review alerts generated by CASE//ZERO detection and correlation rules."
                href="/alerts"
                action="View Alerts"
              />

            </div>

          </section>

          {/* Technical Metadata */}
          <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6">

            <h3 className="font-medium">
              Technical Metadata
            </h3>

            <p className="mt-1 text-sm text-zinc-500">
              Internal CASE//ZERO detection identifiers.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-6">

              <MetadataField
                label="Rule ID"
                value={
                  rule.id
                }
              />

              <MetadataField
                label="Event Type"
                value={
                  rule.event_type
                }
              />

            </div>

          </section>

        </main>

      </div>

    </div>
  );
}


function MitreAttackCard({
  mapping,
}: {
  mapping: MitreAttackMapping;
}) {
  return (
    <article className="rounded-xl border border-orange-900/50 bg-zinc-950/70 p-5">

      <div className="flex items-start justify-between gap-6">

        <div className="min-w-0">

          <div className="flex flex-wrap items-center gap-2">

            <span className="rounded-md border border-orange-900 bg-orange-950 px-2.5 py-1 font-mono text-xs font-medium text-orange-400">
              {mapping.technique_id}
            </span>

            <span className="rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs font-medium uppercase text-zinc-400">
              Technique
            </span>

          </div>

          <h4 className="mt-4 text-lg font-medium text-zinc-100">
            {mapping.technique_name}
          </h4>

        </div>

      </div>

      <div className="mt-5 border-t border-zinc-800 pt-4">

        <p className="text-xs uppercase tracking-wider text-zinc-600">
          ATT&amp;CK Tactic
        </p>

        <div className="mt-2 flex items-center gap-3">

          <span className="font-mono text-sm text-orange-300">
            {mapping.tactic_id}
          </span>

          <span className="text-sm text-zinc-400">
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
    <article className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-5">

      <div className="flex items-start justify-between gap-8">

        <div className="min-w-0 flex-1">

          <div className="flex flex-wrap items-center gap-2">

            <SeverityBadge
              severity={
                playbook.severity
              }
            />

            <span className="rounded-md border border-emerald-900 bg-emerald-950 px-2.5 py-1 text-xs font-medium uppercase text-emerald-400">
              Mapped
            </span>

            <span className="rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs font-medium uppercase text-zinc-400">
              {playbook.steps.length} Steps
            </span>

          </div>

          <h4 className="mt-4 text-lg font-medium text-zinc-100">
            {playbook.name}
          </h4>

          <p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-500">
            {playbook.description}
          </p>

        </div>

        <div className="w-64 shrink-0">

          <p className="text-xs uppercase tracking-wider text-zinc-600">
            Playbook ID
          </p>

          <p className="mt-2 break-words text-sm text-zinc-400">
            {playbook.id}
          </p>

        </div>

      </div>

      <div className="mt-5 border-t border-zinc-800 pt-5">

        <Link
          href={`/playbooks/${playbook.id}`}
          className="inline-flex rounded-lg border border-emerald-800 bg-emerald-950 px-4 py-2.5 text-sm font-medium text-emerald-400 transition hover:bg-emerald-900"
        >
          Open Response Playbook &rarr;
        </Link>

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


function MetadataField({
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

      <code className="mt-2 block overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-400">
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
        styles[normalized]
        ??
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
  const correlation =
    ruleType === "correlation";

  return (
    <span
      className={`rounded-md border px-2.5 py-1 text-xs font-medium uppercase ${
        correlation
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