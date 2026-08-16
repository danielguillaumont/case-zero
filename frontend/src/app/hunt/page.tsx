import Link from "next/link";

import Sidebar from "@/components/Sidebar";

import {
  huntSecurityEvents,
} from "@/lib/api";

import type {
  HuntQuery,
  SecurityEvent,
} from "@/lib/api";


type HuntSearchParams = {
  [key: string]:
    | string
    | string[]
    | undefined;
};


export default async function HuntPage({
  searchParams,
}: {
  searchParams:
    Promise<HuntSearchParams>;
}) {
  const params =
    await searchParams;

  const hasRun =
    getParam(
      params,
      "run"
    ) === "1";

  const eventType =
    getParam(
      params,
      "event_type"
    );

  const source =
    getParam(
      params,
      "source"
    );

  const hostname =
    getParam(
      params,
      "hostname"
    );

  const username =
    getParam(
      params,
      "username"
    );

  const sourceIp =
    getParam(
      params,
      "source_ip"
    );

  const processName =
    getParam(
      params,
      "process_name"
    );

  const contains =
    getParam(
      params,
      "contains"
    );

  const startTime =
    getParam(
      params,
      "start_time"
    );

  const endTime =
    getParam(
      params,
      "end_time"
    );

  const limit =
    getLimit(
      getParam(
        params,
        "limit"
      )
    );

  const huntQuery: HuntQuery = {
    event_type:
      eventType || null,

    source:
      source || null,

    hostname:
      hostname || null,

    username:
      username || null,

    source_ip:
      sourceIp || null,

    process_name:
      processName || null,

    contains:
      contains || null,

    start_time:
      startTime || null,

    end_time:
      endTime || null,

    limit,
  };

  const results =
    hasRun
      ? await huntSecurityEvents(
          huntQuery
        )
      : [];

  const uniqueHosts =
    new Set(
      results
        .map(
          (event) =>
            event.hostname
        )
        .filter(
          (
            hostname
          ): hostname is string =>
            Boolean(hostname)
        )
    );

  const uniqueUsers =
    new Set(
      results
        .map(
          (event) =>
            event.username
        )
        .filter(
          (
            username
          ): username is string =>
            Boolean(username)
        )
    );

  const uniqueEventTypes =
    new Set(
      results.map(
        (event) =>
          event.event_type
      )
    );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">

      <div className="flex min-h-screen">

        <Sidebar />

        <main className="flex-1 p-10">

          {/* Header */}
          <header className="mb-10 flex items-start justify-between gap-6">

            <div>

              <p className="text-sm text-emerald-400">
                CASE//ZERO
              </p>

              <h2 className="mt-1 text-3xl font-semibold">
                Threat Hunting
              </h2>

              <p className="mt-2 text-sm text-zinc-500">
                Search normalized telemetry for suspicious activity, indicators, and investigation leads.
              </p>

            </div>

            <div className="rounded-full border border-cyan-900 bg-cyan-950 px-4 py-2 text-sm text-cyan-400">
              Telemetry Search
            </div>

          </header>

          {/* Hunt Query */}
          <section className="rounded-xl border border-zinc-800 bg-zinc-900">

            <div className="border-b border-zinc-800 px-6 py-5">

              <h3 className="font-medium">
                Hunt Query
              </h3>

              <p className="mt-1 text-sm text-zinc-500">
                Combine structured filters with free-text telemetry search.
              </p>

            </div>

            <form
              method="GET"
              className="p-6"
            >

              <input
                type="hidden"
                name="run"
                value="1"
              />

              {/* Primary Search */}
              <div>

                <label
                  htmlFor="contains"
                  className="text-xs uppercase tracking-wider text-zinc-500"
                >
                  Free-Text Search
                </label>

                <input
                  id="contains"
                  name="contains"
                  type="text"
                  defaultValue={
                    contains
                  }
                  placeholder="Example: DownloadString, powershell, 203.0.113.50..."
                  className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-200 outline-none transition placeholder:text-zinc-600 focus:border-cyan-700"
                />

                <p className="mt-2 text-xs text-zinc-600">
                  Searches event metadata, identities, hosts, IP addresses, process data, command lines, and raw telemetry.
                </p>

              </div>

              {/* Structured Filters */}
              <div className="mt-6 grid grid-cols-3 gap-5">

                <HuntSelect
                  id="event_type"
                  label="Event Type"
                  defaultValue={
                    eventType
                  }
                  options={[
                    {
                      value:
                        "process_creation",
                      label:
                        "Process Creation",
                    },
                    {
                      value:
                        "authentication",
                      label:
                        "Authentication",
                    },
                    {
                      value:
                        "network_connection",
                      label:
                        "Network Connection",
                    },
                    {
                      value:
                        "file_creation",
                      label:
                        "File Creation",
                    },
                  ]}
                />

                <HuntInput
                  id="source"
                  label="Telemetry Source"
                  defaultValue={
                    source
                  }
                  placeholder="endpoint"
                />

                <HuntInput
                  id="hostname"
                  label="Hostname"
                  defaultValue={
                    hostname
                  }
                  placeholder="WS-DOWNLOAD-TEST"
                />

                <HuntInput
                  id="username"
                  label="Username"
                  defaultValue={
                    username
                  }
                  placeholder="daniel"
                />

                <HuntInput
                  id="source_ip"
                  label="Source IP"
                  defaultValue={
                    sourceIp
                  }
                  placeholder="203.0.113.50"
                />

                <HuntInput
                  id="process_name"
                  label="Process Name"
                  defaultValue={
                    processName
                  }
                  placeholder="powershell.exe"
                />

              </div>

              {/* Time / Limit */}
              <div className="mt-6 grid grid-cols-3 gap-5">

                <HuntInput
                  id="start_time"
                  label="Start Time"
                  defaultValue={
                    startTime
                  }
                  placeholder="2026-08-16T14:00:00Z"
                />

                <HuntInput
                  id="end_time"
                  label="End Time"
                  defaultValue={
                    endTime
                  }
                  placeholder="2026-08-16T16:00:00Z"
                />

                <div>

                  <label
                    htmlFor="limit"
                    className="text-xs uppercase tracking-wider text-zinc-500"
                  >
                    Result Limit
                  </label>

                  <select
                    id="limit"
                    name="limit"
                    defaultValue={
                      String(limit)
                    }
                    className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-300 outline-none transition focus:border-cyan-700"
                  >
                    <option value="25">
                      25
                    </option>

                    <option value="50">
                      50
                    </option>

                    <option value="100">
                      100
                    </option>

                    <option value="250">
                      250
                    </option>

                    <option value="500">
                      500
                    </option>
                  </select>

                </div>

              </div>

              {/* Actions */}
              <div className="mt-7 flex items-center gap-3">

                <button
                  type="submit"
                  className="rounded-lg border border-cyan-800 bg-cyan-950 px-6 py-3 text-sm font-medium text-cyan-400 transition hover:bg-cyan-900"
                >
                  Run Hunt
                </button>

                <Link
                  href="/hunt"
                  className="rounded-lg border border-zinc-700 bg-zinc-800 px-6 py-3 text-sm font-medium text-zinc-300 transition hover:bg-zinc-700"
                >
                  Clear Query
                </Link>

              </div>

            </form>

          </section>

          {/* Results Overview */}
          {hasRun && (
            <section className="mt-8">

              <p className="mb-4 text-xs uppercase tracking-[0.15em] text-zinc-500">
                Hunt Overview
              </p>

              <div className="grid grid-cols-4 gap-4">

                <MetricCard
                  label="Results"
                  value={
                    results.length
                  }
                />

                <MetricCard
                  label="Event Types"
                  value={
                    uniqueEventTypes.size
                  }
                />

                <MetricCard
                  label="Unique Hosts"
                  value={
                    uniqueHosts.size
                  }
                />

                <MetricCard
                  label="Unique Users"
                  value={
                    uniqueUsers.size
                  }
                />

              </div>

            </section>
          )}

          {/* Results */}
          <section className="mt-8 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">

            <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-5">

              <div>

                <h3 className="font-medium">
                  Hunt Results
                </h3>

                <p className="mt-1 text-sm text-zinc-500">
                  Matching security telemetry returned by the CASE//ZERO hunt engine.
                </p>

              </div>

              {hasRun && (
                <span className="text-xs text-zinc-500">
                  {results.length}{" "}
                  {results.length === 1
                    ? "match"
                    : "matches"}
                </span>
              )}

            </div>

            {!hasRun ? (
              <div className="px-6 py-16 text-center">

                <div className="mx-auto h-3 w-3 rounded-full border border-cyan-700 bg-cyan-500" />

                <p className="mt-4 text-sm font-medium text-zinc-300">
                  Ready to hunt
                </p>

                <p className="mt-2 text-sm text-zinc-500">
                  Enter one or more filters above and run the hunt.
                </p>

              </div>
            ) : results.length === 0 ? (
              <div className="px-6 py-16 text-center">

                <p className="text-sm font-medium text-zinc-300">
                  No matching telemetry
                </p>

                <p className="mt-2 text-sm text-zinc-500">
                  Try broadening the hunt criteria or clearing one of the filters.
                </p>

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

                  {results.map(
                    (event) => (
                      <HuntResultRow
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


function HuntInput({
  id,
  label,
  defaultValue,
  placeholder,
}: {
  id: string;
  label: string;
  defaultValue: string;
  placeholder: string;
}) {
  return (
    <div>

      <label
        htmlFor={id}
        className="text-xs uppercase tracking-wider text-zinc-500"
      >
        {label}
      </label>

      <input
        id={id}
        name={id}
        type="text"
        defaultValue={
          defaultValue
        }
        placeholder={
          placeholder
        }
        className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-300 outline-none transition placeholder:text-zinc-600 focus:border-cyan-700"
      />

    </div>
  );
}


function HuntSelect({
  id,
  label,
  defaultValue,
  options,
}: {
  id: string;
  label: string;
  defaultValue: string;
  options: {
    value: string;
    label: string;
  }[];
}) {
  return (
    <div>

      <label
        htmlFor={id}
        className="text-xs uppercase tracking-wider text-zinc-500"
      >
        {label}
      </label>

      <select
        id={id}
        name={id}
        defaultValue={
          defaultValue
        }
        className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-300 outline-none transition focus:border-cyan-700"
      >

        <option value="">
          Any
        </option>

        {options.map(
          (option) => (
            <option
              key={
                option.value
              }
              value={
                option.value
              }
            >
              {option.label}
            </option>
          )
        )}

      </select>

    </div>
  );
}


function MetricCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">

      <p className="text-sm text-zinc-500">
        {label}
      </p>

      <p className="mt-3 text-3xl font-semibold">
        {value}
      </p>

    </div>
  );
}


function HuntResultRow({
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
        eventType={
          event.event_type
        }
      />

      <div className="min-w-0">

        <p className="truncate text-sm font-medium text-zinc-100">
          {getEventTitle(
            event
          )}
        </p>

        <p className="mt-1 truncate text-xs text-zinc-500">
          {getEventDescription(
            event
          )}
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
      "Process Creation"
    );
  }

  if (
    event.event_type.toLowerCase() ===
    "authentication"
  ) {
    return "Authentication Event";
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


function getParam(
  params: HuntSearchParams,
  key: string
): string {
  const value =
    params[key];

  if (
    Array.isArray(value)
  ) {
    return (
      value[0] ?? ""
    );
  }

  return value ?? "";
}


function getLimit(
  value: string
): number {
  const parsed =
    Number(value);

  if (
    [
      25,
      50,
      100,
      250,
      500,
    ].includes(parsed)
  ) {
    return parsed;
  }

  return 100;
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