import Link from "next/link";

import Sidebar from "@/components/Sidebar";

import {
  getAlerts,
  getApiHealth,
  getCases,
  getDetectionRules,
  getSecurityEvents,
  getThreatIndicators,
} from "@/lib/api";

import type {
  Alert,
  Case,
} from "@/lib/api";


type TelemetryEvent = {
  event_time: string;
};


type ActivityPoint = {
  label: string;
  value: number;
};


export default async function Home() {
  const [
    apiHealth,
    alerts,
    events,
    cases,
    rules,
    threatIndicators,
  ] = await Promise.all([
    getApiHealth(),
    getAlerts(),
    getSecurityEvents(),
    getCases(),
    getDetectionRules(),
    getThreatIndicators(),
  ]);

  const apiOnline =
    apiHealth?.status === "online";

  const databaseOnline =
    apiHealth?.database === "online";

  const openAlerts =
    alerts.filter(
      (alert) =>
        [
          "new",
          "assigned",
          "investigating",
        ].includes(
          alert.status.toLowerCase()
        )
    );

  const criticalAlerts =
    openAlerts.filter(
      (alert) =>
        alert.severity.toLowerCase()
        === "critical"
    );

  const highAlerts =
    openAlerts.filter(
      (alert) =>
        alert.severity.toLowerCase()
        === "high"
    );

  const mediumAlerts =
    openAlerts.filter(
      (alert) =>
        alert.severity.toLowerCase()
        === "medium"
    );

  const lowAlerts =
    openAlerts.filter(
      (alert) =>
        alert.severity.toLowerCase()
        === "low"
    );

  const newAlerts =
    openAlerts.filter(
      (alert) =>
        alert.status.toLowerCase()
        === "new"
    );

  const investigatingAlerts =
    openAlerts.filter(
      (alert) =>
        alert.status.toLowerCase()
        === "investigating"
    );

  const activeCases =
    cases.filter(
      (investigationCase) =>
        ![
          "resolved",
          "closed",
        ].includes(
          investigationCase.status.toLowerCase()
        )
    );

  const investigatingCases =
    activeCases.filter(
      (investigationCase) =>
        investigationCase.status.toLowerCase()
        === "investigating"
    );

  const openCases =
    activeCases.filter(
      (investigationCase) =>
        investigationCase.status.toLowerCase()
        !== "investigating"
    );

  const resolvedCases =
    cases.filter(
      (investigationCase) =>
        [
          "resolved",
          "closed",
        ].includes(
          investigationCase.status.toLowerCase()
        )
    );

  const eventsToday =
    events.filter(
      (event) =>
        isToday(
          event.event_time
        )
    );

  const enabledRules =
    rules.filter(
      (rule) =>
        rule.enabled
    );

  const environmentLabel =
    process.env.NODE_ENV === "production"
      ? "Production"
      : "Local Development";

  const recentAlerts =
    alerts.slice(0, 5);

  const queueCases =
    activeCases.slice(0, 4);

  const activitySeries =
    buildTelemetrySeries(
      events
    );

  const latestEvent =
    getLatestEventTime(
      events
    );

  const uniqueEventTypes =
    new Set(
      events.map(
        (event) =>
          event.event_type
            .toLowerCase()
      )
    ).size;

  const severityGradient =
    buildSeverityGradient({
      critical:
        criticalAlerts.length,
      high:
        highAlerts.length,
      medium:
        mediumAlerts.length,
      low:
        lowAlerts.length,
    });

  const platformHealthy =
    apiOnline
    && databaseOnline;

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
                    Unified workspace
                  </span>

                </div>

                <h2 className="text-[34px] font-semibold tracking-[-0.04em] text-[#f4f6f8]">
                  Operational Overview
                </h2>

                <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[#81909c]">
                  Monitor detections,
                  investigations,
                  telemetry, and service
                  health from a single
                  analyst workspace.
                </p>

              </div>

              <div className="flex items-center gap-3 pt-1">

                <div className="rounded-[10px] border border-white/[0.075] bg-[#0c1620]/85 px-4 py-3">

                  <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#61707d]">
                    Environment
                  </p>

                  <p className="mt-1 text-[11px] font-medium text-[#bdc7cf]">
                    {environmentLabel}
                  </p>

                </div>

                <div className="rounded-[10px] border border-[#63cfa4]/15 bg-[#63cfa4]/[0.045] px-4 py-3">

                  <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#668c7d]">
                    Platform
                  </p>

                  <div className="mt-1 flex items-center gap-2">

                    <span
                      className={`h-2 w-2 rounded-full ${
                        platformHealthy
                          ? "bg-[#63cfa4]"
                          : "bg-[#e56e73]"
                      }`}
                    />

                    <p
                      className={`text-[11px] font-medium ${
                        platformHealthy
                          ? "text-[#84d8b7]"
                          : "text-[#ec8b8f]"
                      }`}
                    >
                      {
                        platformHealthy
                          ? "Operational"
                          : "Degraded"
                      }
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
                    Security posture
                  </h3>

                  <p className="mt-1 text-[11px] text-[#657481]">
                    Current analyst workload
                    and detection state
                  </p>

                </div>

                <p className="text-[10px] text-[#5e6d79]">
                  Live operational snapshot
                </p>

              </div>

              <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">

                <MetricCard
                  label="Open alerts"
                  value={
                    openAlerts.length
                  }
                  context={
                    `${newAlerts.length} new · ${investigatingAlerts.length} investigating`
                  }
                  accent="#c9a965"
                />

                <MetricCard
                  label="Active cases"
                  value={
                    activeCases.length
                  }
                  context={
                    `${investigatingCases.length} investigating · ${openCases.length} open`
                  }
                  accent="#69c5d7"
                />

                <MetricCard
                  label="Critical alerts"
                  value={
                    criticalAlerts.length
                  }
                  context={
                    criticalAlerts.length > 0
                      ? "Immediate analyst review required"
                      : "No critical alerts detected"
                  }
                  accent={
                    criticalAlerts.length > 0
                      ? "#e56e73"
                      : "#70808d"
                  }
                />

                <MetricCard
                  label="Events today"
                  value={
                    eventsToday.length
                  }
                  context={
                    `${events.length} events retained in telemetry`
                  }
                  accent="#7a8995"
                />

              </div>

            </section>

            {/* Analytics */}
            <div className="mt-5 grid gap-5 xl:grid-cols-[1.7fr_0.8fr]">

              {/* Telemetry */}
              <section className="cz-panel min-h-[375px]">

                <div className="flex items-start justify-between px-6 pb-2 pt-6">

                  <div>

                    <div className="flex items-center gap-2.5">

                      <span className="h-2 w-2 rounded-full bg-[#69c5d7]" />

                      <h3 className="text-[16px] font-medium text-[#e7ecf0]">
                        Telemetry activity
                      </h3>

                    </div>

                    <p className="mt-1.5 pl-[18px] text-[11px] text-[#6b7a87]">
                      Event volume across
                      the latest recorded
                      24-hour window
                    </p>

                  </div>

                  <div className="flex gap-6">

                    <MiniStat
                      label="Events"
                      value={
                        String(
                          events.length
                        )
                      }
                    />

                    <MiniStat
                      label="Event types"
                      value={
                        String(
                          uniqueEventTypes
                        )
                      }
                    />

                    <MiniStat
                      label="Latest"
                      value={
                        latestEvent
                          ? formatCompactTime(
                              latestEvent
                            )
                          : "No data"
                      }
                    />

                  </div>

                </div>

                <TelemetryChart
                  series={
                    activitySeries
                  }
                />

              </section>

              {/* Severity */}
              <section className="cz-panel min-h-[375px] p-6">

                <div className="flex items-start justify-between">

                  <div>

                    <h3 className="text-[16px] font-medium text-[#e7ecf0]">
                      Alert severity
                    </h3>

                    <p className="mt-1.5 text-[11px] text-[#6b7a87]">
                      Open alerts by severity
                    </p>

                  </div>

                  <Link
                    href="/alerts"
                    className="text-[11px] font-medium text-[#95a2ad] transition hover:text-[#dcc17e]"
                  >
                    View alerts
                  </Link>

                </div>

                <div className="mt-7 flex items-center justify-center">

                  <div
                    className="relative flex h-[170px] w-[170px] items-center justify-center rounded-full"
                    style={{
                      backgroundImage:
                        severityGradient,
                    }}
                  >

                    <div className="flex h-[124px] w-[124px] flex-col items-center justify-center rounded-full border border-white/[0.055] bg-[#0c1620] shadow-[inset_0_0_30px_rgba(0,0,0,0.18)]">

                      <p className="text-[38px] font-semibold leading-none tracking-[-0.05em] text-[#f1f4f6]">
                        {
                          openAlerts.length
                        }
                      </p>

                      <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.08em] text-[#6f7d89]">
                        Open alerts
                      </p>

                    </div>

                  </div>

                </div>

                <div className="mt-7 grid grid-cols-2 gap-x-6 gap-y-3">

                  <SeverityLegend
                    label="Critical"
                    value={
                      criticalAlerts.length
                    }
                    color="#e56e73"
                  />

                  <SeverityLegend
                    label="High"
                    value={
                      highAlerts.length
                    }
                    color="#d98c55"
                  />

                  <SeverityLegend
                    label="Medium"
                    value={
                      mediumAlerts.length
                    }
                    color="#d8aa55"
                  />

                  <SeverityLegend
                    label="Low"
                    value={
                      lowAlerts.length
                    }
                    color="#69c5d7"
                  />

                </div>

              </section>

            </div>

            {/* Operational work */}
            <div className="mt-5 grid gap-5 xl:grid-cols-[1.55fr_0.85fr]">

              {/* Recent alerts */}
              <section className="cz-panel overflow-hidden">

                <div className="flex items-center justify-between border-b border-white/[0.055] px-6 py-5">

                  <div>

                    <h3 className="text-[16px] font-medium text-[#e7ecf0]">
                      Recent alerts
                    </h3>

                    <p className="mt-1 text-[11px] text-[#6b7a87]">
                      Latest detections
                      awaiting analyst review
                    </p>

                  </div>

                  <Link
                    href="/alerts"
                    className="text-[11px] font-medium text-[#95a2ad] transition hover:text-[#dcc17e]"
                  >
                    View all alerts
                  </Link>

                </div>

                {recentAlerts.length === 0 ? (
                  <div className="flex min-h-[280px] items-center justify-center">

                    <div className="text-center">

                      <p className="text-[13px] font-medium text-[#a5b0b9]">
                        No alerts found
                      </p>

                      <p className="mt-1 text-[11px] text-[#657481]">
                        New detections will
                        appear here.
                      </p>

                    </div>

                  </div>
                ) : (
                  <div>

                    <div className="grid grid-cols-[100px_1fr_140px_150px] gap-4 border-b border-white/[0.045] bg-[#09121b]/70 px-6 py-3.5">

                      <span className="cz-table-head">
                        Severity
                      </span>

                      <span className="cz-table-head">
                        Alert
                      </span>

                      <span className="cz-table-head">
                        Status
                      </span>

                      <span className="cz-table-head">
                        Created
                      </span>

                    </div>

                    <div className="divide-y divide-white/[0.05]">

                      {recentAlerts.map(
                        (alert) => (
                          <AlertRow
                            key={
                              alert.id
                            }
                            alert={
                              alert
                            }
                          />
                        )
                      )}

                    </div>

                  </div>
                )}

              </section>

              {/* Case Queue */}
              <section className="cz-panel overflow-hidden">

                <div className="flex items-center justify-between border-b border-white/[0.055] px-5 py-5">

                  <div>

                    <h3 className="text-[16px] font-medium text-[#e7ecf0]">
                      Investigation queue
                    </h3>

                    <p className="mt-1 text-[11px] text-[#6b7a87]">
                      Active analyst workload
                    </p>

                  </div>

                  <div className="rounded-full border border-[#c9a965]/15 bg-[#c9a965]/[0.055] px-3 py-1.5">

                    <span className="text-[10px] font-medium text-[#d2b56f]">
                      {
                        activeCases.length
                      } active
                    </span>

                  </div>

                </div>

                <div>

                  {queueCases.length === 0 ? (
                    <div className="flex min-h-[270px] items-center justify-center">

                      <p className="text-[12px] text-[#687784]">
                        No active investigations.
                      </p>

                    </div>
                  ) : (
                    <div className="divide-y divide-white/[0.05]">

                      {queueCases.map(
                        (
                          investigationCase
                        ) => (
                          <CaseQueueRow
                            key={
                              investigationCase.id
                            }
                            investigationCase={
                              investigationCase
                            }
                          />
                        )
                      )}

                    </div>
                  )}

                </div>

                <div className="border-t border-white/[0.05] bg-[#09121b]/60 p-4">

                  <div className="grid grid-cols-3 divide-x divide-white/[0.055]">

                    <QueueMetric
                      label="Investigating"
                      value={
                        investigatingCases.length
                      }
                    />

                    <QueueMetric
                      label="Open"
                      value={
                        openCases.length
                      }
                    />

                    <QueueMetric
                      label="Resolved"
                      value={
                        resolvedCases.length
                      }
                    />

                  </div>

                  <Link
                    href="/cases"
                    className="mt-4 flex w-full items-center justify-between rounded-[9px] border border-white/[0.075] bg-white/[0.025] px-4 py-3 text-[11px] font-medium text-[#abb6bf] transition hover:border-[#c9a965]/25 hover:bg-[#c9a965]/[0.035] hover:text-[#ddc17f]"
                  >
                    Open investigation workspace

                    <span>
                      →
                    </span>
                  </Link>

                </div>

              </section>

            </div>

            {/* Platform health */}
            <section className="cz-panel mt-5">

              <div className="flex items-center justify-between border-b border-white/[0.055] px-6 py-4">

                <div className="flex items-center gap-3">

                  <div
                    className={`h-2 w-2 rounded-full ${
                      platformHealthy
                        ? "bg-[#63cfa4]"
                        : "bg-[#e56e73]"
                    }`}
                  />

                  <div>

                    <h3 className="text-[13px] font-medium text-[#dce3e8]">
                      Platform health
                    </h3>

                  </div>

                </div>

                <div className="flex items-center gap-4">

                  <span className="text-[10px] text-[#62717e]">
                    Service availability
                  </span>

                  {apiHealth?.version && (
                    <span className="cz-mono text-[10px] text-[#778591]">
                      API {
                        apiHealth.version
                      }
                    </span>
                  )}

                </div>

              </div>

              <div className="grid grid-cols-2 divide-x divide-y divide-white/[0.05] md:grid-cols-3 xl:grid-cols-5 xl:divide-y-0">

                <HealthCell
                  name="CASE//ZERO API"
                  detail="Application service"
                  healthy={
                    apiOnline
                  }
                  status={
                    apiOnline
                      ? "Online"
                      : "Offline"
                  }
                />

                <HealthCell
                  name="PostgreSQL"
                  detail="Neon database"
                  healthy={
                    databaseOnline
                  }
                  status={
                    databaseOnline
                      ? "Online"
                      : "Offline"
                  }
                />

                <HealthCell
                  name="Detection engine"
                  detail="Detection rules"
                  healthy={
                    enabledRules.length > 0
                  }
                  status={
                    `${enabledRules.length} active`
                  }
                />

                <HealthCell
                  name="Threat intelligence"
                  detail="Indicator registry"
                  healthy={
                    apiOnline
                  }
                  status={
                    `${threatIndicators.length} IOC${
                      threatIndicators.length === 1
                        ? ""
                        : "s"
                    }`
                  }
                />

                <HealthCell
                  name="Event pipeline"
                  detail="Telemetry ingestion"
                  healthy={
                    apiOnline
                  }
                  status={
                    apiOnline
                      ? "Active"
                      : "Offline"
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


function MiniStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="text-right">

      <p className="text-[9px] font-semibold uppercase tracking-[0.06em] text-[#596875]">
        {label}
      </p>

      <p className="mt-1 text-[11px] font-medium text-[#b5c0c8]">
        {value}
      </p>

    </div>
  );
}


function TelemetryChart({
  series,
}: {
  series: ActivityPoint[];
}) {
  const width =
    760;

  const height =
    230;

  const paddingX =
    24;

  const paddingTop =
    26;

  const paddingBottom =
    42;

  const maxValue =
    Math.max(
      ...series.map(
        (point) =>
          point.value
      ),
      1
    );

  const availableWidth =
    width
    - paddingX * 2;

  const availableHeight =
    height
    - paddingTop
    - paddingBottom;

  const step =
    series.length > 1
      ? availableWidth
        / (
          series.length
          - 1
        )
      : availableWidth;

  const points =
    series.map(
      (
        point,
        index
      ) => ({
        x:
          paddingX
          + index * step,

        y:
          paddingTop
          + (
            1
            - point.value
              / maxValue
          )
          * availableHeight,

        value:
          point.value,

        label:
          point.label,
      })
    );

  const linePath =
    createSmoothPath(
      points
    );

  const baseline =
    height
    - paddingBottom;

  const areaPath =
    points.length > 0
      ? `${linePath} L ${
          points[
            points.length - 1
          ].x
        } ${baseline} L ${
          points[0].x
        } ${baseline} Z`
      : "";

  return (
    <div className="px-4 pb-4 pt-3">

      <svg
        viewBox={
          `0 0 ${width} ${height}`
        }
        className="h-[245px] w-full"
        role="img"
        aria-label="Telemetry event activity"
      >

        <defs>

          <linearGradient
            id="telemetryArea"
            x1="0"
            x2="0"
            y1="0"
            y2="1"
          >

            <stop
              offset="0%"
              stopColor="#69c5d7"
              stopOpacity="0.22"
            />

            <stop
              offset="80%"
              stopColor="#69c5d7"
              stopOpacity="0.025"
            />

            <stop
              offset="100%"
              stopColor="#69c5d7"
              stopOpacity="0"
            />

          </linearGradient>

          <linearGradient
            id="telemetryLine"
            x1="0"
            x2="1"
            y1="0"
            y2="0"
          >

            <stop
              offset="0%"
              stopColor="#7a99a7"
            />

            <stop
              offset="40%"
              stopColor="#69c5d7"
            />

            <stop
              offset="100%"
              stopColor="#9edce5"
            />

          </linearGradient>

        </defs>

        {[0, 1, 2, 3].map(
          (line) => {
            const y =
              paddingTop
              + (
                availableHeight
                / 3
              )
              * line;

            return (
              <line
                key={
                  line
                }
                x1={
                  paddingX
                }
                y1={y}
                x2={
                  width
                  - paddingX
                }
                y2={y}
                stroke="rgba(255,255,255,0.045)"
                strokeWidth="1"
              />
            );
          }
        )}

        {areaPath && (
          <path
            d={
              areaPath
            }
            fill="url(#telemetryArea)"
          />
        )}

        {linePath && (
          <path
            d={
              linePath
            }
            fill="none"
            stroke="url(#telemetryLine)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {points.map(
          (
            point,
            index
          ) => (
            <g
              key={
                `${point.label}-${index}`
              }
            >

              {point.value > 0 && (
                <>

                  <circle
                    cx={
                      point.x
                    }
                    cy={
                      point.y
                    }
                    r="5"
                    fill="rgba(105,197,215,0.12)"
                  />

                  <circle
                    cx={
                      point.x
                    }
                    cy={
                      point.y
                    }
                    r="2.5"
                    fill="#8ad4e1"
                  />

                </>
              )}

              {(
                index === 0
                || index
                  === series.length - 1
                || index % 2 === 0
              ) && (
                <text
                  x={
                    point.x
                  }
                  y={
                    height
                    - 14
                  }
                  textAnchor="middle"
                  fill="#5f6e7a"
                  fontSize="10"
                >
                  {
                    point.label
                  }
                </text>
              )}

            </g>
          )
        )}

      </svg>

    </div>
  );
}


function SeverityLegend({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between">

      <div className="flex items-center gap-2">

        <span
          className="h-2 w-2 rounded-full"
          style={{
            background:
              color,
          }}
        />

        <span className="text-[11px] text-[#83919c]">
          {label}
        </span>

      </div>

      <span className="cz-mono text-[11px] text-[#d6dde2]">
        {value}
      </span>

    </div>
  );
}


function CaseQueueRow({
  investigationCase,
}: {
  investigationCase: Case;
}) {
  return (
    <Link
      href={
        `/cases/${investigationCase.id}`
      }
      className="cz-interactive-row block px-5 py-4"
    >

      <div className="flex items-start justify-between gap-4">

        <div className="min-w-0">

          <div className="mb-2 flex items-center gap-2">

            <PriorityDot
              priority={
                investigationCase.priority
              }
            />

            <span className="text-[10px] font-medium text-[#778692]">
              {
                formatLabel(
                  investigationCase.priority
                )
              } priority
            </span>

          </div>

          <p className="truncate text-[12px] font-medium text-[#d9e0e5]">
            {
              investigationCase.title
            }
          </p>

          <p className="mt-1 truncate text-[10px] text-[#63727f]">
            {
              investigationCase.assigned_analyst
              ?? "Unassigned analyst"
            }
          </p>

        </div>

        <CaseStatusBadge
          status={
            investigationCase.status
          }
        />

      </div>

    </Link>
  );
}


function QueueMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="px-3 text-center first:pl-0 last:pr-0">

      <p className="text-[18px] font-semibold tracking-[-0.03em] text-[#e3e8ec]">
        {value}
      </p>

      <p className="mt-1 text-[9px] text-[#61707d]">
        {label}
      </p>

    </div>
  );
}


function HealthCell({
  name,
  detail,
  healthy,
  status,
}: {
  name: string;
  detail: string;
  healthy: boolean;
  status: string;
}) {
  return (
    <div className="flex min-h-[94px] items-center justify-between gap-4 px-5 py-4">

      <div className="flex min-w-0 items-center gap-3">

        <span
          className={`h-2 w-2 shrink-0 rounded-full ${
            healthy
              ? "bg-[#63cfa4] shadow-[0_0_8px_rgba(99,207,164,0.24)]"
              : "bg-[#e56e73]"
          }`}
        />

        <div className="min-w-0">

          <p className="truncate text-[11px] font-medium text-[#cdd5db]">
            {name}
          </p>

          <p className="mt-1 truncate text-[9px] text-[#5f6e7b]">
            {detail}
          </p>

        </div>

      </div>

      <span
        className={`shrink-0 text-[10px] font-medium ${
          healthy
            ? "text-[#72caa8]"
            : "text-[#df7e82]"
        }`}
      >
        {status}
      </span>

    </div>
  );
}


function AlertRow({
  alert,
}: {
  alert: Alert;
}) {
  return (
    <Link
      href={
        `/alerts/${alert.id}`
      }
      className="cz-interactive-row grid grid-cols-[100px_1fr_140px_150px] items-center gap-4 px-6 py-[17px]"
    >

      <SeverityBadge
        severity={
          alert.severity
        }
      />

      <div className="min-w-0 pr-5">

        <p className="truncate text-[12px] font-medium text-[#dce3e8]">
          {alert.title}
        </p>

        <p className="mt-1 truncate text-[10px] text-[#657481]">
          {alert.source}
        </p>

      </div>

      <StatusBadge
        status={
          alert.status
        }
      />

      <span className="text-[10px] text-[#74828e]">
        {
          formatAlertTime(
            alert.created_at
          )
        }
      </span>

    </Link>
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
      "border-[#69c5d7]/15 bg-[#69c5d7]/[0.07] text-[#80cfdd]",

    medium:
      "border-[#d8aa55]/15 bg-[#d8aa55]/[0.07] text-[#deb967]",

    high:
      "border-[#d98c55]/20 bg-[#d98c55]/[0.08] text-[#e29b69]",

    critical:
      "border-[#e56e73]/20 bg-[#e56e73]/[0.08] text-[#ed8589]",
  };

  return (
    <span
      className={`w-fit rounded-[6px] border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.045em] ${
        styles[
          normalized
        ] ??
        "border-white/[0.07] bg-white/[0.04] text-[#929da6]"
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
  const normalized =
    status.toLowerCase();

  const styles: Record<
    string,
    string
  > = {
    new:
      "border-white/[0.07] bg-white/[0.045] text-[#aeb8c0]",

    assigned:
      "border-[#69c5d7]/15 bg-[#69c5d7]/[0.07] text-[#80cdd9]",

    investigating:
      "border-[#c9a965]/15 bg-[#c9a965]/[0.07] text-[#d4b772]",

    resolved:
      "border-[#63cfa4]/15 bg-[#63cfa4]/[0.07] text-[#7bd3b0]",

    closed:
      "border-white/[0.05] bg-white/[0.025] text-[#7c8994]",
  };

  return (
    <span
      className={`w-fit rounded-[6px] border px-2.5 py-1 text-[9px] font-medium ${
        styles[
          normalized
        ] ??
        "border-white/[0.07] bg-white/[0.04] text-[#929da6]"
      }`}
    >
      {
        formatLabel(
          status
        )
      }
    </span>
  );
}


function CaseStatusBadge({
  status,
}: {
  status: string;
}) {
  const normalized =
    status.toLowerCase();

  const styles: Record<
    string,
    string
  > = {
    open:
      "border-[#69c5d7]/15 bg-[#69c5d7]/[0.07] text-[#81d0db]",

    investigating:
      "border-[#c9a965]/15 bg-[#c9a965]/[0.07] text-[#d6b972]",

    resolved:
      "border-[#63cfa4]/15 bg-[#63cfa4]/[0.07] text-[#7cd3b0]",

    closed:
      "border-white/[0.055] bg-white/[0.025] text-[#7c8994]",
  };

  return (
    <span
      className={`shrink-0 rounded-[6px] border px-2.5 py-1 text-[9px] font-medium ${
        styles[
          normalized
        ] ??
        "border-white/[0.07] bg-white/[0.04] text-[#929da6]"
      }`}
    >
      {
        formatLabel(
          status
        )
      }
    </span>
  );
}


function PriorityDot({
  priority,
}: {
  priority: string;
}) {
  const normalized =
    priority.toLowerCase();

  const colors: Record<
    string,
    string
  > = {
    low:
      "#69c5d7",

    medium:
      "#d8aa55",

    high:
      "#d98c55",

    critical:
      "#e56e73",
  };

  return (
    <span
      className="h-1.5 w-1.5 rounded-full"
      style={{
        background:
          colors[
            normalized
          ]
          ?? "#788691",
      }}
    />
  );
}


function buildSeverityGradient({
  critical,
  high,
  medium,
  low,
}: {
  critical: number;
  high: number;
  medium: number;
  low: number;
}) {
  const total =
    critical
    + high
    + medium
    + low;

  if (total === 0) {
    return (
      "conic-gradient("
      + "#26333e 0deg 360deg"
      + ")"
    );
  }

  const criticalEnd =
    critical
    / total
    * 100;

  const highEnd =
    criticalEnd
    + high
      / total
      * 100;

  const mediumEnd =
    highEnd
    + medium
      / total
      * 100;

  return (
    "conic-gradient("
    + `#e56e73 0% ${criticalEnd}%, `
    + `#d98c55 ${criticalEnd}% ${highEnd}%, `
    + `#d8aa55 ${highEnd}% ${mediumEnd}%, `
    + `#69c5d7 ${mediumEnd}% 100%`
    + ")"
  );
}


function buildTelemetrySeries(
  events: TelemetryEvent[]
): ActivityPoint[] {
  const bucketCount =
    12;

  const bucketDuration =
    2
    * 60
    * 60
    * 1000;

  if (events.length === 0) {
    return Array.from(
      {
        length:
          bucketCount,
      },
      (
        _,
        index
      ) => ({
        label:
          `${String(
            index * 2
          ).padStart(
            2,
            "0"
          )}:00`,

        value:
          0,
      })
    );
  }

  const timestamps =
    events
      .map(
        (event) =>
          new Date(
            event.event_time
          ).getTime()
      )
      .filter(
        (timestamp) =>
          Number.isFinite(
            timestamp
          )
      );

  if (
    timestamps.length
    === 0
  ) {
    return [];
  }

  const latest =
    Math.max(
      ...timestamps
    );

  const windowEnd =
    latest + 1;

  const windowStart =
    windowEnd
    - bucketCount
      * bucketDuration;

  const buckets =
    Array.from(
      {
        length:
          bucketCount,
      },
      () =>
        0
    );

  timestamps.forEach(
    (timestamp) => {
      const index =
        Math.floor(
          (
            timestamp
            - windowStart
          )
          / bucketDuration
        );

      if (
        index >= 0
        && index
          < bucketCount
      ) {
        buckets[
          index
        ] += 1;
      }
    }
  );

  return buckets.map(
    (
      value,
      index
    ) => {
      const bucketTime =
        new Date(
          windowStart
          + index
            * bucketDuration
        );

      return {
        label:
          new Intl.DateTimeFormat(
            "en-CA",
            {
              hour:
                "numeric",
            }
          ).format(
            bucketTime
          ),

        value,
      };
    }
  );
}


function createSmoothPath(
  points: {
    x: number;
    y: number;
  }[]
) {
  if (
    points.length === 0
  ) {
    return "";
  }

  if (
    points.length === 1
  ) {
    return (
      `M ${points[0].x} ${points[0].y}`
    );
  }

  let path =
    `M ${points[0].x} ${points[0].y}`;

  for (
    let index = 0;
    index
      < points.length - 1;
    index += 1
  ) {
    const current =
      points[index];

    const next =
      points[
        index + 1
      ];

    const midpoint =
      (
        current.x
        + next.x
      )
      / 2;

    path +=
      ` C ${midpoint} ${current.y},`
      + ` ${midpoint} ${next.y},`
      + ` ${next.x} ${next.y}`;
  }

  return path;
}


function getLatestEventTime(
  events: TelemetryEvent[]
) {
  if (
    events.length === 0
  ) {
    return null;
  }

  const validDates =
    events
      .map(
        (event) =>
          new Date(
            event.event_time
          )
      )
      .filter(
        (date) =>
          !Number.isNaN(
            date.getTime()
          )
      );

  if (
    validDates.length
    === 0
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
  if (!value) {
    return value;
  }

  return (
    value.charAt(0).toUpperCase()
    + value.slice(1)
  );
}


function isToday(
  timestamp: string
) {
  const eventDate =
    new Date(timestamp);

  const today =
    new Date();

  return (
    eventDate.getFullYear()
      === today.getFullYear()
    &&
    eventDate.getMonth()
      === today.getMonth()
    &&
    eventDate.getDate()
      === today.getDate()
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
    new Date(timestamp)
  );
}


function formatAlertTime(
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
    new Date(timestamp)
  );
}