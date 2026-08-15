import Link from "next/link";

import { getAlerts } from "@/lib/api";
import type { Alert } from "@/lib/api";


export default async function AlertsPage() {
  const alerts = await getAlerts();

  const openAlerts = alerts.filter((alert) =>
    ["new", "assigned", "investigating"].includes(
      alert.status.toLowerCase()
    )
  );

  const criticalAlerts = openAlerts.filter(
    (alert) => alert.severity.toLowerCase() === "critical"
  );

  const resolvedAlerts = alerts.filter(
    (alert) => alert.status.toLowerCase() === "resolved"
  );

  const navigationItems = [
    { label: "Dashboard", href: "/" },
    { label: "Alerts", href: "/alerts" },
    { label: "Cases", href: "#" },
    { label: "Hunt", href: "#" },
    { label: "Intelligence", href: "#" },
    { label: "Rules", href: "#" },
    { label: "Playbooks", href: "#" },
  ];

  const metrics = [
    { label: "Open Alerts", value: openAlerts.length },
    { label: "Critical", value: criticalAlerts.length },
    { label: "Resolved", value: resolvedAlerts.length },
    { label: "Total Alerts", value: alerts.length },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="flex min-h-screen">

        {/* Sidebar */}
        <aside className="w-64 border-r border-zinc-800 bg-zinc-950 p-6">
          <div className="mb-10">
            <h1 className="text-2xl font-bold tracking-tight">
              CASE<span className="text-emerald-400">//ZERO</span>
            </h1>

            <p className="mt-2 text-xs uppercase tracking-[0.2em] text-zinc-500">
              Security Operations
            </p>
          </div>

          <nav className="space-y-2">
            {navigationItems.map((item) =>
              item.href === "#" ? (
                <div
                  key={item.label}
                  className="w-full rounded-lg px-4 py-3 text-sm text-zinc-500"
                >
                  {item.label}
                </div>
              ) : (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`block w-full rounded-lg px-4 py-3 text-sm transition ${
                    item.label === "Alerts"
                      ? "bg-zinc-800 text-white"
                      : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              )
            )}
          </nav>

          <div className="mt-10 border-t border-zinc-800 pt-6">
            <div className="w-full rounded-lg px-4 py-3 text-sm text-zinc-500">
              Administration
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-10">
          <header className="mb-10 flex items-center justify-between">
            <div>
              <p className="text-sm text-emerald-400">
                CASE//ZERO
              </p>

              <h2 className="mt-1 text-3xl font-semibold">
                Alert Management
              </h2>

              <p className="mt-2 text-sm text-zinc-500">
                Review and triage security alerts across the platform.
              </p>
            </div>

            <div className="rounded-full border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-zinc-400">
              Local Development
            </div>
          </header>

          {/* Metrics */}
          <section>
            <h3 className="mb-4 text-sm font-medium uppercase tracking-wider text-zinc-500">
              Alert Overview
            </h3>

            <div className="grid grid-cols-4 gap-4">
              {metrics.map((metric) => (
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
              ))}
            </div>
          </section>

          {/* Alerts Table */}
          <section className="mt-8 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
            <div className="border-b border-zinc-800 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">
                    Security Alerts
                  </h3>

                  <p className="mt-1 text-sm text-zinc-500">
                    All alerts currently stored in CASE//ZERO.
                  </p>
                </div>

                <span className="text-xs text-zinc-500">
                  {alerts.length} total
                </span>
              </div>
            </div>

            {alerts.length === 0 ? (
              <div className="flex min-h-64 items-center justify-center">
                <p className="text-sm text-zinc-500">
                  No alerts found.
                </p>
              </div>
            ) : (
              <div>

                {/* Table Header */}
                <div className="grid grid-cols-[120px_1fr_160px_160px_190px] gap-4 border-b border-zinc-800 bg-zinc-950/40 px-6 py-3 text-xs uppercase tracking-wider text-zinc-500">
                  <span>Severity</span>
                  <span>Alert</span>
                  <span>Source</span>
                  <span>Status</span>
                  <span>Created</span>
                </div>

                {/* Table Rows */}
                <div className="divide-y divide-zinc-800">
                  {alerts.map((alert) => (
                    <AlertTableRow
                      key={alert.id}
                      alert={alert}
                    />
                  ))}
                </div>

              </div>
            )}
          </section>
        </main>
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
      className="grid grid-cols-[120px_1fr_160px_160px_190px] items-center gap-4 px-6 py-5 transition hover:bg-zinc-800/40"
    >
      <SeverityBadge severity={alert.severity} />

      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-zinc-100">
          {alert.title}
        </p>

        {alert.description && (
          <p className="mt-1 truncate text-xs text-zinc-500">
            {alert.description}
          </p>
        )}
      </div>

      <span className="truncate text-sm text-zinc-400">
        {alert.source}
      </span>

      <StatusBadge status={alert.status} />

      <span className="text-sm text-zinc-500">
        {formatAlertTime(alert.created_at)}
      </span>
    </Link>
  );
}


function SeverityBadge({
  severity,
}: {
  severity: string;
}) {
  const normalizedSeverity =
    severity.toLowerCase();

  const styles: Record<string, string> = {
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
      className={`w-20 rounded-md border px-2.5 py-1 text-center text-xs font-medium uppercase ${
        styles[normalizedSeverity] ??
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

  const styles: Record<string, string> = {
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
      className={`w-fit rounded-md border px-2.5 py-1 text-xs font-medium uppercase ${
        styles[normalizedStatus] ??
        "border-zinc-700 bg-zinc-800 text-zinc-400"
      }`}
    >
      {status}
    </span>
  );
}


function formatAlertTime(timestamp: string) {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}