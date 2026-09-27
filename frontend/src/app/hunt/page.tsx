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


type ActiveFilter = {
  label: string;
  value: string;
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
            value
          ): value is string =>
            Boolean(value)
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
            value
          ): value is string =>
            Boolean(value)
        )
    );

  const uniqueSources =
    new Set(
      results
        .map(
          (event) =>
            event.source
        )
        .filter(Boolean)
    );

  const uniqueEventTypes =
    new Set(
      results.map(
        (event) =>
          event.event_type
      )
    );

  const activeFilters =
    buildActiveFilters({
      contains,
      eventType,
      source,
      hostname,
      username,
      sourceIp,
      processName,
      startTime,
      endTime,
    });

  const latestResultTime =
    getLatestEventTime(
      results.map(
        (event) =>
          event.event_time
      )
    );

  return (
    <div className="min-h-screen text-[#f1f4f7]">
      <div className="flex min-h-screen">
        <Sidebar />

        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-[1700px] px-8 py-8 xl:px-10 xl:py-10">

            {/* Header */}
            <header className="cz-dashboard-header mb-7 flex items-start justify-between gap-8">
              <div>
                <div className="mb-3 flex items-center gap-3">
                  <span className="text-[12px] font-semibold text-[#c9a965]">
                    Security Operations
                  </span>

                  <span className="h-px w-8 bg-[#c9a965]/40" />

                  <span className="text-[11px] text-[#667583]">
                    Threat Hunting
                  </span>
                </div>

                <h1 className="text-[34px] font-semibold tracking-[-0.04em] text-[#f4f6f8]">
                  Threat Hunting
                </h1>

                <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[#81909c]">
                  Search normalized telemetry across endpoints,
                  identities, processes, and network activity to
                  uncover suspicious behaviour and investigation leads.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <div className="rounded-[10px] border border-[#69c5d7]/15 bg-[#69c5d7]/[0.045] px-4 py-3">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#628692]">
                    Engine
                  </p>

                  <div className="mt-1 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#69c5d7]" />

                    <p className="text-[11px] font-medium text-[#8bd3df]">
                      Telemetry search
                    </p>
                  </div>
                </div>

                <div className="rounded-[10px] border border-white/[0.075] bg-[#0d141c]/70 px-4 py-3">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#5d6c78]">
                    Query
                  </p>

                  <p className="mt-1 text-[11px] font-medium text-[#cad2d9]">
                    {hasRun
                      ? `${results.length} returned`
                      : "Ready"}
                  </p>
                </div>
              </div>
            </header>

            {/* Query workspace */}
            <section className="overflow-hidden rounded-[14px] border border-white/[0.075] bg-[#0c141d]/95 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
              <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-5">
                <div className="flex items-start gap-3">
                  <span className="mt-[7px] h-2 w-2 rounded-full bg-[#d8b65e]" />

                  <div>
                    <h2 className="text-[15px] font-semibold text-[#eef2f5]">
                      Query builder
                    </h2>

                    <p className="mt-1 text-[11px] text-[#687783]">
                      Combine free-text search with structured telemetry filters.
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-[11px] font-medium text-[#cbd3da]">
                    {activeFilters.length === 0
                      ? "No filters applied"
                      : `${activeFilters.length} active ${
                          activeFilters.length === 1
                            ? "filter"
                            : "filters"
                        }`}
                  </p>

                  <p className="mt-1 text-[9px] uppercase tracking-[0.12em] text-[#4f5f6c]">
                    Maximum {limit} results
                  </p>
                </div>
              </div>

              <form
                method="GET"
                className="px-6 py-6"
              >
                <input
                  type="hidden"
                  name="run"
                  value="1"
                />

                {/* Search */}
                <div>
                  <label
                    htmlFor="contains"
                    className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#72818d]"
                  >
                    Search telemetry
                  </label>

                  <div className="relative mt-2">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center text-[#596875]">
                      <SearchIcon />
                    </div>

                    <input
                      id="contains"
                      name="contains"
                      type="text"
                      defaultValue={contains}
                      placeholder="Search process, command line, IP, hostname, user, or event metadata..."
                      className="h-12 w-full rounded-[10px] border border-white/[0.09] bg-[#071018] pl-11 pr-4 text-[13px] text-[#dce4ea] outline-none transition placeholder:text-[#4f5e6b] hover:border-white/[0.13] focus:border-[#69c5d7]/45 focus:bg-[#08121b]"
                    />
                  </div>

                  <p className="mt-2 text-[10px] leading-5 text-[#53636f]">
                    Free-text search inspects event metadata, process data,
                    command lines, identities, hostnames, network addresses,
                    and raw telemetry fields.
                  </p>
                </div>

                {/* Structured filters */}
                <div className="mt-7">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h3 className="text-[12px] font-medium text-[#cbd4db]">
                        Structured filters
                      </h3>

                      <p className="mt-1 text-[10px] text-[#586875]">
                        Narrow the hunt to specific telemetry dimensions.
                      </p>
                    </div>

                    <span className="rounded-md border border-white/[0.07] bg-[#081018] px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.08em] text-[#657582]">
                      Optional
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <HuntSelect
                      id="event_type"
                      label="Event type"
                      defaultValue={eventType}
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
                      label="Telemetry source"
                      defaultValue={source}
                      placeholder="endpoint"
                    />

                    <HuntInput
                      id="hostname"
                      label="Hostname"
                      defaultValue={hostname}
                      placeholder="WS-DOWNLOAD-TEST"
                    />

                    <HuntInput
                      id="username"
                      label="Username"
                      defaultValue={username}
                      placeholder="daniel"
                    />

                    <HuntInput
                      id="source_ip"
                      label="Source IP"
                      defaultValue={sourceIp}
                      placeholder="203.0.113.50"
                    />

                    <HuntInput
                      id="process_name"
                      label="Process name"
                      defaultValue={processName}
                      placeholder="powershell.exe"
                    />
                  </div>
                </div>

                {/* Time controls */}
                <div className="mt-7 border-t border-white/[0.06] pt-6">
                  <div className="mb-3">
                    <h3 className="text-[12px] font-medium text-[#cbd4db]">
                      Search window
                    </h3>

                    <p className="mt-1 text-[10px] text-[#586875]">
                      Optionally constrain the search to a specific telemetry window.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <HuntInput
                      id="start_time"
                      label="Start time"
                      defaultValue={startTime}
                      placeholder="2026-08-16T14:00:00Z"
                      mono
                    />

                    <HuntInput
                      id="end_time"
                      label="End time"
                      defaultValue={endTime}
                      placeholder="2026-08-16T16:00:00Z"
                      mono
                    />

                    <div>
                      <label
                        htmlFor="limit"
                        className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[#6e7e8a]"
                      >
                        Result limit
                      </label>

                      <select
                        id="limit"
                        name="limit"
                        defaultValue={String(limit)}
                        className="mt-2 h-11 w-full rounded-[9px] border border-white/[0.09] bg-[#071018] px-3.5 text-[12px] text-[#bdc7cf] outline-none transition hover:border-white/[0.13] focus:border-[#69c5d7]/45"
                      >
                        <option value="25">
                          25 results
                        </option>

                        <option value="50">
                          50 results
                        </option>

                        <option value="100">
                          100 results
                        </option>

                        <option value="250">
                          250 results
                        </option>

                        <option value="500">
                          500 results
                        </option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Active filters */}
                {activeFilters.length > 0 && (
                  <div className="mt-6 rounded-[10px] border border-white/[0.06] bg-[#081018]/80 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[#687986]">
                        Active query
                      </p>

                      <p className="text-[9px] text-[#53636f]">
                        {activeFilters.length} constraints
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {activeFilters.map(
                        (filter) => (
                          <div
                            key={`${filter.label}-${filter.value}`}
                            className="flex items-center gap-2 rounded-md border border-[#c9a965]/15 bg-[#c9a965]/[0.045] px-3 py-1.5"
                          >
                            <span className="text-[9px] uppercase tracking-[0.08em] text-[#806f49]">
                              {filter.label}
                            </span>

                            <span className="max-w-[280px] truncate font-mono text-[10px] text-[#d7c38e]">
                              {filter.value}
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="mt-7 flex items-center justify-between border-t border-white/[0.06] pt-5">
                  <p className="max-w-xl text-[10px] leading-5 text-[#52616d]">
                    Hunt queries search normalized CASE//ZERO telemetry and
                    return matching records for investigation.
                  </p>

                  <div className="flex items-center gap-3">
                    <Link
                      href="/hunt"
                      className="flex h-10 items-center justify-center rounded-[8px] border border-white/[0.09] bg-[#0a121a] px-5 text-[11px] font-medium text-[#9ba7b1] transition hover:border-white/[0.15] hover:bg-[#0d1720] hover:text-[#d8dfe4]"
                    >
                      Clear query
                    </Link>

                    <button
                      type="submit"
                      className="flex h-10 items-center justify-center gap-2 rounded-[8px] border border-[#c9a965]/30 bg-[#c9a965]/[0.08] px-5 text-[11px] font-semibold text-[#ddc27b] transition hover:border-[#c9a965]/45 hover:bg-[#c9a965]/[0.12]"
                    >
                      <SearchIcon />

                      Run hunt
                    </button>
                  </div>
                </div>
              </form>
            </section>

            {/* Result metrics */}
            {hasRun && (
              <section className="mt-6">
                <div className="mb-3 flex items-end justify-between">
                  <div>
                    <h2 className="text-[14px] font-medium text-[#dce3e8]">
                      Hunt summary
                    </h2>

                    <p className="mt-1 text-[11px] text-[#657481]">
                      Distribution of telemetry returned by the current query
                    </p>
                  </div>

                  <p className="text-[10px] text-[#5e6d79]">
                    {latestResultTime
                      ? `Latest match ${formatCompactTime(
                          latestResultTime
                        )}`
                      : "No matching telemetry"}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                  <MetricCard
                    label="Results"
                    value={results.length}
                    context={
                      results.length === 1
                        ? "Matching telemetry record"
                        : "Matching telemetry records"
                    }
                    accent="#c9a965"
                  />

                  <MetricCard
                    label="Event types"
                    value={uniqueEventTypes.size}
                    context="Telemetry categories represented"
                    accent="#69c5d7"
                  />

                  <MetricCard
                    label="Hosts"
                    value={uniqueHosts.size}
                    context="Unique endpoints observed"
                    accent="#7ca3d8"
                  />

                  <MetricCard
                    label="Users"
                    value={uniqueUsers.size}
                    context={`${uniqueSources.size} telemetry source${
                      uniqueSources.size === 1
                        ? ""
                        : "s"
                    }`}
                    accent="#63cfa4"
                  />
                </div>
              </section>
            )}

            {/* Results */}
            <section className="mt-6 overflow-hidden rounded-[14px] border border-white/[0.075] bg-[#0c141d]/95 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
              <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-5">
                <div className="flex items-start gap-3">
                  <span className="mt-[7px] h-2 w-2 rounded-full bg-[#69c5d7]" />

                  <div>
                    <h2 className="text-[15px] font-semibold text-[#edf2f5]">
                      Hunt results
                    </h2>

                    <p className="mt-1 text-[11px] text-[#687783]">
                      Matching normalized telemetry returned by the hunt engine
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-[11px] font-semibold text-[#dbe2e7]">
                    {hasRun
                      ? `${results.length} ${
                          results.length === 1
                            ? "result"
                            : "results"
                        }`
                      : "Awaiting query"}
                  </p>

                  <p className="mt-1 text-[8px] font-medium uppercase tracking-[0.13em] text-[#52616e]">
                    CASE//ZERO telemetry
                  </p>
                </div>
              </div>

              {!hasRun ? (
                <div className="flex min-h-[290px] items-center justify-center px-8 py-14">
                  <div className="max-w-md text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[12px] border border-[#69c5d7]/15 bg-[#69c5d7]/[0.045] text-[#7fcbd7]">
                      <HuntIcon />
                    </div>

                    <h3 className="mt-5 text-[15px] font-semibold text-[#dce3e8]">
                      Hunt workspace ready
                    </h3>

                    <p className="mt-2 text-[11px] leading-5 text-[#657481]">
                      Build a query above and run the hunt to inspect matching
                      endpoint, identity, process, and network telemetry.
                    </p>

                    <div className="mt-5 flex items-center justify-center gap-3">
                      <ExampleChip text="powershell.exe" />
                      <ExampleChip text="203.0.113.50" />
                      <ExampleChip text="authentication" />
                    </div>
                  </div>
                </div>
              ) : results.length === 0 ? (
                <div className="flex min-h-[290px] items-center justify-center px-8 py-14">
                  <div className="max-w-md text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[12px] border border-white/[0.08] bg-[#091119] text-[#667582]">
                      <SearchIcon />
                    </div>

                    <h3 className="mt-5 text-[15px] font-semibold text-[#dce3e8]">
                      No telemetry matched
                    </h3>

                    <p className="mt-2 text-[11px] leading-5 text-[#657481]">
                      The query completed successfully but returned no matching
                      events. Broaden the time range or remove one or more filters.
                    </p>

                    <Link
                      href="/hunt"
                      className="mt-5 inline-flex h-9 items-center justify-center rounded-[8px] border border-white/[0.09] bg-[#091119] px-4 text-[10px] font-medium text-[#aab5be] transition hover:border-white/[0.15] hover:text-white"
                    >
                      Reset query
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="min-w-[1120px]">
                    <div className="grid grid-cols-[120px_170px_minmax(300px,1fr)_140px_220px_150px] gap-4 border-b border-white/[0.07] bg-[#071018]/75 px-6 py-3">
                      <span className="cz-table-head">
                        Time
                      </span>

                      <span className="cz-table-head">
                        Event type
                      </span>

                      <span className="cz-table-head">
                        Activity
                      </span>

                      <span className="cz-table-head">
                        Source
                      </span>

                      <span className="cz-table-head">
                        Identity / host
                      </span>

                      <span className="cz-table-head">
                        Network
                      </span>
                    </div>

                    <div className="divide-y divide-white/[0.055]">
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
                </div>
              )}
            </section>

          </div>
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
  mono = false,
}: {
  id: string;
  label: string;
  defaultValue: string;
  placeholder: string;
  mono?: boolean;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[#6e7e8a]"
      >
        {label}
      </label>

      <input
        id={id}
        name={id}
        type="text"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className={`mt-2 h-11 w-full rounded-[9px] border border-white/[0.09] bg-[#071018] px-3.5 text-[12px] text-[#bdc7cf] outline-none transition placeholder:text-[#475663] hover:border-white/[0.13] focus:border-[#69c5d7]/45 ${
          mono
            ? "font-mono"
            : ""
        }`}
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
        className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[#6e7e8a]"
      >
        {label}
      </label>

      <select
        id={id}
        name={id}
        defaultValue={defaultValue}
        className="mt-2 h-11 w-full rounded-[9px] border border-white/[0.09] bg-[#071018] px-3.5 text-[12px] text-[#bdc7cf] outline-none transition hover:border-white/[0.13] focus:border-[#69c5d7]/45"
      >
        <option value="">
          Any event type
        </option>

        {options.map(
          (option) => (
            <option
              key={option.value}
              value={option.value}
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
  context,
  accent,
}: {
  label: string;
  value: number;
  context: string;
  accent: string;
}) {
  return (
    <div className="cz-metric p-5">
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background:
            `linear-gradient(90deg, ${accent}, transparent 70%)`,
        }}
      />

      <div className="relative z-10">
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
                0.7,
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
      className="group grid grid-cols-[120px_170px_minmax(300px,1fr)_140px_220px_150px] items-center gap-4 px-6 py-4 transition hover:bg-[#111d27]/70"
    >
      <div>
        <p className="font-mono text-[10px] font-medium text-[#a8b4bd]">
          {formatEventTimeOnly(
            event.event_time
          )}
        </p>

        <p className="mt-1 text-[8px] text-[#50606d]">
          {formatEventDate(
            event.event_time
          )}
        </p>
      </div>

      <EventTypeBadge
        eventType={
          event.event_type
        }
      />

      <div className="min-w-0">
        <p className="truncate text-[12px] font-semibold text-[#dce3e8] transition group-hover:text-white">
          {getEventTitle(
            event
          )}
        </p>

        <p className="mt-1 truncate font-mono text-[9px] text-[#596976]">
          {getEventDescription(
            event
          )}
        </p>
      </div>

      <div>
        <p className="truncate text-[11px] text-[#a7b3bd]">
          {formatLabel(
            event.source
          )}
        </p>

        <p className="mt-1 text-[8px] uppercase tracking-[0.08em] text-[#455562]">
          Telemetry
        </p>
      </div>

      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium text-[#c3ccd3]">
          {event.hostname ??
            "Unknown host"}
        </p>

        <p className="mt-1 truncate text-[9px] text-[#586875]">
          {event.username ??
            "Unknown identity"}
        </p>
      </div>

      <p className="truncate font-mono text-[9px] text-[#7f8e99]">
        {getNetworkLabel(
          event
        )}
      </p>
    </Link>
  );
}


function EventTypeBadge({
  eventType,
}: {
  eventType: string;
}) {
  const normalized =
    eventType.toLowerCase();

  const styles:
    Record<
      string,
      string
    > = {
      process_creation:
        "border-[#c9a965]/25 bg-[#c9a965]/[0.07] text-[#d8bd74]",

      authentication:
        "border-[#7ca3d8]/20 bg-[#7ca3d8]/[0.065] text-[#91b5e4]",

      network_connection:
        "border-[#69c5d7]/20 bg-[#69c5d7]/[0.065] text-[#82cfdb]",

      file_creation:
        "border-[#c98458]/20 bg-[#c98458]/[0.065] text-[#df9c70]",
    };

  return (
    <span
      className={`inline-flex w-fit items-center gap-2 rounded-[6px] border px-2.5 py-1.5 text-[8px] font-semibold uppercase tracking-[0.06em] ${
        styles[
          normalized
        ] ??
        "border-white/[0.08] bg-white/[0.035] text-[#8997a2]"
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />

      {formatLabel(
        eventType
      )}
    </span>
  );
}


function ExampleChip({
  text,
}: {
  text: string;
}) {
  return (
    <span className="rounded-md border border-white/[0.06] bg-[#081018] px-2.5 py-1 font-mono text-[9px] text-[#5f6f7b]">
      {text}
    </span>
  );
}


function SearchIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="11"
        cy="11"
        r="6.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />

      <path
        d="M16 16L20 20"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}


function HuntIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="10.5"
        cy="10.5"
        r="5.5"
        stroke="currentColor"
        strokeWidth="1.4"
      />

      <path
        d="M15 15L20 20"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />

      <path
        d="M10.5 7.5V13.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.65"
      />

      <path
        d="M7.5 10.5H13.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.65"
      />
    </svg>
  );
}


function buildActiveFilters({
  contains,
  eventType,
  source,
  hostname,
  username,
  sourceIp,
  processName,
  startTime,
  endTime,
}: {
  contains: string;
  eventType: string;
  source: string;
  hostname: string;
  username: string;
  sourceIp: string;
  processName: string;
  startTime: string;
  endTime: string;
}): ActiveFilter[] {
  const filters:
    ActiveFilter[] = [];

  if (contains) {
    filters.push({
      label:
        "Search",
      value:
        contains,
    });
  }

  if (eventType) {
    filters.push({
      label:
        "Event",
      value:
        formatLabel(
          eventType
        ),
    });
  }

  if (source) {
    filters.push({
      label:
        "Source",
      value:
        source,
    });
  }

  if (hostname) {
    filters.push({
      label:
        "Host",
      value:
        hostname,
    });
  }

  if (username) {
    filters.push({
      label:
        "User",
      value:
        username,
    });
  }

  if (sourceIp) {
    filters.push({
      label:
        "Source IP",
      value:
        sourceIp,
    });
  }

  if (processName) {
    filters.push({
      label:
        "Process",
      value:
        processName,
    });
  }

  if (startTime) {
    filters.push({
      label:
        "From",
      value:
        startTime,
    });
  }

  if (endTime) {
    filters.push({
      label:
        "To",
      value:
        endTime,
    });
  }

  return filters;
}


function getEventTitle(
  event: SecurityEvent
) {
  const eventType =
    event.event_type.toLowerCase();

  if (
    eventType ===
    "process_creation"
  ) {
    return (
      event.process_name ??
      "Process creation"
    );
  }

  if (
    eventType ===
    "authentication"
  ) {
    return "Authentication activity";
  }

  if (
    eventType ===
    "network_connection"
  ) {
    return "Network connection";
  }

  if (
    eventType ===
    "file_creation"
  ) {
    return "File creation";
  }

  return formatLabel(
    event.event_type
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


function getNetworkLabel(
  event: SecurityEvent
) {
  if (
    event.source_ip &&
    event.destination_ip
  ) {
    return `${event.source_ip} → ${event.destination_ip}`;
  }

  if (event.source_ip) {
    return event.source_ip;
  }

  if (event.destination_ip) {
    return event.destination_ip;
  }

  return "—";
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


function getLatestEventTime(
  timestamps: string[]
) {
  if (
    timestamps.length === 0
  ) {
    return null;
  }

  const validDates =
    timestamps
      .map(
        (timestamp) =>
          new Date(
            timestamp
          )
      )
      .filter(
        (date) =>
          !Number.isNaN(
            date.getTime()
          )
      );

  if (
    validDates.length === 0
  ) {
    return null;
  }

  return new Date(
    Math.max(
      ...validDates.map(
        (date) =>
          date.getTime()
      )
    )
  ).toISOString();
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


function formatCompactTime(
  timestamp: string
) {
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
    new Date(
      timestamp
    )
  );
}


function formatEventTimeOnly(
  timestamp: string
) {
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
    new Date(
      timestamp
    )
  );
}


function formatEventDate(
  timestamp: string
) {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      month:
        "short",
      day:
        "numeric",
    }
  ).format(
    new Date(
      timestamp
    )
  );
}