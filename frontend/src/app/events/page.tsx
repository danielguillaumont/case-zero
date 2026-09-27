import Sidebar from "@/components/Sidebar";
import EventExplorerClient from "../../components/EventExplorerClient";

import {
  getSecurityEvents,
} from "@/lib/api";


export default async function EventsPage() {
  const events =
    await getSecurityEvents();

  const processEvents =
    events.filter(
      (event) =>
        event.event_type.toLowerCase()
        === "process_creation"
    );

  const authenticationEvents =
    events.filter(
      (event) =>
        event.event_type.toLowerCase()
        === "authentication"
    );

  const uniqueHosts =
    new Set(
      events
        .map(
          (event) =>
            event.hostname
        )
        .filter(
          (
            hostname
          ): hostname is string =>
            Boolean(
              hostname
            )
        )
    );

  const uniqueUsers =
    new Set(
      events
        .map(
          (event) =>
            event.username
        )
        .filter(
          (
            username
          ): username is string =>
            Boolean(
              username
            )
        )
    );

  const uniqueSources =
    new Set(
      events
        .map(
          (event) =>
            event.source
        )
        .filter(Boolean)
    );

  const latestEvent =
    getLatestEventTime(
      events.map(
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
                    Telemetry
                  </span>

                </div>

                <h2 className="text-[34px] font-semibold tracking-[-0.04em] text-[#f4f6f8]">
                  Security Event Explorer
                </h2>

                <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[#81909c]">
                  Search and inspect normalized
                  security telemetry collected
                  across endpoints, identities,
                  and network activity.
                </p>

              </div>

              <div className="flex items-center gap-3 pt-1">

                <div className="rounded-[10px] border border-[#63cfa4]/15 bg-[#63cfa4]/[0.045] px-4 py-3">

                  <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#668c7d]">
                    Pipeline
                  </p>

                  <div className="mt-1 flex items-center gap-2">

                    <span className="h-2 w-2 rounded-full bg-[#63cfa4]" />

                    <p className="text-[11px] font-medium text-[#84d8b7]">
                      Live telemetry
                    </p>

                  </div>

                </div>

              </div>

            </header>

            {/* Metrics */}
            <section>

              <div className="mb-3 flex items-end justify-between">

                <div>

                  <h3 className="text-[14px] font-medium text-[#dce3e8]">
                    Telemetry overview
                  </h3>

                  <p className="mt-1 text-[11px] text-[#657481]">
                    Current normalized event dataset
                  </p>

                </div>

                <p className="text-[10px] text-[#5e6d79]">
                  {
                    latestEvent
                      ? `Latest event ${formatCompactTime(
                          latestEvent
                        )}`
                      : "No telemetry recorded"
                  }
                </p>

              </div>

              <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">

                <MetricCard
                  label="Total events"
                  value={
                    events.length
                  }
                  context={
                    `${uniqueSources.size} telemetry source${
                      uniqueSources.size === 1
                        ? ""
                        : "s"
                    }`
                  }
                  accent="#69c5d7"
                />

                <MetricCard
                  label="Process activity"
                  value={
                    processEvents.length
                  }
                  context="Process creation telemetry"
                  accent="#c9a965"
                />

                <MetricCard
                  label="Authentication"
                  value={
                    authenticationEvents.length
                  }
                  context="Identity activity recorded"
                  accent="#7ca3d8"
                />

                <MetricCard
                  label="Entities observed"
                  value={
                    uniqueHosts.size
                    + uniqueUsers.size
                  }
                  context={
                    `${uniqueHosts.size} hosts · ${uniqueUsers.size} users`
                  }
                  accent="#63cfa4"
                />

              </div>

            </section>

            {/* Explorer */}
            <section className="mt-5">

              <EventExplorerClient
                events={
                  events
                }
              />

            </section>

          </div>

        </main>

      </div>

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