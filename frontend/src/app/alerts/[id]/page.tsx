import Link from "next/link";
import { notFound } from "next/navigation";

import { getAlert } from "@/lib/api";
import { updateAlertStatus } from "./actions";


export default async function AlertDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const alert = await getAlert(id);

  if (!alert) {
    notFound();
  }

  const normalizedStatus = alert.status.toLowerCase();

  const startInvestigationAction = updateAlertStatus.bind(
    null,
    alert.id,
    "investigating"
  );

  const resolveAlertAction = updateAlertStatus.bind(
    null,
    alert.id,
    "resolved"
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
            <div className="rounded-lg px-4 py-3 text-sm text-zinc-500">
              Administration
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-10">

          {/* Back Link */}
          <div className="mb-8">
            <Link
              href="/alerts"
              className="text-sm text-zinc-500 transition hover:text-zinc-200"
            >
              ← Back to Alerts
            </Link>
          </div>

          {/* Alert Header */}
          <header className="mb-8 flex items-start justify-between gap-6">
            <div>
              <p className="text-sm text-emerald-400">
                CASE//ZERO / ALERT
              </p>

              <h2 className="mt-2 text-3xl font-semibold">
                {alert.title}
              </h2>

              <p className="mt-3 text-sm text-zinc-500">
                Review alert context and investigation details.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <SeverityBadge severity={alert.severity} />

              <StatusBadge status={alert.status} />
            </div>
          </header>

          <div className="grid grid-cols-3 gap-6">

            {/* Alert Details */}
            <section className="col-span-2 rounded-xl border border-zinc-800 bg-zinc-900">
              <div className="border-b border-zinc-800 p-6">
                <h3 className="font-medium">
                  Alert Details
                </h3>

                <p className="mt-1 text-sm text-zinc-500">
                  Detection information associated with this alert.
                </p>
              </div>

              <div className="p-6">

                <DetailField
                  label="Description"
                  value={
                    alert.description ??
                    "No description provided."
                  }
                  large
                />

                <div className="mt-8 grid grid-cols-2 gap-8">

                  <DetailField
                    label="Source"
                    value={alert.source}
                  />

                  <DetailField
                    label="Severity"
                    value={alert.severity.toUpperCase()}
                  />

                  <DetailField
                    label="Status"
                    value={alert.status.toUpperCase()}
                  />

                  <DetailField
                    label="Created"
                    value={formatAlertTime(alert.created_at)}
                  />

                  <DetailField
                    label="Last Updated"
                    value={formatAlertTime(alert.updated_at)}
                  />

                </div>
              </div>
            </section>

            {/* Investigation Panel */}
            <section className="rounded-xl border border-zinc-800 bg-zinc-900">
              <div className="border-b border-zinc-800 p-6">
                <h3 className="font-medium">
                  Investigation
                </h3>

                <p className="mt-1 text-sm text-zinc-500">
                  Analyst workflow
                </p>
              </div>

              <div className="space-y-6 p-6">

                {/* Current Status */}
                <div>
                  <p className="text-xs uppercase tracking-wider text-zinc-500">
                    Current Status
                  </p>

                  <div className="mt-3">
                    <StatusBadge status={alert.status} />
                  </div>
                </div>

                {/* Workflow Action */}
                <div className="border-t border-zinc-800 pt-6">

                  <p className="text-xs uppercase tracking-wider text-zinc-500">
                    Analyst Action
                  </p>

                  {["new", "assigned"].includes(normalizedStatus) && (
                    <form
                      action={startInvestigationAction}
                      className="mt-3"
                    >
                      <button
                        type="submit"
                        className="w-full rounded-lg border border-yellow-800 bg-yellow-950 px-4 py-3 text-sm font-medium text-yellow-400 transition hover:bg-yellow-900"
                      >
                        Start Investigation
                      </button>
                    </form>
                  )}

                  {normalizedStatus === "investigating" && (
                    <form
                      action={resolveAlertAction}
                      className="mt-3"
                    >
                      <button
                        type="submit"
                        className="w-full rounded-lg border border-emerald-800 bg-emerald-950 px-4 py-3 text-sm font-medium text-emerald-400 transition hover:bg-emerald-900"
                      >
                        Resolve Alert
                      </button>
                    </form>
                  )}

                  {normalizedStatus === "resolved" && (
                    <div className="mt-3 rounded-lg border border-emerald-900 bg-emerald-950/40 px-4 py-3">
                      <p className="text-sm text-emerald-400">
                        Investigation resolved
                      </p>
                    </div>
                  )}

                  {normalizedStatus === "closed" && (
                    <div className="mt-3 rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3">
                      <p className="text-sm text-zinc-400">
                        Alert closed
                      </p>
                    </div>
                  )}

                </div>

                {/* Analyst */}
                <div className="border-t border-zinc-800 pt-6">
                  <p className="text-xs uppercase tracking-wider text-zinc-500">
                    Assigned Analyst
                  </p>

                  <p className="mt-2 text-sm text-zinc-400">
                    Unassigned
                  </p>
                </div>

                {/* Case */}
                <div className="border-t border-zinc-800 pt-6">
                  <p className="text-xs uppercase tracking-wider text-zinc-500">
                    Investigation Case
                  </p>

                  <p className="mt-2 text-sm text-zinc-400">
                    No case created
                  </p>
                </div>

              </div>
            </section>
          </div>

          {/* Technical Metadata */}
          <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h3 className="font-medium">
              Technical Metadata
            </h3>

            <p className="mt-1 text-sm text-zinc-500">
              Internal CASE//ZERO alert identifiers.
            </p>

            <div className="mt-6">
              <p className="text-xs uppercase tracking-wider text-zinc-500">
                Alert ID
              </p>

              <code className="mt-2 block rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-400">
                {alert.id}
              </code>
            </div>
          </section>

        </main>
      </div>
    </div>
  );
}


function DetailField({
  label,
  value,
  large = false,
}: {
  label: string;
  value: string;
  large?: boolean;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-zinc-500">
        {label}
      </p>

      <p
        className={`mt-2 text-zinc-300 ${
          large ? "text-sm leading-7" : "text-sm"
        }`}
      >
        {value}
      </p>
    </div>
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
      className={`rounded-md border px-3 py-1.5 text-xs font-medium uppercase ${
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
      className={`rounded-md border px-3 py-1.5 text-xs font-medium uppercase ${
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