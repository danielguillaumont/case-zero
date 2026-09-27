import Link from "next/link";
import { notFound } from "next/navigation";

import Sidebar from "@/components/Sidebar";

import {
  getAlerts,
  getSecurityEvent,
} from "@/lib/api";

import type {
  Alert,
} from "@/lib/api";


export default async function SecurityEventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const securityEvent =
    await getSecurityEvent(id);

  if (!securityEvent) {
    notFound();
  }

  const alerts =
    await getAlerts();

  const triggeredAlerts =
    alerts.filter(
      (alert) =>
        alert.source_event_id ===
        securityEvent.id
    );

  const normalizedEventType =
    securityEvent.event_type.toLowerCase();

  const isAuthenticationEvent =
    normalizedEventType ===
    "authentication";

  const isProcessCreationEvent =
    normalizedEventType ===
    "process_creation";

  const eventTitle =
    getEventTitle(
      securityEvent.event_type,
      securityEvent.process_name
    );

  const sourceAddress =
    securityEvent.source_ip ??
    "Unavailable";

  const destinationAddress =
    securityEvent.destination_ip ??
    "Unavailable";

  const identity =
    securityEvent.username ??
    "Unknown identity";

  const host =
    securityEvent.hostname ??
    "Unknown host";

  return (
    <div className="min-h-screen text-[#f1f4f7]">
      <div className="flex min-h-screen">
        <Sidebar />

        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-[1700px] px-8 py-8 xl:px-10 xl:py-10">

            {/* Breadcrumb */}
            <div className="mb-6 flex items-center gap-2 text-[11px]">
              <Link
                href="/events"
                className="text-[#72818d] transition hover:text-[#dbe3e8]"
              >
                Security Events
              </Link>

              <span className="text-[#46535e]">
                /
              </span>

              <span className="text-[#9aa6af]">
                Event Investigation
              </span>
            </div>

            {/* Header */}
            <header className="cz-dashboard-header mb-7 flex items-start justify-between gap-8">
              <div className="min-w-0">

                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <span className="text-[12px] font-semibold text-[#c9a965]">
                    Security Operations
                  </span>

                  <span className="h-px w-8 bg-[#c9a965]/40" />

                  <span className="text-[11px] text-[#667583]">
                    Event Investigation
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="break-words text-[34px] font-semibold tracking-[-0.04em] text-[#f4f6f8]">
                    {eventTitle}
                  </h1>

                  <EventTypeBadge
                    eventType={
                      securityEvent.event_type
                    }
                  />
                </div>

                <p className="mt-3 max-w-3xl text-[13px] leading-6 text-[#81909c]">
                  Inspect normalized telemetry,
                  associated entities, execution
                  context, and detection results
                  for this security event.
                </p>
              </div>

              <div className="hidden shrink-0 items-stretch gap-3 pt-1 lg:flex">

                <div className="rounded-[10px] border border-white/[0.075] bg-[#0b1219]/80 px-4 py-3">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#5f6e7a]">
                    Source
                  </p>

                  <p className="mt-1 text-[11px] font-medium text-[#d2d9df]">
                    {securityEvent.source}
                  </p>
                </div>

                <div className="rounded-[10px] border border-[#63cfa4]/15 bg-[#63cfa4]/[0.045] px-4 py-3">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#668c7d]">
                    Detection
                  </p>

                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        triggeredAlerts.length > 0
                          ? "bg-[#d9a950]"
                          : "bg-[#63cfa4]"
                      }`}
                    />

                    <p
                      className={`text-[11px] font-medium ${
                        triggeredAlerts.length > 0
                          ? "text-[#e4bd6e]"
                          : "text-[#84d8b7]"
                      }`}
                    >
                      {
                        triggeredAlerts.length > 0
                          ? `${triggeredAlerts.length} alert${
                              triggeredAlerts.length === 1
                                ? ""
                                : "s"
                            }`
                          : "No match"
                      }
                    </p>
                  </div>
                </div>

              </div>
            </header>

            {/* Snapshot */}
            <section>
              <div className="mb-3 flex items-end justify-between">
                <div>
                  <h2 className="text-[14px] font-medium text-[#dce3e8]">
                    Event snapshot
                  </h2>

                  <p className="mt-1 text-[11px] text-[#657481]">
                    Core telemetry captured for this record
                  </p>
                </div>

                <p className="text-[10px] text-[#5e6d79]">
                  Ingested{" "}
                  {formatEventTime(
                    securityEvent.created_at
                  )}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">

                <SnapshotCard
                  label="Event time"
                  value={formatEventTime(
                    securityEvent.event_time
                  )}
                  context="Recorded occurrence"
                  accent="#69c5d7"
                  compact
                />

                <SnapshotCard
                  label="Host"
                  value={host}
                  context="Observed endpoint"
                  accent="#c9a965"
                  compact
                />

                <SnapshotCard
                  label="Identity"
                  value={identity}
                  context="Associated user"
                  accent="#7ca3d8"
                  compact
                />

                <SnapshotCard
                  label="Detection results"
                  value={String(
                    triggeredAlerts.length
                  )}
                  context={
                    triggeredAlerts.length === 1
                      ? "Linked alert"
                      : "Linked alerts"
                  }
                  accent={
                    triggeredAlerts.length > 0
                      ? "#df9659"
                      : "#63cfa4"
                  }
                />

              </div>
            </section>

            {/* Main investigation grid */}
            <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(340px,0.75fr)]">

              {/* Event context */}
              <div className="overflow-hidden rounded-[14px] border border-white/[0.075] bg-[linear-gradient(180deg,rgba(17,25,35,0.96),rgba(13,20,28,0.96))] shadow-[0_18px_50px_rgba(0,0,0,0.18)]">

                <div className="flex items-start justify-between border-b border-white/[0.07] px-6 py-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-[#69c5d7]" />

                      <h2 className="text-[15px] font-semibold text-[#e9eef2]">
                        Event context
                      </h2>
                    </div>

                    <p className="mt-1.5 text-[11px] text-[#687784]">
                      Normalized telemetry and entity relationships
                    </p>
                  </div>

                  <span className="rounded-md border border-white/[0.07] bg-black/10 px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.08em] text-[#657481]">
                    Normalized
                  </span>
                </div>

                <div className="grid md:grid-cols-2">

                  <ContextField
                    label="Event type"
                    value={formatEventType(
                      securityEvent.event_type
                    )}
                  />

                  <ContextField
                    label="Telemetry source"
                    value={securityEvent.source}
                  />

                  <ContextField
                    label="Endpoint"
                    value={host}
                  />

                  <ContextField
                    label="Identity"
                    value={identity}
                  />

                  <ContextField
                    label="Source address"
                    value={sourceAddress}
                    mono
                  />

                  <ContextField
                    label="Destination address"
                    value={destinationAddress}
                    mono
                  />

                </div>

                {/* Authentication-specific context */}
                {isAuthenticationEvent && (
                  <div className="border-t border-white/[0.07] px-6 py-6">

                    <div className="mb-5 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#7ca3d8]">
                          Identity telemetry
                        </p>

                        <h3 className="mt-1.5 text-[14px] font-semibold text-[#e4e9ed]">
                          Authentication context
                        </h3>
                      </div>

                      <span className="rounded-md border border-[#7ca3d8]/20 bg-[#7ca3d8]/[0.06] px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.08em] text-[#8db1df]">
                        Identity
                      </span>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">

                      <CompactField
                        label="Outcome"
                        value={getRawDataValue(
                          securityEvent.raw_data,
                          "outcome"
                        )}
                      />

                      <CompactField
                        label="Method"
                        value={getRawDataValue(
                          securityEvent.raw_data,
                          "authentication_method"
                        )}
                      />

                      <CompactField
                        label="Test sequence"
                        value={getRawDataValue(
                          securityEvent.raw_data,
                          "test_sequence"
                        )}
                      />

                    </div>

                  </div>
                )}

                {/* Process-specific context */}
                {isProcessCreationEvent && (
                  <div className="border-t border-white/[0.07] px-6 py-6">

                    <div className="mb-5 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#c9a965]">
                          Endpoint telemetry
                        </p>

                        <h3 className="mt-1.5 text-[14px] font-semibold text-[#e4e9ed]">
                          Process execution
                        </h3>
                      </div>

                      <span className="rounded-md border border-[#c9a965]/20 bg-[#c9a965]/[0.06] px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.08em] text-[#d9bb77]">
                        Process
                      </span>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">

                      <CompactField
                        label="Process"
                        value={
                          securityEvent.process_name ??
                          "Unavailable"
                        }
                      />

                      <CompactField
                        label="Endpoint"
                        value={host}
                      />

                    </div>

                    <div className="mt-4">
                      <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#63717d]">
                        Command line
                      </p>

                      <div className="overflow-x-auto rounded-[10px] border border-white/[0.07] bg-[#060b10] px-4 py-4">
                        <code className="whitespace-pre-wrap break-words font-mono text-[11px] leading-6 text-[#d9bb77]">
                          {
                            securityEvent.command_line ??
                            "Command line unavailable."
                          }
                        </code>
                      </div>
                    </div>

                  </div>
                )}

              </div>

              {/* Detection panel */}
              <div className="overflow-hidden rounded-[14px] border border-white/[0.075] bg-[linear-gradient(180deg,rgba(17,25,35,0.96),rgba(13,20,28,0.96))] shadow-[0_18px_50px_rgba(0,0,0,0.18)]">

                <div className="border-b border-white/[0.07] px-5 py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-[15px] font-semibold text-[#e9eef2]">
                        Detection results
                      </h2>

                      <p className="mt-1.5 text-[11px] text-[#687784]">
                        Alerts linked to this event
                      </p>
                    </div>

                    <span
                      className={`rounded-full border px-2.5 py-1 text-[9px] font-medium ${
                        triggeredAlerts.length > 0
                          ? "border-[#d9a950]/20 bg-[#d9a950]/[0.06] text-[#e0b765]"
                          : "border-[#63cfa4]/20 bg-[#63cfa4]/[0.06] text-[#78d2af]"
                      }`}
                    >
                      {triggeredAlerts.length} linked
                    </span>
                  </div>
                </div>

                {triggeredAlerts.length === 0 ? (
                  <div className="px-5 py-8">

                    <div className="rounded-[12px] border border-[#63cfa4]/15 bg-[#63cfa4]/[0.035] p-5">

                      <div className="flex items-center gap-3">
                        <span className="h-2 w-2 rounded-full bg-[#63cfa4]" />

                        <p className="text-[12px] font-medium text-[#d9e4df]">
                          No detection matched
                        </p>
                      </div>

                      <p className="mt-3 text-[11px] leading-5 text-[#71817b]">
                        The telemetry was ingested
                        successfully without generating
                        a linked security alert.
                      </p>

                    </div>

                  </div>
                ) : (
                  <div className="divide-y divide-white/[0.065]">

                    {triggeredAlerts.map(
                      (alert) => (
                        <TriggeredAlertRow
                          key={alert.id}
                          alert={alert}
                        />
                      )
                    )}

                  </div>
                )}

                <div className="border-t border-white/[0.07] px-5 py-4">
                  <Link
                    href="/alerts"
                    className="flex items-center justify-between rounded-[9px] border border-white/[0.07] bg-black/10 px-4 py-3 text-[11px] font-medium text-[#aab5be] transition hover:border-white/[0.12] hover:bg-white/[0.025] hover:text-white"
                  >
                    <span>
                      Open alert workspace
                    </span>

                    <span className="text-[#c9a965]">
                      →
                    </span>
                  </Link>
                </div>

              </div>

            </section>

            {/* Network / timeline context */}
            <section className="mt-5 grid gap-5 xl:grid-cols-2">

              <div className="overflow-hidden rounded-[14px] border border-white/[0.075] bg-[linear-gradient(180deg,rgba(17,25,35,0.94),rgba(13,20,28,0.94))]">

                <div className="border-b border-white/[0.07] px-6 py-5">
                  <h2 className="text-[14px] font-semibold text-[#e5eaee]">
                    Network context
                  </h2>

                  <p className="mt-1 text-[11px] text-[#687784]">
                    Addresses associated with this telemetry record
                  </p>
                </div>

                <div className="grid sm:grid-cols-2">

                  <NetworkField
                    label="Source"
                    value={sourceAddress}
                    accent="#69c5d7"
                  />

                  <NetworkField
                    label="Destination"
                    value={destinationAddress}
                    accent="#c9a965"
                  />

                </div>

              </div>

              <div className="overflow-hidden rounded-[14px] border border-white/[0.075] bg-[linear-gradient(180deg,rgba(17,25,35,0.94),rgba(13,20,28,0.94))]">

                <div className="border-b border-white/[0.07] px-6 py-5">
                  <h2 className="text-[14px] font-semibold text-[#e5eaee]">
                    Record timeline
                  </h2>

                  <p className="mt-1 text-[11px] text-[#687784]">
                    Event occurrence and platform ingestion
                  </p>
                </div>

                <div className="px-6 py-5">

                  <TimelineEntry
                    label="Event recorded"
                    value={formatEventTime(
                      securityEvent.event_time
                    )}
                    accent="#69c5d7"
                    first
                  />

                  <TimelineEntry
                    label="Ingested by CASE//ZERO"
                    value={formatEventTime(
                      securityEvent.created_at
                    )}
                    accent="#63cfa4"
                  />

                </div>

              </div>

            </section>

            {/* Raw telemetry */}
            <section className="mt-5 overflow-hidden rounded-[14px] border border-white/[0.075] bg-[linear-gradient(180deg,rgba(17,25,35,0.95),rgba(13,20,28,0.95))]">

              <div className="flex items-start justify-between gap-6 border-b border-white/[0.07] px-6 py-5">
                <div>
                  <h2 className="text-[14px] font-semibold text-[#e5eaee]">
                    Raw telemetry
                  </h2>

                  <p className="mt-1 text-[11px] text-[#687784]">
                    Original structured event attributes retained by the platform
                  </p>
                </div>

                <span className="rounded-md border border-white/[0.07] bg-black/10 px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.08em] text-[#657481]">
                  JSON
                </span>
              </div>

              <div className="p-5">
                {securityEvent.raw_data ? (
                  <pre className="max-h-[430px] overflow-auto rounded-[10px] border border-white/[0.07] bg-[#05090d] px-5 py-4 font-mono text-[11px] leading-6 text-[#8fa0ad]">
                    {JSON.stringify(
                      securityEvent.raw_data,
                      null,
                      2
                    )}
                  </pre>
                ) : (
                  <div className="rounded-[10px] border border-dashed border-white/[0.08] bg-black/10 px-5 py-8 text-center">
                    <p className="text-[12px] font-medium text-[#98a4ae]">
                      No raw event data
                    </p>

                    <p className="mt-1 text-[11px] text-[#5f6d78]">
                      This event does not include additional raw telemetry.
                    </p>
                  </div>
                )}
              </div>

            </section>

            {/* Technical metadata */}
            <section className="mt-5 rounded-[14px] border border-white/[0.075] bg-[#0b1118]/80 px-6 py-5">

              <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">

                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.11em] text-[#5f6e7a]">
                    Security Event ID
                  </p>

                  <code className="mt-2 block break-all font-mono text-[11px] text-[#96a5b1]">
                    {securityEvent.id}
                  </code>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#63cfa4]" />

                  <span className="text-[10px] text-[#6d7c87]">
                    CASE//ZERO normalized telemetry record
                  </span>
                </div>

              </div>

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
  compact = false,
}: {
  label: string;
  value: string;
  context: string;
  accent: string;
  compact?: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-[14px] border border-white/[0.075] bg-[linear-gradient(180deg,rgba(17,25,35,0.94),rgba(13,20,28,0.94))] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.14)]">

      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background:
            `linear-gradient(90deg, ${accent}, transparent 70%)`,
        }}
      />

      <div className="flex items-center justify-between gap-3">

        <p className="text-[11px] font-medium text-[#8996a1]">
          {label}
        </p>

        <span
          className="h-1.5 w-6 shrink-0 rounded-full"
          style={{
            background: accent,
            opacity: 0.7,
          }}
        />

      </div>

      <p
        className={`mt-4 break-words font-semibold tracking-[-0.035em] text-[#f3f5f7] ${
          compact
            ? "text-[18px] leading-6"
            : "text-[36px] leading-none"
        }`}
      >
        {value}
      </p>

      <p className="mt-4 text-[10px] text-[#657481]">
        {context}
      </p>

    </div>
  );
}


function ContextField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="border-b border-white/[0.06] px-6 py-5 md:odd:border-r">

      <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#5f6e7a]">
        {label}
      </p>

      <p
        className={`mt-2 break-words text-[12px] text-[#d1d8de] ${
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


function CompactField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[10px] border border-white/[0.07] bg-[#091017]/70 px-4 py-4">

      <p className="text-[9px] font-semibold uppercase tracking-[0.09em] text-[#5e6d79]">
        {label}
      </p>

      <p className="mt-2 break-words text-[11px] font-medium text-[#c8d0d6]">
        {value}
      </p>

    </div>
  );
}


function NetworkField({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="px-6 py-6 sm:first:border-r sm:first:border-white/[0.07]">

      <div className="flex items-center gap-2">
        <span
          className="h-2 w-2 rounded-full"
          style={{
            background: accent,
          }}
        />

        <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#64727e]">
          {label}
        </p>
      </div>

      <code className="mt-3 block break-all font-mono text-[13px] text-[#d2d9df]">
        {value}
      </code>

    </div>
  );
}


function TimelineEntry({
  label,
  value,
  accent,
  first = false,
}: {
  label: string;
  value: string;
  accent: string;
  first?: boolean;
}) {
  return (
    <div className="relative flex gap-4 pb-5 last:pb-0">

      {!first && (
        <div className="absolute left-[4px] -top-5 h-5 w-px bg-white/[0.08]" />
      )}

      <div className="relative mt-1">
        <span
          className="block h-[9px] w-[9px] rounded-full"
          style={{
            background: accent,
          }}
        />

        <span className="absolute left-[4px] top-[9px] h-[calc(100%+12px)] w-px bg-white/[0.08] last:hidden" />
      </div>

      <div>
        <p className="text-[11px] font-medium text-[#c8d0d6]">
          {label}
        </p>

        <p className="mt-1 text-[10px] text-[#687784]">
          {value}
        </p>
      </div>

    </div>
  );
}


function TriggeredAlertRow({
  alert,
}: {
  alert: Alert;
}) {
  return (
    <Link
      href={`/alerts/${alert.id}`}
      className="block px-5 py-5 transition hover:bg-white/[0.025]"
    >

      <div className="flex items-start justify-between gap-4">

        <div className="min-w-0">

          <div className="flex flex-wrap items-center gap-2">

            <SeverityBadge
              severity={alert.severity}
            />

            <StatusBadge
              status={alert.status}
            />

          </div>

          <p className="mt-3 line-clamp-2 text-[12px] font-medium leading-5 text-[#dbe2e7]">
            {alert.title}
          </p>

          {alert.description && (
            <p className="mt-1 line-clamp-2 text-[10px] leading-5 text-[#667581]">
              {alert.description}
            </p>
          )}

          <p className="mt-3 text-[9px] uppercase tracking-[0.07em] text-[#53616d]">
            {alert.source}
          </p>

        </div>

        <span className="shrink-0 text-[12px] text-[#c9a965]">
          →
        </span>

      </div>

    </Link>
  );
}


function EventTypeBadge({
  eventType,
}: {
  eventType: string;
}) {
  const normalizedEventType =
    eventType.toLowerCase();

  const styles: Record<
    string,
    string
  > = {
    process_creation:
      "border-[#c9a965]/20 bg-[#c9a965]/[0.07] text-[#d9bb77]",

    authentication:
      "border-[#7ca3d8]/20 bg-[#7ca3d8]/[0.07] text-[#8eb2e1]",

    network_connection:
      "border-[#69c5d7]/20 bg-[#69c5d7]/[0.07] text-[#86d2df]",

    file_creation:
      "border-[#df9659]/20 bg-[#df9659]/[0.07] text-[#e5a56f]",
  };

  return (
    <span
      className={`rounded-md border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] ${
        styles[
          normalizedEventType
        ] ??
        "border-white/[0.09] bg-white/[0.035] text-[#99a6b0]"
      }`}
    >
      {formatEventType(
        eventType
      )}
    </span>
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
      "border-[#69c5d7]/20 bg-[#69c5d7]/[0.07] text-[#82cfdb]",

    medium:
      "border-[#d9a950]/20 bg-[#d9a950]/[0.07] text-[#dfb760]",

    high:
      "border-[#df9659]/20 bg-[#df9659]/[0.07] text-[#e6a168]",

    critical:
      "border-[#e66b6b]/20 bg-[#e66b6b]/[0.07] text-[#eb8585]",
  };

  return (
    <span
      className={`rounded-md border px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.08em] ${
        styles[
          normalizedSeverity
        ] ??
        "border-white/[0.09] bg-white/[0.035] text-[#99a6b0]"
      }`}
    >
      {severity}
    </span>
  );
}


function StatusBadge({
  status,
}: {
  status: string;
}) {
  const normalizedStatus =
    status.toLowerCase();

  const styles: Record<
    string,
    string
  > = {
    new:
      "border-white/[0.09] bg-white/[0.04] text-[#aeb8c0]",

    assigned:
      "border-[#7ca3d8]/20 bg-[#7ca3d8]/[0.07] text-[#8eb2e1]",

    investigating:
      "border-[#d9a950]/20 bg-[#d9a950]/[0.07] text-[#dfb760]",

    resolved:
      "border-[#63cfa4]/20 bg-[#63cfa4]/[0.07] text-[#7bd7b3]",

    closed:
      "border-white/[0.07] bg-black/10 text-[#6f7c87]",
  };

  return (
    <span
      className={`rounded-md border px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.08em] ${
        styles[
          normalizedStatus
        ] ??
        "border-white/[0.09] bg-white/[0.035] text-[#99a6b0]"
      }`}
    >
      {status}
    </span>
  );
}


function getEventTitle(
  eventType: string,
  processName: string | null
) {
  const normalizedEventType =
    eventType.toLowerCase();

  if (
    normalizedEventType ===
    "process_creation"
  ) {
    return (
      processName ??
      "Process Creation"
    );
  }

  if (
    normalizedEventType ===
    "authentication"
  ) {
    return "Authentication Activity";
  }

  if (
    normalizedEventType ===
    "network_connection"
  ) {
    return "Network Connection";
  }

  if (
    normalizedEventType ===
    "file_creation"
  ) {
    return "File Creation";
  }

  return formatEventType(
    eventType
  );
}


function formatEventType(
  eventType: string
) {
  return eventType
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


function getRawDataValue(
  rawData: Record<string, unknown> | null,
  key: string
): string {
  if (!rawData) {
    return "Unavailable";
  }

  const value =
    rawData[key];

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "Unavailable";
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  return JSON.stringify(
    value
  );
}


function formatEventTime(
  timestamp: string
) {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  ).format(
    new Date(
      timestamp
    )
  );
}