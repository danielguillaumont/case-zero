import Link from "next/link";

import Sidebar from "@/components/Sidebar";

import {
  getSecurityEvents,
} from "@/lib/api";

import type {
  SecurityEvent,
} from "@/lib/api";


export default async function EventsPage() {
  const events = await getSecurityEvents();

  const processEvents = events.filter(
    (event) =>
      event.event_type.toLowerCase() ===
      "process_creation"
  );

  const uniqueHosts = new Set(
    events
      .map((event) => event.hostname)
      .filter(
        (hostname): hostname is string =>
          Boolean(hostname)
      )
  );

  const uniqueUsers = new Set(
    events
      .map((event) => event.username)
      .filter(
        (username): username is string =>
          Boolean(username)
      )
  );

  const metrics = [
    {
      label: "Total Events",
      value: events.length,
    },
    {
      label: "Process Events",
      value: processEvents.length,
    },
    {
      label: "Unique Hosts",
      value: uniqueHosts.size,
    },
    {
      label: "Unique Users",
      value: uniqueUsers.size,
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
                Security Event Explorer
              </h2>

              <p className="mt-2 text-sm text-zinc-500">
                Review normalized security telemetry ingested by the platform.
              </p>

            </div>

            <div className="rounded-full border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-zinc-400">
              Live Telemetry
            </div>

          </header>

          <section>

            <h3 className="mb-4 text-sm font-medium uppercase tracking-wider text-zinc-500">
              Event Overview
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

            <div className="border-b border-zinc-800 p-6">

              <div className="flex items-center justify-between">

                <div>

                  <h3 className="font-medium">
                    Security Events
                  </h3>

                  <p className="mt-1 text-sm text-zinc-500">
                    Normalized telemetry currently stored in CASE//ZERO.
                  </p>

                </div>

                <span className="text-xs text-zinc-500">
                  {events.length} total
                </span>

              </div>

            </div>

            {events.length === 0 ? (
              <div className="flex min-h-64 items-center justify-center">

                <div className="text-center">

                  <p className="text-sm font-medium text-zinc-300">
                    No security events found
                  </p>

                  <p className="mt-2 text-sm text-zinc-500">
                    Events ingested through the CASE//ZERO API will appear here.
                  </p>

                </div>

              </div>
            ) : (
              <div>

                <div className="grid grid-cols-[170px_1fr_150px_220px_190px] gap-4 border-b border-zinc-800 bg-zinc-950/40 px-6 py-3 text-xs uppercase tracking-wider text-zinc-500">

                  <span>
                    Event Type
                  </span>

                  <span>
                    Event
                  </span>

                  <span>
                    Source
                  </span>

                  <span>
                    Identity / Host
                  </span>

                  <span>
                    Event Time
                  </span>

                </div>

                <div className="divide-y divide-zinc-800">

                  {events.map(
                    (event) => (
                      <SecurityEventRow
                        key={event.id}
                        event={event}
                      />
                    )
                  )}

                </div>

              </div>
            )}

          </section>

        </main>

      </div>

    </div>
  );
}


function SecurityEventRow({
  event,
}: {
  event: SecurityEvent;
}) {
  return (
    <Link
      href={`/events/${event.id}`}
      className="grid grid-cols-[170px_1fr_150px_220px_190px] items-center gap-4 px-6 py-5 transition hover:bg-zinc-800/40"
    >

      <EventTypeBadge
        eventType={event.event_type}
      />

      <div className="min-w-0">

        <p className="truncate text-sm font-medium text-zinc-100">
          {getEventTitle(event)}
        </p>

        <p className="mt-1 truncate text-xs text-zinc-500">
          {getEventDescription(event)}
        </p>

      </div>

      <span className="truncate text-sm text-zinc-400">
        {event.source}
      </span>

      <div className="min-w-0">

        <p className="truncate text-sm text-zinc-300">
          {event.hostname ??
            "Unknown host"}
        </p>

        <p className="mt-1 truncate text-xs text-zinc-500">
          {event.username ??
            "Unknown user"}
        </p>

      </div>

      <span className="text-sm text-zinc-500">
        {formatEventTime(
          event.event_time
        )}
      </span>

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
      className={`w-fit rounded-md border px-2.5 py-1 text-xs font-medium uppercase ${
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


function getEventTitle(
  event: SecurityEvent
) {
  if (
    event.event_type.toLowerCase() ===
    "process_creation"
  ) {
    return (
      event.process_name ??
      "Process creation"
    );
  }

  return event.event_type.replaceAll(
    "_",
    " "
  );
}


function getEventDescription(
  event: SecurityEvent
) {
  if (event.command_line) {
    return event.command_line;
  }

  if (
    event.source_ip &&
    event.destination_ip
  ) {
    return `${event.source_ip} → ${event.destination_ip}`;
  }

  if (event.source_ip) {
    return `Source IP: ${event.source_ip}`;
  }

  return `Event ID: ${event.id}`;
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