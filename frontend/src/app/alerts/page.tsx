import Link from "next/link";

import Sidebar from "@/components/Sidebar";

import {
  getAlerts,
} from "@/lib/api";

import type {
  Alert,
} from "@/lib/api";


type AlertSearchParams = {
  q?: string | string[];
  severity?: string | string[];
  status?: string | string[];
};


export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<AlertSearchParams>;
}) {
  const alerts = await getAlerts();
  const params = await searchParams;

  const query =
    getSearchParam(params.q)
      .trim()
      .toLowerCase();

  const severityFilter =
    getSearchParam(
      params.severity
    ).toLowerCase();

  const statusFilter =
    getSearchParam(
      params.status
    ).toLowerCase();

  const openAlerts = alerts.filter(
    (alert) =>
      [
        "new",
        "assigned",
        "investigating",
      ].includes(
        alert.status.toLowerCase()
      )
  );

  const newAlerts = openAlerts.filter(
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

  const resolvedAlerts =
    alerts.filter(
      (alert) =>
        [
          "resolved",
          "closed",
        ].includes(
          alert.status.toLowerCase()
        )
    );

  const filteredAlerts =
    alerts
      .filter((alert) => {
        const searchableText = [
          alert.title,
          alert.description ?? "",
          alert.source,
          alert.status,
          alert.severity,
          alert.assigned_analyst ?? "",
        ]
          .join(" ")
          .toLowerCase();

        const matchesQuery =
          query.length === 0
          || searchableText.includes(
            query
          );

        const matchesSeverity =
          !severityFilter
          || severityFilter === "all"
          || alert.severity
            .toLowerCase()
            === severityFilter;

        const matchesStatus =
          !statusFilter
          || statusFilter === "all"
          || alert.status
            .toLowerCase()
            === statusFilter;

        return (
          matchesQuery
          && matchesSeverity
          && matchesStatus
        );
      })
      .sort(
        (left, right) => {
          const severityDifference =
            getSeverityRank(
              right.severity
            )
            - getSeverityRank(
              left.severity
            );

          if (
            severityDifference !== 0
          ) {
            return severityDifference;
          }

          return (
            new Date(
              right.created_at
            ).getTime()
            - new Date(
              left.created_at
            ).getTime()
          );
        }
      );

  const environmentLabel =
    process.env.NODE_ENV
      === "production"
      ? "Production"
      : "Local Development";

  const activeFilterCount = [
    query.length > 0,
    Boolean(
      severityFilter
      && severityFilter !== "all"
    ),
    Boolean(
      statusFilter
      && statusFilter !== "all"
    ),
  ].filter(Boolean).length;

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
                    Alert Triage
                  </span>
                </div>

                <h2 className="text-[34px] font-semibold tracking-[-0.04em] text-[#f4f6f8]">
                  Alert Management
                </h2>

                <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[#81909c]">
                  Prioritize detections,
                  investigate suspicious
                  activity, and move alerts
                  through the analyst workflow.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <div className="rounded-[10px] border border-[#ffffff]/[0.07] bg-[#0b141e]/80 px-4 py-3">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#667583]">
                    Environment
                  </p>

                  <p className="mt-1 text-[11px] font-medium text-[#c9d1d8]">
                    {environmentLabel}
                  </p>
                </div>

                <div className="rounded-[10px] border border-[#63cfa4]/15 bg-[#63cfa4]/[0.045] px-4 py-3">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#668c7d]">
                    Queue
                  </p>

                  <div className="mt-1 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#63cfa4]" />

                    <p className="text-[11px] font-medium text-[#84d8b7]">
                      {openAlerts.length} active
                    </p>
                  </div>
                </div>
              </div>
            </header>

            {/* Overview */}
            <section>
              <div className="mb-3 flex items-end justify-between">
                <div>
                  <h3 className="text-[14px] font-medium text-[#dce3e8]">
                    Alert posture
                  </h3>

                  <p className="mt-1 text-[11px] text-[#657481]">
                    Current detection and
                    investigation workload
                  </p>
                </div>

                <p className="text-[10px] text-[#5e6d79]">
                  {alerts.length} alerts retained
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                <MetricCard
                  label="Open alerts"
                  value={openAlerts.length}
                  context={`${newAlerts.length} new · ${investigatingAlerts.length} investigating`}
                  accent="#c9a965"
                />

                <MetricCard
                  label="Open critical"
                  value={criticalAlerts.length}
                  context={
                    criticalAlerts.length > 0
                      ? "Immediate analyst attention"
                      : "No open critical alerts"
                  }
                  accent="#e66b6b"
                />

                <MetricCard
                  label="High severity"
                  value={highAlerts.length}
                  context="Elevated detection priority"
                  accent="#df945b"
                />

                <MetricCard
                  label="Resolved"
                  value={resolvedAlerts.length}
                  context={`${alerts.length} total alerts`}
                  accent="#63cfa4"
                />
              </div>
            </section>

            {/* Queue */}
            <section className="mt-5 overflow-hidden rounded-[14px] border border-[#1d2a36] bg-[#0b141e]/95 shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
              <div className="flex items-start justify-between gap-8 border-b border-[#1c2833] px-6 py-5">
                <div className="flex items-start gap-3">
                  <span className="mt-[7px] h-2 w-2 rounded-full bg-[#d6b45f]" />

                  <div>
                    <h3 className="text-[15px] font-semibold text-[#e8edf1]">
                      Alert queue
                    </h3>

                    <p className="mt-1 text-[11px] text-[#667583]">
                      Prioritized detections
                      requiring analyst review
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-[12px] font-medium text-[#c9d1d8]">
                    {filteredAlerts.length}{" "}
                    {filteredAlerts.length === 1
                      ? "result"
                      : "results"}
                  </p>

                  <p className="mt-1 text-[9px] uppercase tracking-[0.08em] text-[#586672]">
                    {alerts.length} total alerts
                  </p>
                </div>
              </div>

              {/* Filters */}
              <form
                action="/alerts"
                method="get"
                className="border-b border-[#1c2833] bg-[#08111a]/70 px-6 py-4"
              >
                <div className="flex flex-col gap-3 xl:flex-row">
                  <div className="relative min-w-0 flex-1">
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#596976]"
                    >
                      <circle
                        cx="11"
                        cy="11"
                        r="7"
                      />
                      <path d="m20 20-3.6-3.6" />
                    </svg>

                    <input
                      type="search"
                      name="q"
                      defaultValue={
                        getSearchParam(
                          params.q
                        )
                      }
                      placeholder="Search title, source, analyst, severity..."
                      className="h-11 w-full rounded-[9px] border border-[#1d2b37] bg-[#08111a] pl-11 pr-4 text-[12px] text-[#d8e0e6] outline-none transition placeholder:text-[#52616d] focus:border-[#69c5d7]/50 focus:bg-[#0a141e]"
                    />
                  </div>

                  <select
                    name="severity"
                    defaultValue={
                      severityFilter || "all"
                    }
                    className="h-11 min-w-[170px] rounded-[9px] border border-[#1d2b37] bg-[#08111a] px-4 text-[12px] text-[#aeb8c1] outline-none transition focus:border-[#69c5d7]/50"
                  >
                    <option value="all">
                      All severities
                    </option>

                    <option value="critical">
                      Critical
                    </option>

                    <option value="high">
                      High
                    </option>

                    <option value="medium">
                      Medium
                    </option>

                    <option value="low">
                      Low
                    </option>
                  </select>

                  <select
                    name="status"
                    defaultValue={
                      statusFilter || "all"
                    }
                    className="h-11 min-w-[170px] rounded-[9px] border border-[#1d2b37] bg-[#08111a] px-4 text-[12px] text-[#aeb8c1] outline-none transition focus:border-[#69c5d7]/50"
                  >
                    <option value="all">
                      All statuses
                    </option>

                    <option value="new">
                      New
                    </option>

                    <option value="assigned">
                      Assigned
                    </option>

                    <option value="investigating">
                      Investigating
                    </option>

                    <option value="resolved">
                      Resolved
                    </option>

                    <option value="closed">
                      Closed
                    </option>
                  </select>

                  <button
                    type="submit"
                    className="h-11 rounded-[9px] border border-[#c9a965]/25 bg-[#c9a965]/[0.08] px-5 text-[11px] font-semibold text-[#d8bc7b] transition hover:border-[#c9a965]/45 hover:bg-[#c9a965]/[0.13]"
                  >
                    Apply filters
                  </button>

                  {activeFilterCount > 0 && (
                    <Link
                      href="/alerts"
                      className="flex h-11 items-center justify-center rounded-[9px] border border-[#1d2b37] bg-[#0a131c] px-5 text-[11px] font-medium text-[#8997a3] transition hover:border-[#31404d] hover:text-[#dbe1e6]"
                    >
                      Reset
                    </Link>
                  )}
                </div>

                {activeFilterCount > 0 && (
                  <p className="mt-3 text-[10px] text-[#60707c]">
                    {activeFilterCount} active{" "}
                    {activeFilterCount === 1
                      ? "filter"
                      : "filters"}
                  </p>
                )}
              </form>

              {filteredAlerts.length === 0 ? (
                <div className="flex min-h-72 items-center justify-center px-6">
                  <div className="max-w-md text-center">
                    <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-[#25323d] bg-[#0a131c] text-[#667583]">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        className="h-5 w-5"
                      >
                        <path d="M12 9v4" />
                        <path d="M12 17h.01" />
                        <path d="M10.3 3.9 2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                      </svg>
                    </div>

                    <p className="mt-4 text-[13px] font-medium text-[#d1d9df]">
                      No alerts match the
                      current filters
                    </p>

                    <p className="mt-2 text-[11px] leading-5 text-[#667583]">
                      Adjust the search,
                      severity, or workflow
                      status to broaden the
                      queue.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="min-w-[1160px]">

                    {/* Header */}
                    <div className="grid grid-cols-[110px_minmax(360px,1fr)_150px_135px_175px_150px] gap-4 border-b border-[#1c2833] bg-[#071019]/80 px-6 py-3">
                      <span className="cz-table-head">
                        Severity
                      </span>

                      <span className="cz-table-head">
                        Detection
                      </span>

                      <span className="cz-table-head">
                        Source
                      </span>

                      <span className="cz-table-head">
                        Status
                      </span>

                      <span className="cz-table-head">
                        Analyst
                      </span>

                      <span className="cz-table-head">
                        Created
                      </span>
                    </div>

                    <div className="divide-y divide-[#1a2630]">
                      {filteredAlerts.map(
                        (alert) => (
                          <AlertTableRow
                            key={alert.id}
                            alert={alert}
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
              background: accent,
              opacity: 0.7,
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


function AlertTableRow({
  alert,
}: {
  alert: Alert;
}) {
  return (
    <Link
      href={`/alerts/${alert.id}`}
      className="group grid grid-cols-[110px_minmax(360px,1fr)_150px_135px_175px_150px] items-center gap-4 px-6 py-[18px] transition duration-150 hover:bg-[#12202c]/60"
    >
      <SeverityBadge
        severity={alert.severity}
      />

      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-[13px] font-semibold text-[#e1e7eb] transition group-hover:text-white">
            {alert.title}
          </p>

          <span className="text-[#4f5e69] opacity-0 transition group-hover:opacity-100">
            →
          </span>
        </div>

        <p className="mt-1 truncate text-[10px] leading-5 text-[#687783]">
          {alert.description
            ?? "No detection description available."}
        </p>
      </div>

      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium text-[#9ca8b1]">
          {alert.source}
        </p>

        <p className="mt-1 truncate text-[9px] uppercase tracking-[0.06em] text-[#52616d]">
          Detection source
        </p>
      </div>

      <StatusBadge
        status={alert.status}
      />

      <div className="min-w-0">
        <p
          className={`truncate text-[11px] ${
            alert.assigned_analyst
              ? "text-[#adb7bf]"
              : "text-[#687783]"
          }`}
        >
          {alert.assigned_analyst
            ?? "Unassigned"}
        </p>

        <p className="mt-1 text-[9px] uppercase tracking-[0.06em] text-[#52616d]">
          Owner
        </p>
      </div>

      <div>
        <p className="font-mono text-[10px] text-[#8c99a4]">
          {formatAlertTime(
            alert.created_at
          )}
        </p>
      </div>
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
    critical:
      "border-[#e66b6b]/30 bg-[#e66b6b]/[0.08] text-[#f08a8a]",

    high:
      "border-[#df8950]/30 bg-[#df8950]/[0.08] text-[#e9a067]",

    medium:
      "border-[#d9a950]/30 bg-[#d9a950]/[0.08] text-[#e0bb69]",

    low:
      "border-[#69c5d7]/25 bg-[#69c5d7]/[0.07] text-[#86d2df]",
  };

  const dotStyles: Record<
    string,
    string
  > = {
    critical: "bg-[#e66b6b]",
    high: "bg-[#df8950]",
    medium: "bg-[#d9a950]",
    low: "bg-[#69c5d7]",
  };

  return (
    <span
      className={`inline-flex w-fit items-center gap-2 rounded-[6px] border px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.05em] ${
        styles[normalized]
        ?? "border-[#33404b] bg-[#17212a] text-[#9aa6b0]"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          dotStyles[normalized]
          ?? "bg-[#82909a]"
        }`}
      />

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
      "border-[#596875]/30 bg-[#596875]/[0.12] text-[#b6c0c8]",

    assigned:
      "border-[#7ca3d8]/25 bg-[#7ca3d8]/[0.08] text-[#96b7e2]",

    investigating:
      "border-[#d9a950]/25 bg-[#d9a950]/[0.08] text-[#e2bd69]",

    resolved:
      "border-[#63cfa4]/25 bg-[#63cfa4]/[0.08] text-[#80dbb7]",

    closed:
      "border-[#4c5964]/25 bg-[#4c5964]/[0.08] text-[#7f8d98]",
  };

  return (
    <span
      className={`inline-flex w-fit rounded-[6px] border px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.05em] ${
        styles[normalized]
        ?? "border-[#33404b] bg-[#17212a] text-[#9aa6b0]"
      }`}
    >
      {status}
    </span>
  );
}


function getSearchParam(
  value:
    | string
    | string[]
    | undefined
): string {
  if (
    Array.isArray(value)
  ) {
    return value[0] ?? "";
  }

  return value ?? "";
}


function getSeverityRank(
  severity: string
) {
  const ranking: Record<
    string,
    number
  > = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  return (
    ranking[
      severity.toLowerCase()
    ] ?? 0
  );
}


function formatAlertTime(
  timestamp: string
) {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }
  ).format(
    new Date(timestamp)
  );
}