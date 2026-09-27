import Link from "next/link";

import Sidebar from "@/components/Sidebar";

import {
  getCases,
} from "@/lib/api";

import type {
  Case,
} from "@/lib/api";


type CasesSearchParams = {
  q?: string;
  priority?: string;
  status?: string;
};


export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<CasesSearchParams>;
}) {
  const [
    cases,
    resolvedSearchParams,
  ] = await Promise.all([
    getCases(),
    searchParams,
  ]);

  const query =
    resolvedSearchParams.q
      ?.trim()
      .toLowerCase() ?? "";

  const priorityFilter =
    resolvedSearchParams.priority ??
    "all";

  const statusFilter =
    resolvedSearchParams.status ??
    "all";

  const openCases =
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
    cases.filter(
      (investigationCase) =>
        investigationCase.status.toLowerCase()
        === "investigating"
    );

  const highPriorityCases =
    openCases.filter(
      (investigationCase) =>
        [
          "high",
          "critical",
        ].includes(
          investigationCase.priority.toLowerCase()
        )
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

  const filteredCases =
    cases.filter(
      (investigationCase) => {
        const normalizedPriority =
          investigationCase.priority.toLowerCase();

        const normalizedStatus =
          investigationCase.status.toLowerCase();

        const searchableText = [
          investigationCase.title,
          investigationCase.description ?? "",
          investigationCase.assigned_analyst ?? "",
          investigationCase.priority,
          investigationCase.status,
        ]
          .join(" ")
          .toLowerCase();

        const matchesQuery =
          !query
          || searchableText.includes(
            query
          );

        const matchesPriority =
          priorityFilter === "all"
          || normalizedPriority
            === priorityFilter;

        const matchesStatus =
          statusFilter === "all"
          || normalizedStatus
            === statusFilter;

        return (
          matchesQuery
          && matchesPriority
          && matchesStatus
        );
      }
    );

  const environmentLabel =
    process.env.NODE_ENV === "production"
      ? "Production"
      : "Local Development";

  const hasFilters =
    Boolean(query)
    || priorityFilter !== "all"
    || statusFilter !== "all";

  return (
    <div className="min-h-screen text-[#eef3f6]">
      <div className="flex min-h-screen">
        <Sidebar />

        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-[1700px] px-8 py-8 xl:px-10 xl:py-10">

            {/* Header */}
            <header className="mb-7 flex items-start justify-between gap-8">
              <div>
                <div className="mb-3 flex items-center gap-3">
                  <span className="text-[12px] font-semibold text-[#c9a965]">
                    Security Operations
                  </span>

                  <span className="h-px w-8 bg-[#c9a965]/40" />

                  <span className="text-[11px] text-[#667583]">
                    Investigations
                  </span>
                </div>

                <h2 className="text-[34px] font-semibold tracking-[-0.04em] text-[#f4f6f8]">
                  Case Management
                </h2>

                <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[#81909c]">
                  Coordinate security investigations, analyst ownership,
                  linked detections, and case resolution from a unified
                  investigation workspace.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <div className="rounded-[10px] border border-[#1d2a34] bg-[#0a121a]/85 px-4 py-3">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#60707d]">
                    Environment
                  </p>

                  <p className="mt-1 text-[11px] font-medium text-[#d5dde3]">
                    {environmentLabel}
                  </p>
                </div>

                <div className="rounded-[10px] border border-[#63cfa4]/20 bg-[#63cfa4]/[0.045] px-4 py-3">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#668c7d]">
                    Queue
                  </p>

                  <div className="mt-1 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#63cfa4]" />

                    <p className="text-[11px] font-medium text-[#84d8b7]">
                      {openCases.length} active
                    </p>
                  </div>
                </div>
              </div>
            </header>

            <div className="mb-7 h-px bg-gradient-to-r from-[#c9a965]/55 via-[#24323d] to-transparent" />

            {/* Overview */}
            <section>
              <div className="mb-3 flex items-end justify-between">
                <div>
                  <h3 className="text-[14px] font-medium text-[#dce3e8]">
                    Investigation posture
                  </h3>

                  <p className="mt-1 text-[11px] text-[#657481]">
                    Current analyst workload and case lifecycle state
                  </p>
                </div>

                <p className="text-[10px] text-[#5e6d79]">
                  {cases.length} cases retained
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                <MetricCard
                  label="Active cases"
                  value={openCases.length}
                  context={`${investigatingCases.length} currently investigating`}
                  accent="#c9a965"
                />

                <MetricCard
                  label="Investigating"
                  value={investigatingCases.length}
                  context="Cases under active analyst review"
                  accent="#69c5d7"
                />

                <MetricCard
                  label="High priority"
                  value={highPriorityCases.length}
                  context="High or critical active cases"
                  accent="#d48a52"
                />

                <MetricCard
                  label="Resolved"
                  value={resolvedCases.length}
                  context={`${cases.length} total investigations`}
                  accent="#63cfa4"
                />
              </div>
            </section>

            {/* Investigation queue */}
            <section className="mt-5 overflow-hidden rounded-[14px] border border-[#1b2a35] bg-[#0b141d]/95 shadow-[0_18px_55px_rgba(0,0,0,0.18)]">
              <div className="flex items-center justify-between border-b border-[#1b2a35] bg-[#0e1822]/80 px-6 py-5">
                <div className="flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full bg-[#c9a965]" />

                  <div>
                    <h3 className="text-[15px] font-semibold text-[#e6ebef]">
                      Investigation queue
                    </h3>

                    <p className="mt-1 text-[11px] text-[#667583]">
                      Active and historical security investigations
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-[11px] font-medium text-[#dce3e8]">
                    {filteredCases.length}{" "}
                    {filteredCases.length === 1
                      ? "result"
                      : "results"}
                  </p>

                  <p className="mt-1 text-[9px] uppercase tracking-[0.08em] text-[#52616d]">
                    {cases.length} total cases
                  </p>
                </div>
              </div>

              {/* Filters */}
              <form
                method="get"
                className="border-b border-[#1b2a35] bg-[#09121a] px-6 py-4"
              >
                <div className="grid grid-cols-[minmax(0,1fr)_170px_170px_auto] gap-3">
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#52616d]">
                      ⌕
                    </span>

                    <input
                      type="search"
                      name="q"
                      defaultValue={
                        resolvedSearchParams.q ??
                        ""
                      }
                      placeholder="Search case, analyst, priority, status..."
                      className="h-11 w-full rounded-[9px] border border-[#1b2a35] bg-[#071019] pl-10 pr-4 text-[12px] text-[#dce3e8] outline-none transition placeholder:text-[#53616d] focus:border-[#69c5d7]/50"
                    />
                  </div>

                  <select
                    name="priority"
                    defaultValue={
                      priorityFilter
                    }
                    className="h-11 rounded-[9px] border border-[#1b2a35] bg-[#071019] px-4 text-[12px] text-[#bdc8d0] outline-none transition focus:border-[#69c5d7]/50"
                  >
                    <option value="all">
                      All priorities
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
                      statusFilter
                    }
                    className="h-11 rounded-[9px] border border-[#1b2a35] bg-[#071019] px-4 text-[12px] text-[#bdc8d0] outline-none transition focus:border-[#69c5d7]/50"
                  >
                    <option value="all">
                      All statuses
                    </option>

                    <option value="open">
                      Open
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
                    className="h-11 rounded-[9px] border border-[#c9a965]/30 bg-[#c9a965]/[0.07] px-5 text-[12px] font-medium text-[#dfc47e] transition hover:border-[#c9a965]/50 hover:bg-[#c9a965]/[0.11]"
                  >
                    Apply filters
                  </button>
                </div>

                {hasFilters && (
                  <div className="mt-3 flex justify-end">
                    <Link
                      href="/cases"
                      className="text-[10px] font-medium text-[#73818d] transition hover:text-[#c3ccd4]"
                    >
                      Clear filters
                    </Link>
                  </div>
                )}
              </form>

              {filteredCases.length === 0 ? (
                <div className="px-6 py-20 text-center">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-[#1b2a35] bg-[#081019] text-[#566672]">
                    ◇
                  </div>

                  <p className="mt-4 text-[13px] font-medium text-[#cbd4da]">
                    No investigations match these filters
                  </p>

                  <p className="mt-2 text-[11px] text-[#667583]">
                    Adjust the search criteria or clear the current filters.
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-[110px_minmax(0,1fr)_150px_190px_150px_150px] gap-5 border-b border-[#1b2a35] bg-[#08111a] px-6 py-3">
                    <span className="cz-table-head">
                      Priority
                    </span>

                    <span className="cz-table-head">
                      Investigation
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

                    <span className="cz-table-head">
                      Updated
                    </span>
                  </div>

                  <div className="divide-y divide-[#1a2833]">
                    {filteredCases.map(
                      (
                        investigationCase
                      ) => (
                        <CaseTableRow
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
                </>
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
    <div className="relative overflow-hidden rounded-[12px] border border-[#1b2a35] bg-[#0d1822]/95 p-5 shadow-[0_16px_45px_rgba(0,0,0,0.14)]">
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
              opacity: 0.72,
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


function CaseTableRow({
  investigationCase,
}: {
  investigationCase: Case;
}) {
  const assignedAnalyst =
    investigationCase.assigned_analyst ??
    "Unassigned";

  return (
    <Link
      href={`/cases/${investigationCase.id}`}
      className="group grid grid-cols-[110px_minmax(0,1fr)_150px_190px_150px_150px] items-center gap-5 px-6 py-5 transition hover:bg-[#12202b]/70"
    >
      <PriorityBadge
        priority={
          investigationCase.priority
        }
      />

      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold text-[#e6ebef] transition group-hover:text-white">
          {investigationCase.title}
        </p>

        <p className="mt-1.5 truncate text-[10px] leading-5 text-[#62717d]">
          {investigationCase.description ??
            "No case description provided."}
        </p>
      </div>

      <CaseStatusBadge
        status={
          investigationCase.status
        }
      />

      <div className="min-w-0">
        <p
          className={`truncate text-[11px] font-medium ${
            investigationCase.assigned_analyst
              ? "text-[#c3cdd4]"
              : "text-[#6d7a85]"
          }`}
        >
          {assignedAnalyst}
        </p>

        <p className="mt-1 text-[9px] uppercase tracking-[0.08em] text-[#465663]">
          {investigationCase.assigned_analyst
            ? "Investigation owner"
            : "Awaiting assignment"}
        </p>
      </div>

      <div>
        <p className="text-[10px] font-medium text-[#8896a1]">
          {formatCompactCaseTime(
            investigationCase.created_at
          )}
        </p>

        <p className="mt-1 text-[9px] text-[#52616d]">
          Opened
        </p>
      </div>

      <div>
        <p className="text-[10px] font-medium text-[#8896a1]">
          {formatCompactCaseTime(
            investigationCase.updated_at
          )}
        </p>

        <p className="mt-1 text-[9px] text-[#52616d]">
          Last activity
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
  const normalized =
    priority.toLowerCase();

  const styles: Record<
    string,
    string
  > = {
    low:
      "border-[#5f94c7]/30 bg-[#5f94c7]/[0.08] text-[#83b4e2]",

    medium:
      "border-[#c9a965]/30 bg-[#c9a965]/[0.08] text-[#ddc27c]",

    high:
      "border-[#d78247]/35 bg-[#d78247]/[0.09] text-[#e7a16f]",

    critical:
      "border-[#d26464]/35 bg-[#d26464]/[0.09] text-[#ef8c8c]",
  };

  const dotStyles: Record<
    string,
    string
  > = {
    low:
      "bg-[#78add8]",

    medium:
      "bg-[#d6b45f]",

    high:
      "bg-[#df925c]",

    critical:
      "bg-[#df7474]",
  };

  return (
    <span
      className={`inline-flex w-fit items-center gap-2 rounded-[6px] border px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.05em] ${
        styles[normalized] ??
        "border-[#33414c] bg-[#18222c] text-[#9aa6af]"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          dotStyles[
            normalized
          ] ??
          "bg-[#8d99a3]"
        }`}
      />

      {priority}
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
      "border-[#5f94c7]/30 bg-[#5f94c7]/[0.08] text-[#83b4e2]",

    investigating:
      "border-[#c9a965]/30 bg-[#c9a965]/[0.08] text-[#ddc27c]",

    resolved:
      "border-[#63cfa4]/30 bg-[#63cfa4]/[0.08] text-[#83dbb8]",

    closed:
      "border-[#33414c] bg-[#151d25] text-[#87949e]",
  };

  return (
    <span
      className={`inline-flex w-fit rounded-[6px] border px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.05em] ${
        styles[normalized] ??
        "border-[#33414c] bg-[#151d25] text-[#87949e]"
      }`}
    >
      {status}
    </span>
  );
}


function formatCompactCaseTime(
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