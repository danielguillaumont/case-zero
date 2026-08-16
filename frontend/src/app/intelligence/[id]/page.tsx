import Link from "next/link";
import { notFound } from "next/navigation";

import Sidebar from "@/components/Sidebar";

import {
  getSecurityEvents,
  getThreatIndicator,
} from "@/lib/api";

import type {
  SecurityEvent,
} from "@/lib/api";


export default async function IntelligenceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const indicator =
    await getThreatIndicator(id);

  if (!indicator) {
    notFound();
  }

  const securityEvents =
    await getSecurityEvents();

  const relatedEvents =
    findRelatedEvents(
      indicator.indicator_type,
      indicator.value,
      securityEvents
    );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">

      <div className="flex min-h-screen">

        <Sidebar />

        <main className="flex-1 p-10">

          {/* Back */}
          <div className="mb-8">

            <Link
              href="/intelligence"
              className="text-sm text-zinc-500 transition hover:text-zinc-200"
            >
              &larr; Back to Threat Intelligence
            </Link>

          </div>

          {/* Header */}
          <header className="mb-8 flex items-start justify-between gap-8">

            <div className="min-w-0">

              <p className="text-sm text-emerald-400">
                CASE//ZERO / THREAT INTELLIGENCE
              </p>

              <h2 className="mt-2 break-all font-mono text-3xl font-semibold">
                {indicator.value}
              </h2>

              <p className="mt-3 max-w-4xl text-sm leading-6 text-zinc-500">
                Intelligence record and related CASE//ZERO telemetry.
              </p>

            </div>

            <div className="flex shrink-0 items-center gap-3">

              <IndicatorTypeBadge
                indicatorType={
                  indicator.indicator_type
                }
              />

              <ReputationBadge
                reputation={
                  indicator.reputation
                }
              />

            </div>

          </header>

          {/* Intelligence Overview */}
          <section className="rounded-xl border border-zinc-800 bg-zinc-900">

            <div className="border-b border-zinc-800 px-6 py-5">

              <h3 className="font-medium">
                Intelligence Overview
              </h3>

              <p className="mt-1 text-sm text-zinc-500">
                Current classification and confidence information for this indicator.
              </p>

            </div>

            <div className="grid grid-cols-4 gap-8 p-6">

              <OverviewField
                label="Indicator Type"
                value={
                  formatIndicatorType(
                    indicator.indicator_type
                  )
                }
              />

              <OverviewField
                label="Reputation"
                value={
                  indicator.reputation.toUpperCase()
                }
              />

              <OverviewField
                label="Confidence"
                value={`${indicator.confidence} / 100`}
              />

              <OverviewField
                label="Intelligence Source"
                value={
                  indicator.source
                }
              />

            </div>

          </section>

          {/* Analyst Assessment */}
          <section className="mt-6 rounded-xl border border-red-900/60 bg-zinc-900">

            <div className="border-b border-zinc-800 px-6 py-5">

              <p className="text-xs font-medium uppercase tracking-[0.18em] text-red-400">
                Analyst Assessment
              </p>

              <h3 className="mt-2 font-medium">
                Indicator Context
              </h3>

            </div>

            <div className="p-6">

              <p className="text-sm leading-7 text-zinc-300">
                {indicator.description
                  ?? "No analyst description has been recorded for this indicator."}
              </p>

              <div className="mt-6">

                <p className="text-xs uppercase tracking-wider text-zinc-500">
                  Tags
                </p>

                <div className="mt-3 flex flex-wrap gap-2">

                  {indicator.tags.length > 0 ? (
                    indicator.tags.map(
                      (tag) => (
                        <span
                          key={tag}
                          className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-400"
                        >
                          {tag}
                        </span>
                      )
                    )
                  ) : (
                    <span className="text-sm text-zinc-600">
                      No tags
                    </span>
                  )}

                </div>

              </div>

            </div>

          </section>

          {/* Related Telemetry */}
          <section className="mt-6 overflow-hidden rounded-xl border border-violet-900/70 bg-zinc-900">

            <div className="flex items-start justify-between gap-6 border-b border-zinc-800 px-6 py-5">

              <div>

                <p className="text-xs font-medium uppercase tracking-[0.18em] text-violet-400">
                  Telemetry Correlation
                </p>

                <h3 className="mt-2 font-medium">
                  Related Security Events
                </h3>

                <p className="mt-1 text-sm text-zinc-500">
                  Security telemetry containing this indicator in normalized CASE//ZERO fields.
                </p>

              </div>

              <div className="rounded-md border border-violet-900 bg-violet-950 px-3 py-1.5 text-xs font-medium text-violet-400">
                {relatedEvents.length}{" "}
                {relatedEvents.length === 1
                  ? "Event"
                  : "Events"}
              </div>

            </div>

            {relatedEvents.length > 0 ? (
              <div className="overflow-x-auto">

                <table className="w-full">

                  <thead className="border-b border-zinc-800 bg-zinc-950/60">

                    <tr className="text-left text-xs uppercase tracking-wider text-zinc-500">

                      <th className="px-6 py-4 font-medium">
                        Event
                      </th>

                      <th className="px-6 py-4 font-medium">
                        Host
                      </th>

                      <th className="px-6 py-4 font-medium">
                        User
                      </th>

                      <th className="px-6 py-4 font-medium">
                        Source IP
                      </th>

                      <th className="px-6 py-4 font-medium">
                        Event Time
                      </th>

                    </tr>

                  </thead>

                  <tbody className="divide-y divide-zinc-800">

                    {relatedEvents.map(
                      (event) => (
                        <tr
                          key={event.id}
                          className="transition hover:bg-zinc-800/30"
                        >

                          <td className="px-6 py-5">

                            <Link
                              href={`/events/${event.id}`}
                              className="font-medium text-emerald-400 transition hover:text-emerald-300"
                            >
                              {formatEventType(
                                event.event_type
                              )}{" "}
                              &rarr;
                            </Link>

                            <p className="mt-1 text-xs text-zinc-600">
                              {event.source}
                            </p>

                          </td>

                          <td className="px-6 py-5 text-sm text-zinc-400">
                            {event.hostname
                              ?? "Unavailable"}
                          </td>

                          <td className="px-6 py-5 text-sm text-zinc-400">
                            {event.username
                              ?? "Unavailable"}
                          </td>

                          <td className="px-6 py-5">

                            <code className="text-sm text-orange-300">
                              {event.source_ip
                                ?? "Unavailable"}
                            </code>

                          </td>

                          <td className="px-6 py-5 text-sm text-zinc-400">
                            {formatIndicatorTime(
                              event.event_time
                            )}
                          </td>

                        </tr>
                      )
                    )}

                  </tbody>

                </table>

              </div>
            ) : (
              <div className="px-6 py-12 text-center">

                <p className="text-sm font-medium text-zinc-300">
                  No related security events found
                </p>

                <p className="mt-2 text-sm text-zinc-500">
                  CASE//ZERO did not find this indicator in currently normalized telemetry fields.
                </p>

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
                Continue investigation using CASE//ZERO analyst workflows.
              </p>

            </div>

            <div className="grid grid-cols-3 gap-4 p-6">

              <ResourceCard
                title="Threat Hunting"
                description="Search telemetry for this IOC or related activity across the CASE//ZERO event dataset."
                href={`/hunt?contains=${encodeURIComponent(
                  indicator.value
                )}&run=1`}
                action="Hunt Indicator"
              />

              <ResourceCard
                title="Security Events"
                description="Review all normalized security telemetry currently available to CASE//ZERO."
                href="/events"
                action="View Events"
              />

              <ResourceCard
                title="Alerts"
                description="Review detection alerts that may be associated with activity involving this indicator."
                href="/alerts"
                action="View Alerts"
              />

            </div>

          </section>

          {/* Timeline */}
          <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900">

            <div className="border-b border-zinc-800 px-6 py-5">

              <h3 className="font-medium">
                Indicator Timeline
              </h3>

              <p className="mt-1 text-sm text-zinc-500">
                Intelligence observation and record timestamps.
              </p>

            </div>

            <div className="grid grid-cols-4 gap-8 p-6">

              <OverviewField
                label="First Seen"
                value={formatIndicatorTime(
                  indicator.first_seen
                )}
              />

              <OverviewField
                label="Last Seen"
                value={formatIndicatorTime(
                  indicator.last_seen
                )}
              />

              <OverviewField
                label="Created"
                value={formatIndicatorTime(
                  indicator.created_at
                )}
              />

              <OverviewField
                label="Last Updated"
                value={formatIndicatorTime(
                  indicator.updated_at
                )}
              />

            </div>

          </section>

          {/* Technical Metadata */}
          <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6">

            <h3 className="font-medium">
              Technical Metadata
            </h3>

            <p className="mt-1 text-sm text-zinc-500">
              Internal CASE//ZERO intelligence identifiers.
            </p>

            <div className="mt-6">

              <p className="text-xs uppercase tracking-wider text-zinc-500">
                Indicator ID
              </p>

              <code className="mt-2 block rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-400">
                {indicator.id}
              </code>

            </div>

          </section>

        </main>

      </div>

    </div>
  );
}


function findRelatedEvents(
  indicatorType: string,
  value: string,
  events: SecurityEvent[]
): SecurityEvent[] {
  const normalizedValue =
    value.toLowerCase();

  return events.filter(
    (event) => {
      if (indicatorType === "ip") {
        return (
          event.source_ip === value
          || event.destination_ip === value
        );
      }

      if (
        indicatorType === "domain"
        || indicatorType === "url"
      ) {
        const commandLine =
          event.command_line
            ?.toLowerCase()
          ?? "";

        const rawData =
          JSON.stringify(
            event.raw_data ?? {}
          ).toLowerCase();

        return (
          commandLine.includes(
            normalizedValue
          )
          || rawData.includes(
            normalizedValue
          )
        );
      }

      if (indicatorType === "hash") {
        const rawData =
          JSON.stringify(
            event.raw_data ?? {}
          ).toLowerCase();

        return rawData.includes(
          normalizedValue
        );
      }

      return false;
    }
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

      <p className="mt-2 break-words text-sm font-medium text-zinc-200">
        {value}
      </p>

    </div>
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


function IndicatorTypeBadge({
  indicatorType,
}: {
  indicatorType: string;
}) {
  const labels: Record<
    string,
    string
  > = {
    ip: "IP",
    domain: "DOMAIN",
    url: "URL",
    hash: "HASH",
  };

  return (
    <span className="rounded-md border border-blue-900 bg-blue-950 px-3 py-1.5 text-xs font-medium text-blue-400">
      {
        labels[indicatorType]
        ?? indicatorType.toUpperCase()
      }
    </span>
  );
}


function ReputationBadge({
  reputation,
}: {
  reputation: string;
}) {
  const styles: Record<
    string,
    string
  > = {
    malicious:
      "border-red-900 bg-red-950 text-red-400",

    suspicious:
      "border-orange-900 bg-orange-950 text-orange-400",

    unknown:
      "border-zinc-700 bg-zinc-800 text-zinc-400",

    benign:
      "border-emerald-900 bg-emerald-950 text-emerald-400",
  };

  const normalized =
    reputation.toLowerCase();

  return (
    <span
      className={`rounded-md border px-3 py-1.5 text-xs font-medium uppercase ${
        styles[normalized]
        ??
        "border-zinc-700 bg-zinc-800 text-zinc-400"
      }`}
    >
      {reputation}
    </span>
  );
}


function formatIndicatorType(
  indicatorType: string
) {
  const labels: Record<
    string,
    string
  > = {
    ip: "IP Address",
    domain: "Domain",
    url: "URL",
    hash: "File Hash",
  };

  return (
    labels[indicatorType]
    ?? indicatorType
  );
}


function formatEventType(
  eventType: string
) {
  return eventType
    .replaceAll("_", " ")
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}


function formatIndicatorTime(
  timestamp: string
) {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  ).format(
    new Date(timestamp)
  );
}