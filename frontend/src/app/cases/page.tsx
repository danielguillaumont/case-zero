import Link from "next/link";

import { getCases } from "@/lib/api";
import type { Case } from "@/lib/api";


export default async function CasesPage() {
  const cases = await getCases();

  const openCases = cases.filter(
    (investigationCase) =>
      !["resolved", "closed"].includes(
        investigationCase.status.toLowerCase()
      )
  );

  const highPriorityCases = openCases.filter(
    (investigationCase) =>
      ["high", "critical"].includes(
        investigationCase.priority.toLowerCase()
      )
  );

  const resolvedCases = cases.filter(
    (investigationCase) =>
      ["resolved", "closed"].includes(
        investigationCase.status.toLowerCase()
      )
  );

  const navigationItems = [
    {
      label: "Dashboard",
      href: "/",
    },
    {
      label: "Alerts",
      href: "/alerts",
    },
    {
      label: "Cases",
      href: "/cases",
    },
    {
      label: "Hunt",
      href: "#",
    },
    {
      label: "Intelligence",
      href: "#",
    },
    {
      label: "Rules",
      href: "#",
    },
    {
      label: "Playbooks",
      href: "#",
    },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="flex min-h-screen">

        {/* Sidebar */}
        <aside className="w-64 border-r border-zinc-800 bg-zinc-950 p-6">
          <div className="mb-10">
            <h1 className="text-2xl font-bold tracking-tight">
              CASE
              <span className="text-emerald-400">
                //ZERO
              </span>
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
                    item.label === "Cases"
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

          {/* Header */}
          <header className="mb-8 flex items-start justify-between gap-6">
            <div>
              <p className="text-sm text-emerald-400">
                CASE//ZERO
              </p>

              <h2 className="mt-2 text-3xl font-semibold">
                Case Management
              </h2>

              <p className="mt-3 text-sm text-zinc-500">
                Manage security investigations and their linked alerts.
              </p>
            </div>

            <div className="rounded-full border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs text-zinc-500">
              Local Development
            </div>
          </header>

          {/* Overview */}
          <section>
            <p className="mb-4 text-xs uppercase tracking-[0.15em] text-zinc-500">
              Case Overview
            </p>

            <div className="grid grid-cols-4 gap-4">

              <MetricCard
                label="Open Cases"
                value={openCases.length}
              />

              <MetricCard
                label="High Priority"
                value={highPriorityCases.length}
              />

              <MetricCard
                label="Resolved"
                value={resolvedCases.length}
              />

              <MetricCard
                label="Total Cases"
                value={cases.length}
              />

            </div>
          </section>

          {/* Cases Table */}
          <section className="mt-6 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">

            <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-5">
              <div>
                <h3 className="font-medium">
                  Investigation Cases
                </h3>

                <p className="mt-1 text-sm text-zinc-500">
                  Active and historical security investigations.
                </p>
              </div>

              <p className="text-xs text-zinc-500">
                {cases.length} total
              </p>
            </div>

            {cases.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <p className="text-sm text-zinc-400">
                  No investigation cases found.
                </p>

                <p className="mt-2 text-xs text-zinc-600">
                  Cases created through CASE//ZERO will appear here.
                </p>
              </div>
            ) : (
              <div>
                {/* Table Header */}
                <div className="grid grid-cols-[120px_1fr_190px_150px_190px] gap-4 border-b border-zinc-800 px-6 py-3 text-xs uppercase tracking-wider text-zinc-600">
                  <div>
                    Priority
                  </div>

                  <div>
                    Case
                  </div>

                  <div>
                    Analyst
                  </div>

                  <div>
                    Status
                  </div>

                  <div>
                    Created
                  </div>
                </div>

                {/* Table Rows */}
                <div className="divide-y divide-zinc-800">
                  {cases.map((investigationCase) => (
                    <CaseTableRow
                      key={investigationCase.id}
                      investigationCase={investigationCase}
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

      <p className="mt-3 text-3xl font-semibold text-zinc-100">
        {value}
      </p>
    </div>
  );
}


function CaseTableRow({
  investigationCase,
}: {
  investigationCase: Case;
}) {
  return (
    <Link
      href={`/cases/${investigationCase.id}`}
      className="grid grid-cols-[120px_1fr_190px_150px_190px] items-center gap-4 px-6 py-5 transition hover:bg-zinc-800/40"
    >

      <div>
        <PriorityBadge
          priority={investigationCase.priority}
        />
      </div>

      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-zinc-200">
          {investigationCase.title}
        </p>

        <p className="mt-1 truncate text-xs text-zinc-500">
          {investigationCase.description ??
            "No case description provided."}
        </p>
      </div>

      <div>
        <p className="truncate text-sm text-zinc-400">
          {investigationCase.assigned_analyst ??
            "Unassigned"}
        </p>
      </div>

      <div>
        <CaseStatusBadge
          status={investigationCase.status}
        />
      </div>

      <div>
        <p className="text-sm text-zinc-500">
          {formatCaseTime(
            investigationCase.created_at
          )}
        </p>
      </div>

    </Link>
  );
}


function PriorityBadge({
  priority,
}: {
  priority: string;
}) {
  const normalizedPriority =
    priority.toLowerCase();

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
      className={`inline-flex rounded-md border px-3 py-1.5 text-xs font-medium uppercase ${
        styles[normalizedPriority] ??
        "border-zinc-700 bg-zinc-800 text-zinc-400"
      }`}
    >
      {priority}
    </span>
  );
}


function CaseStatusBadge({
  status,
}: {
  status: string;
}) {
  const normalizedStatus =
    status.toLowerCase();

  const styles: Record<string, string> = {
    open:
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
      className={`inline-flex rounded-md border px-3 py-1.5 text-xs font-medium uppercase ${
        styles[normalizedStatus] ??
        "border-zinc-700 bg-zinc-800 text-zinc-400"
      }`}
    >
      {status}
    </span>
  );
}


function formatCaseTime(timestamp: string) {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}