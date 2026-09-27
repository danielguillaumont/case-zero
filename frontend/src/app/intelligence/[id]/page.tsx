import Link from "next/link";

import {
  notFound,
} from "next/navigation";

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
  params: Promise<{
    id: string;
  }>;
}) {
  const { id } =
    await params;

  const indicator =
    await getThreatIndicator(
      id
    );

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
    )
      .slice()
      .sort(
        (a, b) =>
          new Date(
            b.event_time
          ).getTime()
          - new Date(
            a.event_time
          ).getTime()
      );

  const reputationAccent =
    getReputationAccent(
      indicator.reputation
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
                href="/intelligence"
                className="font-medium text-[#c7d0d7] transition hover:text-white"
              >
                Threat Intelligence
              </Link>

              <span className="text-[#43515d]">
                /
              </span>

              <span className="text-[#657481]">
                Indicator Record
              </span>
            </div>

            {/* Header */}
            <header className="mb-7 flex items-start justify-between gap-8 border-b border-[#1b2833] pb-7">
              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <span className="text-[12px] font-semibold text-[#c9a965]">
                    Security Operations
                  </span>

                  <span className="h-px w-8 bg-[#c9a965]/40" />

                  <span className="text-[11px] text-[#667583]">
                    Threat Intelligence Record
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="max-w-5xl break-all font-mono text-[31px] font-semibold tracking-[-0.035em] text-[#f4f6f8]">
                    {indicator.value}
                  </h2>

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

                <p className="mt-3 max-w-4xl text-[13px] leading-6 text-[#81909c]">
                  Review classification,
                  confidence, observation history,
                  supporting telemetry, and analyst
                  investigation pivots for this indicator.
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-3 pt-1">
                <HeaderStatus
                  label="Source"
                  value={
                    indicator.source
                  }
                />

                <div className="rounded-[10px] border border-[#c9a965]/20 bg-[#c9a965]/[0.04] px-4 py-3">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#817351]">
                    Correlation
                  </p>

                  <div className="mt-1 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#69c5d7]" />

                    <p className="text-[11px] font-medium text-[#b7dce4]">
                      {relatedEvents.length}{" "}
                      {relatedEvents.length === 1
                        ? "event"
                        : "events"}
                    </p>
                  </div>
                </div>
              </div>
            </header>

            {/* Snapshot */}
            <section>
              <div className="mb-3 flex items-end justify-between gap-5">
                <div>
                  <h3 className="text-[14px] font-medium text-[#dce3e8]">
                    Intelligence snapshot
                  </h3>

                  <p className="mt-1 text-[11px] text-[#657481]">
                    Current classification and observation state
                  </p>
                </div>

                <p className="text-[10px] text-[#5e6d79]">
                  Last observed{" "}
                  {formatCompactTime(
                    indicator.last_seen
                  )}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                <SnapshotCard
                  label="Reputation"
                  value={
                    formatLabel(
                      indicator.reputation
                    )
                  }
                  context="Current IOC classification"
                  accent={
                    reputationAccent
                  }
                />

                <SnapshotCard
                  label="Confidence"
                  value={
                    `${indicator.confidence}/100`
                  }
                  context={
                    getConfidenceDescription(
                      indicator.confidence
                    )
                  }
                  accent={
                    getConfidenceAccent(
                      indicator.confidence
                    )
                  }
                />

                <SnapshotCard
                  label="Indicator type"
                  value={
                    formatIndicatorType(
                      indicator.indicator_type
                    )
                  }
                  context="Observable classification"
                  accent="#6d95c8"
                />

                <SnapshotCard
                  label="Related telemetry"
                  value={
                    String(
                      relatedEvents.length
                    )
                  }
                  context={
                    relatedEvents.length === 1
                      ? "Correlated security event"
                      : "Correlated security events"
                  }
                  accent="#69c5d7"
                />
              </div>
            </section>

            {/* Main intelligence workspace */}
            <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.9fr)_minmax(340px,0.72fr)]">

              {/* Context */}
              <div className="overflow-hidden rounded-[14px] border border-[#1b2a36] bg-[#0b141d]/95">
                <div className="flex items-start justify-between gap-6 border-b border-[#1a2833] px-6 py-5">
                  <div className="flex items-start gap-3">
                    <span className="mt-[6px] h-2 w-2 shrink-0 rounded-full bg-[#69c5d7]" />

                    <div>
                      <h3 className="text-[15px] font-semibold text-[#e8edf1]">
                        Indicator context
                      </h3>

                      <p className="mt-1 text-[11px] text-[#657481]">
                        Intelligence assessment,
                        source attribution, and IOC
                        observation metadata.
                      </p>
                    </div>
                  </div>

                  <span className="rounded-[5px] border border-[#24414a] bg-[#11232c] px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.08em] text-[#86cdd8]">
                    Intelligence
                  </span>
                </div>

                <div className="p-6">
                  <div className="rounded-[10px] border border-[#1e2d38] bg-[#081119]/80 p-5">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.11em] text-[#61717e]">
                      Analyst assessment
                    </p>

                    <p className="mt-4 max-w-5xl text-[13px] leading-7 text-[#c6d0d7]">
                      {indicator.description
                        ?? "No analyst assessment has been recorded for this intelligence indicator."}
                    </p>
                  </div>

                  <div className="mt-5 grid border-y border-[#1b2934] md:grid-cols-2">
                    <DetailField
                      label="Intelligence source"
                      value={
                        indicator.source
                      }
                    />

                    <DetailField
                      label="Indicator type"
                      value={
                        formatIndicatorType(
                          indicator.indicator_type
                        )
                      }
                    />

                    <DetailField
                      label="Reputation"
                      value={
                        formatLabel(
                          indicator.reputation
                        )
                      }
                    />

                    <DetailField
                      label="Confidence"
                      value={
                        `${indicator.confidence} / 100`
                      }
                    />
                  </div>

                  <div className="mt-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-[0.11em] text-[#61717e]">
                          Intelligence tags
                        </p>

                        <p className="mt-1 text-[10px] text-[#52616e]">
                          Analyst and enrichment labels associated with this IOC
                        </p>
                      </div>

                      <span className="text-[9px] text-[#52616e]">
                        {indicator.tags.length}{" "}
                        {indicator.tags.length === 1
                          ? "tag"
                          : "tags"}
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {indicator.tags.length > 0 ? (
                        indicator.tags.map(
                          (tag) => (
                            <span
                              key={tag}
                              className="rounded-[6px] border border-[#2a3945] bg-[#081119] px-3 py-1.5 text-[10px] text-[#8997a2]"
                            >
                              {tag}
                            </span>
                          )
                        )
                      ) : (
                        <span className="text-[11px] text-[#5c6a76]">
                          No intelligence tags assigned
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <div className="rounded-[10px] border border-[#1d2c37] bg-[#081119]/70 p-4">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#61717e]">
                        First observed
                      </p>

                      <p className="mt-2 text-[12px] font-medium text-[#d1d9df]">
                        {formatIndicatorTime(
                          indicator.first_seen
                        )}
                      </p>
                    </div>

                    <div className="rounded-[10px] border border-[#1d2c37] bg-[#081119]/70 p-4">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#61717e]">
                        Last observed
                      </p>

                      <p className="mt-2 text-[12px] font-medium text-[#d1d9df]">
                        {formatIndicatorTime(
                          indicator.last_seen
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Analyst panel */}
              <aside className="overflow-hidden rounded-[14px] border border-[#1b2a36] bg-[#0b141d]/95">
                <div className="flex items-start justify-between gap-4 border-b border-[#1a2833] px-6 py-5">
                  <div>
                    <h3 className="text-[15px] font-semibold text-[#e8edf1]">
                      Analyst assessment
                    </h3>

                    <p className="mt-1 text-[11px] text-[#657481]">
                      Classification and investigation pivots
                    </p>
                  </div>

                  <ReputationBadge
                    reputation={
                      indicator.reputation
                    }
                  />
                </div>

                <div className="p-6">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.11em] text-[#61717e]">
                    Confidence score
                  </p>

                  <div className="mt-3 flex items-end justify-between gap-4">
                    <div>
                      <span className="text-[42px] font-semibold leading-none tracking-[-0.05em] text-[#f1f4f7]">
                        {indicator.confidence}
                      </span>

                      <span className="ml-1 text-[13px] text-[#5c6b77]">
                        /100
                      </span>
                    </div>

                    <span className="text-right text-[10px] leading-5 text-[#768590]">
                      {getConfidenceDescription(
                        indicator.confidence
                      )}
                    </span>
                  </div>

                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#18242d]">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width:
                          `${Math.min(
                            Math.max(
                              indicator.confidence,
                              0
                            ),
                            100
                          )}%`,
                        background:
                          getConfidenceAccent(
                            indicator.confidence
                          ),
                      }}
                    />
                  </div>

                  <div className="my-6 border-t border-[#1a2833]" />

                  <p className="text-[9px] font-semibold uppercase tracking-[0.11em] text-[#61717e]">
                    Investigation pivots
                  </p>

                  <div className="mt-4 space-y-3">
                    <ResourceLink
                      title="Hunt this indicator"
                      description="Search normalized telemetry for matching activity."
                      href={
                        `/hunt?run=1&contains=${encodeURIComponent(
                          indicator.value
                        )}`
                      }
                      accent="#d5b35f"
                    />

                    <ResourceLink
                      title="Review security events"
                      description={`${relatedEvents.length} correlated ${
                        relatedEvents.length === 1
                          ? "event"
                          : "events"
                      } identified.`}
                      href="/events"
                      accent="#69c5d7"
                    />

                    <ResourceLink
                      title="Review alert queue"
                      description="Inspect detections that may reference related activity."
                      href="/alerts"
                      accent="#69c59f"
                    />
                  </div>
                </div>
              </aside>
            </section>

            {/* Related telemetry */}
            <section className="mt-5 overflow-hidden rounded-[14px] border border-[#1b2a36] bg-[#0b141d]/95">
              <div className="flex items-start justify-between gap-8 border-b border-[#1a2833] px-6 py-5">
                <div className="flex items-start gap-3">
                  <span className="mt-[6px] h-2 w-2 shrink-0 rounded-full bg-[#69c5d7]" />

                  <div>
                    <h3 className="text-[15px] font-semibold text-[#e8edf1]">
                      Related telemetry
                    </h3>

                    <p className="mt-1 text-[11px] text-[#657481]">
                      Normalized security events containing
                      this indicator in correlated telemetry fields.
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-[11px] font-semibold text-[#dce3e8]">
                    {relatedEvents.length}{" "}
                    {relatedEvents.length === 1
                      ? "event"
                      : "events"}
                  </p>

                  <p className="mt-1 text-[9px] uppercase tracking-[0.1em] text-[#53626e]">
                    Correlation results
                  </p>
                </div>
              </div>

              {relatedEvents.length > 0 ? (
                <div className="overflow-x-auto">
                  <div className="min-w-[1050px]">

                    <div className="grid grid-cols-[135px_1.5fr_0.85fr_1.1fr_1fr_120px] gap-5 border-b border-[#192733] bg-[#071019]/70 px-6 py-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#61717e]">
                      <span>
                        Time
                      </span>

                      <span>
                        Activity
                      </span>

                      <span>
                        Source
                      </span>

                      <span>
                        Identity / Host
                      </span>

                      <span>
                        Network
                      </span>

                      <span>
                        Event
                      </span>
                    </div>

                    <div className="divide-y divide-[#192733]">
                      {relatedEvents.map(
                        (event) => (
                          <RelatedEventRow
                            key={
                              event.id
                            }
                            event={
                              event
                            }
                          />
                        )
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[240px] items-center justify-center px-8 py-14">
                  <div className="max-w-md text-center">
                    <div className="mx-auto h-2 w-2 rounded-full bg-[#536571]" />

                    <p className="mt-4 text-[14px] font-medium text-[#dce3e8]">
                      No correlated telemetry found
                    </p>

                    <p className="mt-2 text-[12px] leading-5 text-[#657481]">
                      CASE//ZERO did not find this
                      indicator in the currently normalized
                      event fields.
                    </p>

                    <Link
                      href={
                        `/hunt?run=1&contains=${encodeURIComponent(
                          indicator.value
                        )}`
                      }
                      className="mt-5 inline-flex items-center gap-2 rounded-[8px] border border-[#5c5130] bg-[#c9a965]/[0.05] px-4 py-2 text-[11px] font-medium text-[#d8bd78] transition hover:bg-[#c9a965]/[0.1]"
                    >
                      Search manually
                      <span>
                        →
                      </span>
                    </Link>
                  </div>
                </div>
              )}
            </section>

            {/* Observation lifecycle */}
            <section className="mt-5 overflow-hidden rounded-[14px] border border-[#1b2a36] bg-[#0b141d]/95">
              <div className="border-b border-[#1a2833] px-6 py-5">
                <h3 className="text-[15px] font-semibold text-[#e8edf1]">
                  Observation lifecycle
                </h3>

                <p className="mt-1 text-[11px] text-[#657481]">
                  Intelligence record creation,
                  enrichment, and observation timestamps.
                </p>
              </div>

              <div className="grid md:grid-cols-2 xl:grid-cols-4">
                <TimelineField
                  index="01"
                  label="First seen"
                  value={
                    formatIndicatorTime(
                      indicator.first_seen
                    )
                  }
                />

                <TimelineField
                  index="02"
                  label="Last seen"
                  value={
                    formatIndicatorTime(
                      indicator.last_seen
                    )
                  }
                />

                <TimelineField
                  index="03"
                  label="Record created"
                  value={
                    formatIndicatorTime(
                      indicator.created_at
                    )
                  }
                />

                <TimelineField
                  index="04"
                  label="Last updated"
                  value={
                    formatIndicatorTime(
                      indicator.updated_at
                    )
                  }
                />
              </div>
            </section>

            {/* Technical metadata */}
            <section className="mt-5 rounded-[14px] border border-[#1b2a36] bg-[#0b141d]/95 p-6">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <h3 className="text-[14px] font-semibold text-[#dfe5e9]">
                    Technical metadata
                  </h3>

                  <p className="mt-1 text-[11px] text-[#657481]">
                    Internal CASE//ZERO intelligence record identifier.
                  </p>
                </div>

                <span className="rounded-[5px] border border-[#293944] bg-[#081119] px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.08em] text-[#71818d]">
                  Record ID
                </span>
              </div>

              <code className="mt-5 block overflow-x-auto rounded-[9px] border border-[#1d2c37] bg-[#060d13] px-4 py-3 text-[11px] text-[#84939e]">
                {indicator.id}
              </code>
            </section>

          </div>
        </main>
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
    <div className="relative overflow-hidden rounded-[14px] border border-[#1d2c38] bg-[linear-gradient(180deg,rgba(15,28,39,0.98),rgba(11,21,30,0.98))] p-5">
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
              0.75,
          }}
        />
      </div>

      <p className="mt-4 break-words text-[25px] font-semibold leading-tight tracking-[-0.04em] text-[#f3f5f7]">
        {value}
      </p>

      <p className="mt-4 text-[11px] text-[#657481]">
        {context}
      </p>
    </div>
  );
}


function DetailField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="border-b border-[#1b2934] px-4 py-5 even:border-l md:[&:nth-last-child(-n+2)]:border-b-0">
      <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#60707c]">
        {label}
      </p>

      <p className="mt-2 break-words text-[11px] font-medium text-[#cbd4da]">
        {value}
      </p>
    </div>
  );
}


function HeaderStatus({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="max-w-[180px] rounded-[10px] border border-[#1d2d39] bg-[#0b141d]/80 px-4 py-3">
      <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#61717e]">
        {label}
      </p>

      <p className="mt-1 truncate text-[11px] font-medium text-[#d2dae0]">
        {value}
      </p>
    </div>
  );
}


function ResourceLink({
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
      className="group block rounded-[9px] border border-[#1e2d38] bg-[#081119]/70 p-4 transition hover:border-[#344753] hover:bg-[#0b161f]"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{
              background:
                accent,
            }}
          />

          <p className="text-[11px] font-semibold text-[#d8e0e5]">
            {title}
          </p>
        </div>

        <span className="text-[#c9a965] transition group-hover:translate-x-0.5">
          →
        </span>
      </div>

      <p className="mt-2 pl-5 text-[10px] leading-5 text-[#657481]">
        {description}
      </p>
    </Link>
  );
}


function RelatedEventRow({
  event,
}: {
  event: SecurityEvent;
}) {
  return (
    <div className="grid grid-cols-[135px_1.5fr_0.85fr_1.1fr_1fr_120px] items-center gap-5 px-6 py-4 transition hover:bg-[#101c26]">

      <div>
        <p className="font-mono text-[10px] text-[#aab5bd]">
          {formatEventClock(
            event.event_time
          )}
        </p>

        <p className="mt-1 text-[8px] text-[#52616e]">
          {formatEventDate(
            event.event_time
          )}
        </p>
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <EventTypeBadge
            eventType={
              event.event_type
            }
          />

          <p className="truncate text-[11px] font-semibold text-[#dce3e8]">
            {getEventTitle(
              event
            )}
          </p>
        </div>

        <p className="mt-1 truncate font-mono text-[8px] text-[#586773]">
          {getEventDescription(
            event
          )}
        </p>
      </div>

      <div>
        <p className="text-[10px] text-[#b7c2ca]">
          {formatLabel(
            event.source
          )}
        </p>

        <p className="mt-1 text-[8px] uppercase tracking-[0.08em] text-[#52616e]">
          Telemetry
        </p>
      </div>

      <div className="min-w-0">
        <p className="truncate text-[10px] font-medium text-[#c9d2d8]">
          {event.hostname
            ?? "Unknown host"}
        </p>

        <p className="mt-1 truncate text-[8px] text-[#586773]">
          {event.username
            ?? "Unknown user"}
        </p>
      </div>

      <div>
        <p className="truncate font-mono text-[9px] text-[#8e9ca6]">
          {event.source_ip
            ?? "—"}
        </p>

        {event.destination_ip && (
          <p className="mt-1 truncate font-mono text-[8px] text-[#586773]">
            → {event.destination_ip}
          </p>
        )}
      </div>

      <div>
        <Link
          href={
            `/events/${event.id}`
          }
          className="inline-flex items-center gap-2 rounded-[7px] border border-[#263743] bg-[#09131b] px-3 py-2 text-[10px] font-semibold text-[#b9c4cc] transition hover:border-[#536672] hover:text-white"
        >
          Inspect
          <span className="text-[#c9a965]">
            →
          </span>
        </Link>
      </div>
    </div>
  );
}


function TimelineField({
  index,
  label,
  value,
}: {
  index: string;
  label: string;
  value: string;
}) {
  return (
    <div className="border-b border-[#1b2934] p-6 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
      <div className="flex items-center gap-3">
        <span className="font-mono text-[8px] text-[#53626e]">
          {index}
        </span>

        <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#657582]">
          {label}
        </p>
      </div>

      <p className="mt-3 text-[11px] font-medium text-[#cdd6dc]">
        {value}
      </p>
    </div>
  );
}


function EventTypeBadge({
  eventType,
}: {
  eventType: string;
}) {
  const normalized =
    eventType.toLowerCase();

  const styles: Record<
    string,
    string
  > = {
    process_creation:
      "border-[#4c4128] bg-[#272111] text-[#d7bb6e]",

    authentication:
      "border-[#29415a] bg-[#132238] text-[#8eb7e9]",

    network_connection:
      "border-[#245058] bg-[#10292f] text-[#7bd2dc]",

    file_creation:
      "border-[#5b3923] bg-[#2b1c12] text-[#dda271]",
  };

  return (
    <span
      className={`shrink-0 rounded-[5px] border px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.04em] ${
        styles[normalized]
        ?? "border-[#35434e] bg-[#17212a] text-[#98a5af]"
      }`}
    >
      {formatEventType(
        eventType
      )}
    </span>
  );
}


function IndicatorTypeBadge({
  indicatorType,
}: {
  indicatorType: string;
}) {
  const normalized =
    indicatorType.toLowerCase();

  const styles: Record<
    string,
    string
  > = {
    ip:
      "border-[#284258] bg-[#132235] text-[#8ab7ec]",

    domain:
      "border-[#3c3559] bg-[#211a37] text-[#b29ae8]",

    url:
      "border-[#27504c] bg-[#102b28] text-[#79cdbf]",

    hash:
      "border-[#524125] bg-[#2b2112] text-[#d4b16c]",
  };

  return (
    <span
      className={`inline-flex rounded-[5px] border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.04em] ${
        styles[normalized]
        ?? "border-[#33434f] bg-[#17212a] text-[#9aa7b1]"
      }`}
    >
      {formatIndicatorType(
        indicatorType
      )}
    </span>
  );
}


function ReputationBadge({
  reputation,
}: {
  reputation: string;
}) {
  const normalized =
    reputation.toLowerCase();

  const styles: Record<
    string,
    string
  > = {
    malicious:
      "border-[#673239] bg-[#32161b] text-[#ef8585]",

    suspicious:
      "border-[#624225] bg-[#301f12] text-[#e5a66e]",

    unknown:
      "border-[#374550] bg-[#172129] text-[#96a3ad]",

    benign:
      "border-[#285245] bg-[#112a23] text-[#78d0aa]",
  };

  return (
    <span
      className={`inline-flex rounded-[5px] border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.04em] ${
        styles[normalized]
        ?? "border-[#374550] bg-[#172129] text-[#96a3ad]"
      }`}
    >
      {reputation}
    </span>
  );
}


function findRelatedEvents(
  indicatorType: string,
  value: string,
  events: SecurityEvent[]
): SecurityEvent[] {
  const normalizedType =
    indicatorType.toLowerCase();

  const normalizedValue =
    value.toLowerCase();

  return events.filter(
    (event) => {
      if (
        normalizedType === "ip"
      ) {
        return (
          event.source_ip
          === value
          || event.destination_ip
          === value
        );
      }

      if (
        normalizedType === "domain"
        || normalizedType === "url"
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

      if (
        normalizedType === "hash"
      ) {
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


function getEventTitle(
  event: SecurityEvent
) {
  if (
    event.event_type.toLowerCase()
    === "process_creation"
  ) {
    return (
      event.process_name
      ?? "Process execution"
    );
  }

  if (
    event.event_type.toLowerCase()
    === "authentication"
  ) {
    return "Authentication activity";
  }

  return formatEventType(
    event.event_type
  );
}


function getEventDescription(
  event: SecurityEvent
) {
  if (
    event.command_line
  ) {
    return event.command_line;
  }

  if (
    event.source_ip
    && event.destination_ip
  ) {
    return `${event.source_ip} → ${event.destination_ip}`;
  }

  if (
    event.source_ip
  ) {
    return `Source IP: ${event.source_ip}`;
  }

  return `Event ID: ${event.id}`;
}


function getConfidenceDescription(
  confidence: number
) {
  if (
    confidence >= 90
  ) {
    return "Very high confidence";
  }

  if (
    confidence >= 80
  ) {
    return "High confidence";
  }

  if (
    confidence >= 60
  ) {
    return "Moderate confidence";
  }

  return "Low confidence";
}


function getConfidenceAccent(
  confidence: number
) {
  if (
    confidence >= 80
  ) {
    return "#69c59f";
  }

  if (
    confidence >= 50
  ) {
    return "#d5b35f";
  }

  return "#7e8b96";
}


function getReputationAccent(
  reputation: string
) {
  switch (
    reputation.toLowerCase()
  ) {
    case "malicious":
      return "#df7171";

    case "suspicious":
      return "#d99a5e";

    case "benign":
      return "#69c59f";

    default:
      return "#758591";
  }
}


function formatIndicatorType(
  indicatorType: string
) {
  const normalized =
    indicatorType.toLowerCase();

  const labels: Record<
    string,
    string
  > = {
    ip:
      "IP Address",

    domain:
      "Domain",

    url:
      "URL",

    hash:
      "File Hash",
  };

  return (
    labels[normalized]
    ?? formatLabel(
      indicatorType
    )
  );
}


function formatEventType(
  eventType: string
) {
  return formatLabel(
    eventType
  );
}


function formatLabel(
  value: string
) {
  return value
    .replaceAll(
      "_",
      " "
    )
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase()
    );
}


function formatIndicatorTime(
  timestamp:
    | string
    | null
    | undefined
) {
  if (!timestamp) {
    return "Unavailable";
  }

  const date =
    new Date(timestamp);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Unavailable";
  }

  return new Intl.DateTimeFormat(
    "en-CA",
    {
      dateStyle:
        "medium",
      timeStyle:
        "short",
    }
  ).format(
    date
  );
}


function formatCompactTime(
  timestamp:
    | string
    | null
    | undefined
) {
  if (!timestamp) {
    return "Unavailable";
  }

  const date =
    new Date(timestamp);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Unavailable";
  }

  return new Intl.DateTimeFormat(
    "en-CA",
    {
      month:
        "short",
      day:
        "numeric",
      hour:
        "numeric",
      minute:
        "2-digit",
    }
  ).format(
    date
  );
}


function formatEventClock(
  timestamp: string
) {
  const date =
    new Date(timestamp);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat(
    "en-CA",
    {
      hour:
        "numeric",
      minute:
        "2-digit",
      second:
        "2-digit",
    }
  ).format(
    date
  );
}


function formatEventDate(
  timestamp: string
) {
  const date =
    new Date(timestamp);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "en-CA",
    {
      month:
        "short",
      day:
        "numeric",
    }
  ).format(
    date
  );
}