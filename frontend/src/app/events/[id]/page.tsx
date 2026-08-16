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

  const alerts = await getAlerts();

  const triggeredAlerts = alerts.filter(
    (alert) =>
      alert.source_event_id ===
      securityEvent.id
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">

      <div className="flex min-h-screen">

        <Sidebar />

        <main className="flex-1 p-10">

          <div className="mb-8">

            <Link
              href="/events"
              className="text-sm text-zinc-500 transition hover:text-zinc-200"
            >
              ← Back to Events
            </Link>

          </div>

          {/* Header */}
          <header className="mb-8 flex items-start justify-between gap-6">

            <div>

              <p className="text-sm text-emerald-400">
                CASE//ZERO / SECURITY EVENT
              </p>

              <h2 className="mt-2 text-3xl font-semibold">
                {getEventTitle(
                  securityEvent.event_type,
                  securityEvent.process_name
                )}
              </h2>

              <p className="mt-3 text-sm text-zinc-500">
                Review normalized security telemetry and detection results.
              </p>

            </div>

            <EventTypeBadge
              eventType={
                securityEvent.event_type
              }
            />

          </header>

          {/* Event Details */}
          <section className="rounded-xl border border-zinc-800 bg-zinc-900">

            <div className="border-b border-zinc-800 p-6">

              <h3 className="font-medium">
                Event Details
              </h3>

              <p className="mt-1 text-sm text-zinc-500">
                Normalized telemetry associated with this security event.
              </p>

            </div>

            <div className="p-6">

              <div className="grid grid-cols-3 gap-x-8 gap-y-8">

                <DetailField
                  label="Event Type"
                  value={
                    securityEvent.event_type
                  }
                />

                <DetailField
                  label="Source"
                  value={
                    securityEvent.source
                  }
                />

                <DetailField
                  label="Event Time"
                  value={formatEventTime(
                    securityEvent.event_time
                  )}
                />

                <DetailField
                  label="Hostname"
                  value={
                    securityEvent.hostname ??
                    "Unavailable"
                  }
                />

                <DetailField
                  label="Username"
                  value={
                    securityEvent.username ??
                    "Unavailable"
                  }
                />

                <DetailField
                  label="Source IP"
                  value={
                    securityEvent.source_ip ??
                    "Unavailable"
                  }
                />

                <DetailField
                  label="Destination IP"
                  value={
                    securityEvent.destination_ip ??
                    "Unavailable"
                  }
                />

                <DetailField
                  label="Process"
                  value={
                    securityEvent.process_name ??
                    "Unavailable"
                  }
                />

                <DetailField
                  label="Ingested"
                  value={formatEventTime(
                    securityEvent.created_at
                  )}
                />

              </div>

            </div>

          </section>

          {/* Process Context */}
          <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900">

            <div className="border-b border-zinc-800 p-6">

              <h3 className="font-medium">
                Process Context
              </h3>

              <p className="mt-1 text-sm text-zinc-500">
                Process execution information captured with this event.
              </p>

            </div>

            <div className="p-6">

              <p className="text-xs uppercase tracking-wider text-zinc-500">
                Command Line
              </p>

              <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-4 font-mono text-sm leading-6 text-orange-300">
                {securityEvent.command_line ??
                  "Command line unavailable."}
              </pre>

            </div>

          </section>

          {/* Detection Results */}
          <section className="mt-6 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">

            <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-5">

              <div>

                <h3 className="font-medium">
                  Detection Results
                </h3>

                <p className="mt-1 text-sm text-zinc-500">
                  Alerts generated from this security event.
                </p>

              </div>

              <span className="text-xs text-zinc-500">
                {triggeredAlerts.length}{" "}
                {triggeredAlerts.length === 1
                  ? "alert"
                  : "alerts"}
              </span>

            </div>

            {triggeredAlerts.length === 0 ? (
              <div className="px-6 py-12 text-center">

                <div className="mx-auto h-3 w-3 rounded-full border border-emerald-700 bg-emerald-500" />

                <p className="mt-4 text-sm font-medium text-zinc-300">
                  No detection matched this event
                </p>

                <p className="mt-2 text-sm text-zinc-500">
                  The event was ingested successfully but did not generate an alert.
                </p>

              </div>
            ) : (
              <div className="divide-y divide-zinc-800">

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

          </section>

          {/* Raw Event Data */}
          <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900">

            <div className="border-b border-zinc-800 p-6">

              <h3 className="font-medium">
                Raw Event Data
              </h3>

              <p className="mt-1 text-sm text-zinc-500">
                Additional telemetry retained from the original event.
              </p>

            </div>

            <div className="p-6">

              {securityEvent.raw_data ? (
                <pre className="max-h-96 overflow-auto rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-4 font-mono text-xs leading-6 text-zinc-400">
                  {JSON.stringify(
                    securityEvent.raw_data,
                    null,
                    2
                  )}
                </pre>
              ) : (
                <p className="text-sm text-zinc-500">
                  No raw event data was provided.
                </p>
              )}

            </div>

          </section>

          {/* Technical Metadata */}
          <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6">

            <h3 className="font-medium">
              Technical Metadata
            </h3>

            <p className="mt-1 text-sm text-zinc-500">
              Internal CASE//ZERO security event identifiers.
            </p>

            <div className="mt-6">

              <p className="text-xs uppercase tracking-wider text-zinc-500">
                Security Event ID
              </p>

              <code className="mt-2 block rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-400">
                {securityEvent.id}
              </code>

            </div>

          </section>

        </main>

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
      className="flex items-center justify-between gap-6 px-6 py-5 transition hover:bg-zinc-800/40"
    >

      <div className="min-w-0">

        <div className="flex flex-wrap items-center gap-3">

          <SeverityBadge
            severity={alert.severity}
          />

          <StatusBadge
            status={alert.status}
          />

          <span className="text-xs text-zinc-500">
            {alert.source}
          </span>

        </div>

        <p className="mt-3 text-sm font-medium text-zinc-100">
          {alert.title}
        </p>

        {alert.description && (
          <p className="mt-1 truncate text-xs text-zinc-500">
            {alert.description}
          </p>
        )}

      </div>

      <div className="shrink-0 text-right">

        <p className="text-xs text-zinc-500">
          {formatEventTime(
            alert.created_at
          )}
        </p>

        <p className="mt-2 text-sm font-medium text-emerald-400">
          View Alert →
        </p>

      </div>

    </Link>
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
    <div>

      <p className="text-xs uppercase tracking-wider text-zinc-500">
        {label}
      </p>

      <p className="mt-2 break-words text-sm text-zinc-300">
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
  const normalizedEventType =
    eventType.toLowerCase();

  const styles: Record<
    string,
    string
  > = {
    process_creation:
      "border-violet-900 bg-violet-950 text-violet-400",

    authentication:
      "border-blue-900 bg-blue-950 text-blue-400",

    network_connection:
      "border-cyan-900 bg-cyan-950 text-cyan-400",

    file_creation:
      "border-orange-900 bg-orange-950 text-orange-400",
  };

  return (
    <span
      className={`rounded-md border px-3 py-1.5 text-xs font-medium uppercase ${
        styles[
          normalizedEventType
        ] ??
        "border-zinc-700 bg-zinc-800 text-zinc-400"
      }`}
    >
      {eventType.replaceAll(
        "_",
        " "
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
      "border-zinc-700 bg-zinc-800 text-zinc-300",

    assigned:
      "border-blue-900 bg-blue-950 text-blue-400",

    investigating:
      "border-yellow-900 bg-yellow-950 text-yellow-400",

    resolved:
      "border-emerald-900 bg-emerald-950 text-emerald-400",

    closed:
      "border-zinc-800 bg-zinc-950 text-zinc-500",
  };

  return (
    <span
      className={`rounded-md border px-2.5 py-1 text-xs font-medium uppercase ${
        styles[
          normalizedStatus
        ] ??
        "border-zinc-700 bg-zinc-800 text-zinc-400"
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
  if (
    eventType.toLowerCase() ===
    "process_creation"
  ) {
    return (
      processName ??
      "Process Creation"
    );
  }

  return eventType.replaceAll(
    "_",
    " "
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
    new Date(timestamp)
  );
}