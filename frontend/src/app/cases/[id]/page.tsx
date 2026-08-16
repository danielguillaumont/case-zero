import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getCase,
  getCaseActivities,
  getCaseNotes,
} from "@/lib/api";

import type {
  CaseActivity,
  CaseAlert,
  CaseNote,
} from "@/lib/api";

import {
  addCaseNote,
  updateCaseStatus,
} from "./actions";


export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const investigationCase = await getCase(id);

  if (!investigationCase) {
    notFound();
  }

  const [
    caseNotes,
    caseActivities,
  ] = await Promise.all([
    getCaseNotes(id),
    getCaseActivities(id),
  ]);

  const normalizedStatus =
    investigationCase.status.toLowerCase();

  const startInvestigationAction =
    updateCaseStatus.bind(
      null,
      investigationCase.id,
      "investigating"
    );

  const resolveCaseAction =
    updateCaseStatus.bind(
      null,
      investigationCase.id,
      "resolved"
    );

  const addNoteAction =
    addCaseNote.bind(
      null,
      investigationCase.id
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

          {/* Back Link */}
          <div className="mb-8">
            <Link
              href="/cases"
              className="text-sm text-zinc-500 transition hover:text-zinc-200"
            >
              ← Back to Cases
            </Link>
          </div>

          {/* Header */}
          <header className="mb-8 flex items-start justify-between gap-6">
            <div>
              <p className="text-sm text-emerald-400">
                CASE//ZERO / CASE
              </p>

              <h2 className="mt-2 text-3xl font-semibold">
                {investigationCase.title}
              </h2>

              <p className="mt-3 text-sm text-zinc-500">
                Security investigation and linked alert activity.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <PriorityBadge
                priority={investigationCase.priority}
              />

              <CaseStatusBadge
                status={investigationCase.status}
              />
            </div>
          </header>

          {/* Main Grid */}
          <div className="grid grid-cols-3 gap-6">

            {/* Case Details */}
            <section className="col-span-2 rounded-xl border border-zinc-800 bg-zinc-900">
              <div className="border-b border-zinc-800 p-6">
                <h3 className="font-medium">
                  Case Details
                </h3>

                <p className="mt-1 text-sm text-zinc-500">
                  Investigation information associated with this case.
                </p>
              </div>

              <div className="p-6">

                <DetailField
                  label="Description"
                  value={
                    investigationCase.description ??
                    "No case description provided."
                  }
                  large
                />

                <div className="mt-8 grid grid-cols-2 gap-8">

                  <DetailField
                    label="Priority"
                    value={
                      investigationCase.priority.toUpperCase()
                    }
                  />

                  <DetailField
                    label="Status"
                    value={
                      investigationCase.status.toUpperCase()
                    }
                  />

                  <DetailField
                    label="Assigned Analyst"
                    value={
                      investigationCase.assigned_analyst ??
                      "Unassigned"
                    }
                  />

                  <DetailField
                    label="Linked Alerts"
                    value={String(
                      investigationCase.alerts.length
                    )}
                  />

                  <DetailField
                    label="Created"
                    value={formatCaseTime(
                      investigationCase.created_at
                    )}
                  />

                  <DetailField
                    label="Last Updated"
                    value={formatCaseTime(
                      investigationCase.updated_at
                    )}
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
                  Current case workflow
                </p>
              </div>

              <div className="space-y-6 p-6">

                {/* Current Status */}
                <div>
                  <p className="text-xs uppercase tracking-wider text-zinc-500">
                    Current Status
                  </p>

                  <div className="mt-3">
                    <CaseStatusBadge
                      status={
                        investigationCase.status
                      }
                    />
                  </div>
                </div>

                {/* Case Action */}
                <div className="border-t border-zinc-800 pt-6">
                  <p className="text-xs uppercase tracking-wider text-zinc-500">
                    Analyst Action
                  </p>

                  {normalizedStatus === "open" && (
                    <form
                      action={
                        startInvestigationAction
                      }
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

                  {normalizedStatus ===
                    "investigating" && (
                    <form
                      action={
                        resolveCaseAction
                      }
                      className="mt-3"
                    >
                      <button
                        type="submit"
                        className="w-full rounded-lg border border-emerald-800 bg-emerald-950 px-4 py-3 text-sm font-medium text-emerald-400 transition hover:bg-emerald-900"
                      >
                        Resolve Case
                      </button>
                    </form>
                  )}

                  {normalizedStatus ===
                    "resolved" && (
                    <div className="mt-3 rounded-lg border border-emerald-900 bg-emerald-950/40 px-4 py-3">
                      <p className="text-sm text-emerald-400">
                        Investigation resolved
                      </p>
                    </div>
                  )}

                  {normalizedStatus ===
                    "closed" && (
                    <div className="mt-3 rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3">
                      <p className="text-sm text-zinc-400">
                        Case closed
                      </p>
                    </div>
                  )}
                </div>

                {/* Assigned Analyst */}
                <div className="border-t border-zinc-800 pt-6">
                  <p className="text-xs uppercase tracking-wider text-zinc-500">
                    Assigned Analyst
                  </p>

                  <p className="mt-2 text-sm font-medium text-zinc-200">
                    {
                      investigationCase.assigned_analyst ??
                      "Unassigned"
                    }
                  </p>

                  {investigationCase.assigned_analyst ===
                    "Daniel Guillaumont" && (
                    <p className="mt-1 text-xs text-emerald-400">
                      Assigned to you
                    </p>
                  )}
                </div>

                {/* Priority */}
                <div className="border-t border-zinc-800 pt-6">
                  <p className="text-xs uppercase tracking-wider text-zinc-500">
                    Priority
                  </p>

                  <div className="mt-3">
                    <PriorityBadge
                      priority={
                        investigationCase.priority
                      }
                    />
                  </div>
                </div>

                {/* Alert Count */}
                <div className="border-t border-zinc-800 pt-6">
                  <p className="text-xs uppercase tracking-wider text-zinc-500">
                    Alert Count
                  </p>

                  <p className="mt-2 text-2xl font-semibold text-zinc-200">
                    {
                      investigationCase.alerts
                        .length
                    }
                  </p>
                </div>

                {/* Note Count */}
                <div className="border-t border-zinc-800 pt-6">
                  <p className="text-xs uppercase tracking-wider text-zinc-500">
                    Investigation Notes
                  </p>

                  <p className="mt-2 text-2xl font-semibold text-zinc-200">
                    {caseNotes.length}
                  </p>
                </div>

                {/* Activity Count */}
                <div className="border-t border-zinc-800 pt-6">
                  <p className="text-xs uppercase tracking-wider text-zinc-500">
                    Activity Events
                  </p>

                  <p className="mt-2 text-2xl font-semibold text-zinc-200">
                    {caseActivities.length}
                  </p>
                </div>

              </div>
            </section>
          </div>

          {/* Linked Alerts */}
          <section className="mt-6 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">

            <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-5">
              <div>
                <h3 className="font-medium">
                  Linked Alerts
                </h3>

                <p className="mt-1 text-sm text-zinc-500">
                  Security alerts associated with this investigation.
                </p>
              </div>

              <p className="text-xs text-zinc-500">
                {
                  investigationCase.alerts
                    .length
                }{" "}
                total
              </p>
            </div>

            {investigationCase.alerts
              .length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-sm text-zinc-400">
                  No alerts are linked to this case.
                </p>
              </div>
            ) : (
              <div>

                {/* Table Header */}
                <div className="grid grid-cols-[120px_1fr_160px_160px_190px] gap-4 border-b border-zinc-800 px-6 py-3 text-xs uppercase tracking-wider text-zinc-600">

                  <div>
                    Severity
                  </div>

                  <div>
                    Alert
                  </div>

                  <div>
                    Source
                  </div>

                  <div>
                    Status
                  </div>

                  <div>
                    Created
                  </div>

                </div>

                {/* Alert Rows */}
                <div className="divide-y divide-zinc-800">
                  {investigationCase.alerts.map(
                    (alert) => (
                      <LinkedAlertRow
                        key={alert.id}
                        alert={alert}
                      />
                    )
                  )}
                </div>

              </div>
            )}

          </section>

          {/* Case Activity Timeline */}
          <section className="mt-6 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">

            <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-5">
              <div>
                <h3 className="font-medium">
                  Case Activity
                </h3>

                <p className="mt-1 text-sm text-zinc-500">
                  System-recorded investigation events and analyst actions.
                </p>
              </div>

              <p className="text-xs text-zinc-500">
                {caseActivities.length}{" "}
                {caseActivities.length === 1
                  ? "event"
                  : "events"}
              </p>
            </div>

            {caseActivities.length === 0 ? (
              <div className="px-6 py-14 text-center">

                <div className="mx-auto h-3 w-3 rounded-full border border-zinc-700 bg-zinc-800" />

                <p className="mt-4 text-sm font-medium text-zinc-300">
                  No activity recorded yet
                </p>

                <p className="mt-2 text-sm text-zinc-500">
                  New case actions will automatically appear in this timeline.
                </p>

              </div>
            ) : (
              <div className="px-6 py-2">
                {caseActivities.map(
                  (activity, index) => (
                    <CaseActivityRow
                      key={activity.id}
                      activity={activity}
                      isLast={
                        index ===
                        caseActivities.length - 1
                      }
                    />
                  )
                )}
              </div>
            )}

          </section>

          {/* Investigation Notes */}
          <section className="mt-6 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">

            <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-5">
              <div>
                <h3 className="font-medium">
                  Investigation Notes
                </h3>

                <p className="mt-1 text-sm text-zinc-500">
                  Analyst findings, observations, and investigation updates.
                </p>
              </div>

              <p className="text-xs text-zinc-500">
                {caseNotes.length}{" "}
                {caseNotes.length === 1
                  ? "note"
                  : "notes"}
              </p>
            </div>

            <div className="grid grid-cols-[1fr_360px]">

              {/* Existing Notes */}
              <div className="border-r border-zinc-800">

                {caseNotes.length === 0 ? (
                  <div className="px-6 py-16 text-center">

                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950 text-zinc-600">
                      +
                    </div>

                    <p className="mt-4 text-sm font-medium text-zinc-300">
                      No investigation notes yet
                    </p>

                    <p className="mt-2 text-sm text-zinc-500">
                      Add the first analyst note to document this investigation.
                    </p>

                  </div>
                ) : (
                  <div className="divide-y divide-zinc-800">
                    {caseNotes.map(
                      (note) => (
                        <CaseNoteRow
                          key={note.id}
                          note={note}
                        />
                      )
                    )}
                  </div>
                )}

              </div>

              {/* Add Note Form */}
              <div className="bg-zinc-950/30 p-6">

                <p className="text-xs uppercase tracking-wider text-zinc-500">
                  Add Investigation Note
                </p>

                <p className="mt-2 text-xs leading-5 text-zinc-600">
                  Document findings, analyst actions, evidence review, or other investigation context.
                </p>

                <form
                  action={addNoteAction}
                  className="mt-5"
                >
                  <textarea
                    name="content"
                    required
                    minLength={1}
                    maxLength={5000}
                    rows={8}
                    placeholder="Enter investigation findings..."
                    className="w-full resize-y rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm leading-6 text-zinc-200 outline-none transition placeholder:text-zinc-600 focus:border-emerald-700"
                  />

                  <p className="mt-2 text-xs text-zinc-600">
                    Maximum 5,000 characters
                  </p>

                  <button
                    type="submit"
                    className="mt-4 w-full rounded-lg border border-emerald-800 bg-emerald-950 px-4 py-3 text-sm font-medium text-emerald-400 transition hover:bg-emerald-900"
                  >
                    Add Investigation Note
                  </button>
                </form>

              </div>

            </div>

          </section>

          {/* Technical Metadata */}
          <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h3 className="font-medium">
              Technical Metadata
            </h3>

            <p className="mt-1 text-sm text-zinc-500">
              Internal CASE//ZERO case identifiers.
            </p>

            <div className="mt-6">
              <p className="text-xs uppercase tracking-wider text-zinc-500">
                Case ID
              </p>

              <code className="mt-2 block rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-400">
                {investigationCase.id}
              </code>
            </div>
          </section>

        </main>
      </div>
    </div>
  );
}


function CaseActivityRow({
  activity,
  isLast,
}: {
  activity: CaseActivity;
  isLast: boolean;
}) {
  const presentation =
    getActivityPresentation(
      activity.event_type
    );

  return (
    <article className="relative flex gap-5">

      {/* Timeline rail */}
      <div className="relative flex w-10 shrink-0 justify-center">

        {!isLast && (
          <div className="absolute bottom-0 top-8 w-px bg-zinc-800" />
        )}

        <div
          className={`relative z-10 mt-6 h-3.5 w-3.5 rounded-full border ${
            presentation.dotStyle
          }`}
        />

      </div>

      {/* Activity Content */}
      <div
        className={`min-w-0 flex-1 py-5 ${
          !isLast
            ? "border-b border-zinc-800"
            : ""
        }`}
      >
        <div className="flex items-start justify-between gap-6">

          <div className="min-w-0">

            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`rounded-md border px-2.5 py-1 text-xs font-medium uppercase ${
                  presentation.badgeStyle
                }`}
              >
                {presentation.label}
              </span>

              {activity.actor && (
                <span className="text-xs text-zinc-500">
                  by {activity.actor}
                </span>
              )}
            </div>

            <p className="mt-3 text-sm leading-6 text-zinc-300">
              {activity.message}
            </p>

          </div>

          <time
            dateTime={activity.created_at}
            className="shrink-0 text-xs text-zinc-600"
          >
            {formatCaseTime(
              activity.created_at
            )}
          </time>

        </div>
      </div>

    </article>
  );
}


function CaseNoteRow({
  note,
}: {
  note: CaseNote;
}) {
  return (
    <article className="px-6 py-6">

      <div className="flex items-start gap-4">

        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-emerald-900 bg-emerald-950 text-xs font-semibold text-emerald-400">
          {getInitials(note.author)}
        </div>

        <div className="min-w-0 flex-1">

          <div className="flex items-center justify-between gap-4">

            <div>
              <p className="text-sm font-medium text-zinc-200">
                {note.author}
              </p>

              <p className="mt-1 text-xs text-zinc-600">
                Investigation note
              </p>
            </div>

            <time
              dateTime={note.created_at}
              className="shrink-0 text-xs text-zinc-600"
            >
              {formatCaseTime(
                note.created_at
              )}
            </time>

          </div>

          <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-zinc-300">
            {note.content}
          </p>

        </div>

      </div>

    </article>
  );
}


function LinkedAlertRow({
  alert,
}: {
  alert: CaseAlert;
}) {
  return (
    <Link
      href={`/alerts/${alert.id}`}
      className="grid grid-cols-[120px_1fr_160px_160px_190px] items-center gap-4 px-6 py-5 transition hover:bg-zinc-800/40"
    >

      <div>
        <SeverityBadge
          severity={alert.severity}
        />
      </div>

      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-zinc-200">
          {alert.title}
        </p>

        <p className="mt-1 truncate text-xs text-zinc-500">
          {alert.description ??
            "No alert description provided."}
        </p>
      </div>

      <div>
        <p className="truncate text-sm text-zinc-400">
          {alert.source}
        </p>
      </div>

      <div>
        <AlertStatusBadge
          status={alert.status}
        />
      </div>

      <div>
        <p className="text-sm text-zinc-500">
          {formatCaseTime(
            alert.created_at
          )}
        </p>
      </div>

    </Link>
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
          large
            ? "text-sm leading-7"
            : "text-sm"
        }`}
      >
        {value}
      </p>
    </div>
  );
}


function PriorityBadge({
  priority,
}: {
  priority: string;
}) {
  const normalizedPriority =
    priority.toLowerCase();

  const styles: Record<
    string,
    string
  > = {
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
        styles[
          normalizedPriority
        ] ??
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

  const styles: Record<
    string,
    string
  > = {
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
        styles[
          normalizedStatus
        ] ??
        "border-zinc-700 bg-zinc-800 text-zinc-400"
      }`}
    >
      {status}
    </span>
  );
}


function SeverityBadge({
  severity,
}: {
  severity: string;
}) {
  const normalizedSeverity =
    severity.toLowerCase();

  const styles: Record<
    string,
    string
  > = {
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
        styles[
          normalizedSeverity
        ] ??
        "border-zinc-700 bg-zinc-800 text-zinc-400"
      }`}
    >
      {severity}
    </span>
  );
}


function AlertStatusBadge({
  status,
}: {
  status: string;
}) {
  const normalizedStatus =
    status.toLowerCase();

  const styles: Record<
    string,
    string
  > = {
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
      className={`inline-flex rounded-md border px-3 py-1.5 text-xs font-medium uppercase ${
        styles[
          normalizedStatus
        ] ??
        "border-zinc-700 bg-zinc-800 text-zinc-400"
      }`}
    >
      {status}
    </span>
  );
}


function getActivityPresentation(
  eventType: string
) {
  const presentations: Record<
    string,
    {
      label: string;
      badgeStyle: string;
      dotStyle: string;
    }
  > = {
    case_created: {
      label: "Case Created",
      badgeStyle:
        "border-blue-900 bg-blue-950 text-blue-400",
      dotStyle:
        "border-blue-700 bg-blue-500",
    },

    alert_linked: {
      label: "Alert Linked",
      badgeStyle:
        "border-orange-900 bg-orange-950 text-orange-400",
      dotStyle:
        "border-orange-700 bg-orange-500",
    },

    note_added: {
      label: "Note Added",
      badgeStyle:
        "border-emerald-900 bg-emerald-950 text-emerald-400",
      dotStyle:
        "border-emerald-700 bg-emerald-500",
    },

    status_changed: {
      label: "Status Changed",
      badgeStyle:
        "border-yellow-900 bg-yellow-950 text-yellow-400",
      dotStyle:
        "border-yellow-700 bg-yellow-500",
    },
  };

  return (
    presentations[eventType] ?? {
      label: eventType
        .replaceAll("_", " "),
      badgeStyle:
        "border-zinc-700 bg-zinc-800 text-zinc-400",
      dotStyle:
        "border-zinc-600 bg-zinc-500",
    }
  );
}


function getInitials(
  name: string
) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return "?";
  }

  if (parts.length === 1) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return `${parts[0][0]}${
    parts[parts.length - 1][0]
  }`.toUpperCase();
}


function formatCaseTime(
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