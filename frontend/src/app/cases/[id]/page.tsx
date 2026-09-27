import Link from "next/link";

import {
  notFound,
} from "next/navigation";

import Sidebar from "@/components/Sidebar";

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
  assignCaseToMe,
  updateCaseStatus,
} from "./actions";


export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const { id } = await params;

  const investigationCase =
    await getCase(id);

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

  const closeCaseAction =
    updateCaseStatus.bind(
      null,
      investigationCase.id,
      "closed"
    );

  const reopenCaseAction =
    updateCaseStatus.bind(
      null,
      investigationCase.id,
      "investigating"
    );

  const assignToMeAction =
    assignCaseToMe.bind(
      null,
      investigationCase.id
    );

  const addNoteAction =
    addCaseNote.bind(
      null,
      investigationCase.id
    );

  const assignedAnalyst =
    investigationCase.assigned_analyst ??
    "Unassigned";

  return (
    <div className="min-h-screen text-[#eef3f6]">
      <div className="flex min-h-screen">
        <Sidebar />

        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-[1700px] px-8 py-8 xl:px-10 xl:py-10">

            {/* Breadcrumb */}
            <div className="mb-5 flex items-center gap-2 text-[10px]">
              <Link
                href="/cases"
                className="font-medium text-[#d9e0e5] transition hover:text-white"
              >
                Investigation Cases
              </Link>

              <span className="text-[#42515d]">
                /
              </span>

              <span className="text-[#647481]">
                Case Workspace
              </span>
            </div>

            {/* Header */}
            <header className="flex items-start justify-between gap-8">
              <div className="min-w-0">
                <div className="mb-3 flex items-center gap-3">
                  <span className="text-[12px] font-semibold text-[#c9a965]">
                    Security Operations
                  </span>

                  <span className="h-px w-8 bg-[#c9a965]/40" />

                  <span className="text-[11px] text-[#667583]">
                    Investigation Workspace
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="max-w-4xl text-[34px] font-semibold tracking-[-0.04em] text-[#f4f6f8]">
                    {
                      investigationCase.title
                    }
                  </h2>

                  <PriorityBadge
                    priority={
                      investigationCase.priority
                    }
                  />

                  <CaseStatusBadge
                    status={
                      investigationCase.status
                    }
                  />
                </div>

                <p className="mt-3 max-w-3xl text-[13px] leading-6 text-[#81909c]">
                  Review investigation context, linked detections,
                  analyst activity, ownership, and response progress
                  for this security case.
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <div className="rounded-[10px] border border-[#1d2a34] bg-[#0a121a]/85 px-4 py-3">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#60707d]">
                    Owner
                  </p>

                  <p className="mt-1 max-w-[150px] truncate text-[11px] font-medium text-[#d5dde3]">
                    {assignedAnalyst}
                  </p>
                </div>

                <div className="rounded-[10px] border border-[#69c5d7]/20 bg-[#69c5d7]/[0.045] px-4 py-3">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#66818a]">
                    Linked alerts
                  </p>

                  <div className="mt-1 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#69c5d7]" />

                    <p className="text-[11px] font-medium text-[#90d4df]">
                      {
                        investigationCase
                          .alerts.length
                      } detected
                    </p>
                  </div>
                </div>
              </div>
            </header>

            <div className="my-7 h-px bg-gradient-to-r from-[#c9a965]/55 via-[#24323d] to-transparent" />

            {/* Snapshot */}
            <section>
              <div className="mb-3 flex items-end justify-between">
                <div>
                  <h3 className="text-[14px] font-medium text-[#dce3e8]">
                    Investigation snapshot
                  </h3>

                  <p className="mt-1 text-[11px] text-[#657481]">
                    Current case state and operational ownership
                  </p>
                </div>

                <p className="text-[10px] text-[#5e6d79]">
                  Updated{" "}
                  {formatCompactCaseTime(
                    investigationCase.updated_at
                  )}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                <SnapshotCard
                  label="Priority"
                  value={
                    investigationCase.priority.toUpperCase()
                  }
                  context="Investigation priority"
                  accent={
                    getPriorityAccent(
                      investigationCase.priority
                    )
                  }
                />

                <SnapshotCard
                  label="Workflow"
                  value={
                    formatLabel(
                      investigationCase.status
                    )
                  }
                  context="Current case state"
                  accent="#c9a965"
                />

                <SnapshotCard
                  label="Analyst"
                  value={assignedAnalyst}
                  context={
                    investigationCase.assigned_analyst
                      ? "Investigation owner"
                      : "Awaiting analyst assignment"
                  }
                  accent="#69c5d7"
                  compact
                />

                <SnapshotCard
                  label="Linked alerts"
                  value={String(
                    investigationCase
                      .alerts.length
                  )}
                  context="Detection records attached"
                  accent="#63cfa4"
                />
              </div>
            </section>

            {/* Main investigation grid */}
            <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.8fr)_420px]">

              {/* Investigation context */}
              <div className="overflow-hidden rounded-[14px] border border-[#1b2a35] bg-[#0b141d]/95 shadow-[0_18px_55px_rgba(0,0,0,0.18)]">
                <PanelHeader
                  title="Investigation context"
                  subtitle="Case record, evidence summary, and investigation metadata"
                  accent="#69c5d7"
                  badge="CASE RECORD"
                />

                <div className="p-6">
                  <div className="rounded-[10px] border border-[#1a2934] bg-[#08111a] p-5">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.09em] text-[#61727f]">
                      Investigation summary
                    </p>

                    <p className="mt-3 text-[13px] leading-7 text-[#c5d0d7]">
                      {
                        investigationCase.description ??
                        "No case description has been provided for this investigation."
                      }
                    </p>
                  </div>

                  <div className="mt-5 grid grid-cols-2 overflow-hidden rounded-[10px] border border-[#1a2934]">
                    <DetailCell
                      label="Case status"
                      value={
                        formatLabel(
                          investigationCase.status
                        )
                      }
                    />

                    <DetailCell
                      label="Priority"
                      value={
                        investigationCase.priority.toUpperCase()
                      }
                      borderLeft
                    />

                    <DetailCell
                      label="Assigned analyst"
                      value={assignedAnalyst}
                      borderTop
                    />

                    <DetailCell
                      label="Linked alerts"
                      value={String(
                        investigationCase
                          .alerts.length
                      )}
                      borderLeft
                      borderTop
                    />

                    <DetailCell
                      label="Created"
                      value={
                        formatCaseTime(
                          investigationCase.created_at
                        )
                      }
                      borderTop
                    />

                    <DetailCell
                      label="Last updated"
                      value={
                        formatCaseTime(
                          investigationCase.updated_at
                        )
                      }
                      borderLeft
                      borderTop
                    />
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-[9px] border border-[#1a2934] bg-[#08111a] px-4 py-4">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#52616d]">
                        Investigation notes
                      </p>

                      <p className="mt-2 text-[24px] font-semibold tracking-[-0.04em] text-[#e7edf1]">
                        {caseNotes.length}
                      </p>
                    </div>

                    <div className="rounded-[9px] border border-[#1a2934] bg-[#08111a] px-4 py-4">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#52616d]">
                        Activity events
                      </p>

                      <p className="mt-2 text-[24px] font-semibold tracking-[-0.04em] text-[#e7edf1]">
                        {
                          caseActivities.length
                        }
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Workflow */}
              <div className="overflow-hidden rounded-[14px] border border-[#1b2a35] bg-[#0b141d]/95 shadow-[0_18px_55px_rgba(0,0,0,0.18)]">
                <PanelHeader
                  title="Analyst workflow"
                  subtitle="Investigation controls and ownership"
                  accent="#c9a965"
                  badge={
                    investigationCase.status.toUpperCase()
                  }
                />

                <div>
                  <div className="border-b border-[#1a2934] p-5">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.09em] text-[#61727f]">
                      Workflow state
                    </p>

                    <div className="mt-3 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-[13px] font-semibold text-[#dfe6ea]">
                          {formatLabel(
                            investigationCase.status
                          )}
                        </p>

                        <p className="mt-1 text-[10px] text-[#60707d]">
                          Current triage stage
                        </p>
                      </div>

                      <CaseStatusBadge
                        status={
                          investigationCase.status
                        }
                      />
                    </div>

                    <div className="mt-4">
                      <WorkflowAction
                        normalizedStatus={
                          normalizedStatus
                        }
                        startInvestigationAction={
                          startInvestigationAction
                        }
                        resolveCaseAction={
                          resolveCaseAction
                        }
                        closeCaseAction={
                          closeCaseAction
                        }
                        reopenCaseAction={
                          reopenCaseAction
                        }
                      />
                    </div>
                  </div>

                  <div className="border-b border-[#1a2934] p-5">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.09em] text-[#61727f]">
                      Analyst ownership
                    </p>

                    {investigationCase.assigned_analyst ? (
                      <div className="mt-4 flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#69c5d7]/25 bg-[#69c5d7]/[0.06] text-[10px] font-semibold text-[#93dae5]">
                          {getInitials(
                            investigationCase.assigned_analyst
                          )}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-[12px] font-semibold text-[#dce4e9]">
                            {
                              investigationCase.assigned_analyst
                            }
                          </p>

                          <p className="mt-1 text-[9px] text-[#60707d]">
                            Investigation owner
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4">
                        <p className="text-[11px] text-[#73818d]">
                          No analyst currently owns this investigation.
                        </p>

                        <form
                          action={
                            assignToMeAction
                          }
                          className="mt-4"
                        >
                          <button
                            type="submit"
                            className="w-full rounded-[8px] border border-[#69c5d7]/25 bg-[#69c5d7]/[0.06] px-4 py-3 text-[11px] font-semibold text-[#91dbe4] transition hover:border-[#69c5d7]/40 hover:bg-[#69c5d7]/[0.1]"
                          >
                            Assign investigation to me
                          </button>
                        </form>
                      </div>
                    )}
                  </div>

                  <div className="p-5">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.09em] text-[#61727f]">
                      Investigation record
                    </p>

                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <MiniStat
                        label="Alerts"
                        value={String(
                          investigationCase
                            .alerts.length
                        )}
                      />

                      <MiniStat
                        label="Notes"
                        value={String(
                          caseNotes.length
                        )}
                      />

                      <MiniStat
                        label="Events"
                        value={String(
                          caseActivities.length
                        )}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Linked alerts */}
            <section className="mt-5 overflow-hidden rounded-[14px] border border-[#1b2a35] bg-[#0b141d]/95 shadow-[0_18px_55px_rgba(0,0,0,0.18)]">
              <PanelHeader
                title="Linked detections"
                subtitle="Security alerts associated with this investigation"
                accent="#d7b85f"
                badge={`${investigationCase.alerts.length} LINKED`}
              />

              {investigationCase.alerts.length ===
              0 ? (
                <div className="px-6 py-16 text-center">
                  <p className="text-[12px] font-medium text-[#b8c3cb]">
                    No detections linked
                  </p>

                  <p className="mt-2 text-[10px] text-[#60707d]">
                    Alerts associated with this investigation will appear here.
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-[105px_minmax(0,1fr)_170px_130px_160px] gap-5 border-b border-[#1a2934] bg-[#08111a] px-6 py-3">
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
                      Created
                    </span>
                  </div>

                  <div className="divide-y divide-[#1a2833]">
                    {investigationCase.alerts.map(
                      (alert) => (
                        <LinkedAlertRow
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
                </>
              )}
            </section>

            {/* Activity + notes */}
            <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(380px,0.85fr)]">

              <div className="overflow-hidden rounded-[14px] border border-[#1b2a35] bg-[#0b141d]/95 shadow-[0_18px_55px_rgba(0,0,0,0.18)]">
                <PanelHeader
                  title="Investigation activity"
                  subtitle="System-recorded case events and analyst actions"
                  accent="#69c5d7"
                  badge={`${caseActivities.length} EVENTS`}
                />

                {caseActivities.length ===
                0 ? (
                  <div className="px-6 py-16 text-center">
                    <p className="text-[12px] font-medium text-[#b8c3cb]">
                      No activity recorded
                    </p>

                    <p className="mt-2 text-[10px] text-[#60707d]">
                      Case actions will automatically populate this timeline.
                    </p>
                  </div>
                ) : (
                  <div className="px-6 py-2">
                    {caseActivities.map(
                      (
                        activity,
                        index
                      ) => (
                        <CaseActivityRow
                          key={
                            activity.id
                          }
                          activity={
                            activity
                          }
                          isLast={
                            index
                            === caseActivities.length -
                              1
                          }
                        />
                      )
                    )}
                  </div>
                )}
              </div>

              <div className="overflow-hidden rounded-[14px] border border-[#1b2a35] bg-[#0b141d]/95 shadow-[0_18px_55px_rgba(0,0,0,0.18)]">
                <PanelHeader
                  title="Analyst notes"
                  subtitle="Investigation findings and analyst observations"
                  accent="#63cfa4"
                  badge={`${caseNotes.length} NOTES`}
                />

                <div className="max-h-[430px] overflow-y-auto">
                  {caseNotes.length === 0 ? (
                    <div className="px-6 py-12 text-center">
                      <p className="text-[12px] font-medium text-[#b8c3cb]">
                        No investigation notes
                      </p>

                      <p className="mt-2 text-[10px] text-[#60707d]">
                        Add the first analyst note below.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-[#1a2833]">
                      {caseNotes.map(
                        (note) => (
                          <CaseNoteRow
                            key={
                              note.id
                            }
                            note={
                              note
                            }
                          />
                        )
                      )}
                    </div>
                  )}
                </div>

                <div className="border-t border-[#1a2934] bg-[#08111a] p-5">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.09em] text-[#61727f]">
                    Add investigation note
                  </p>

                  <p className="mt-2 text-[10px] leading-5 text-[#60707d]">
                    Record evidence review, analyst findings, response actions,
                    or other investigation context.
                  </p>

                  <form
                    action={
                      addNoteAction
                    }
                    className="mt-4"
                  >
                    <textarea
                      name="content"
                      required
                      minLength={1}
                      maxLength={5000}
                      rows={6}
                      placeholder="Document investigation findings..."
                      className="w-full resize-y rounded-[9px] border border-[#1c2b36] bg-[#060d14] px-4 py-3 text-[12px] leading-6 text-[#d4dde3] outline-none transition placeholder:text-[#4f5f6c] focus:border-[#69c5d7]/45"
                    />

                    <div className="mt-3 flex items-center justify-between gap-4">
                      <p className="text-[9px] text-[#53626e]">
                        Maximum 5,000 characters
                      </p>

                      <button
                        type="submit"
                        className="rounded-[8px] border border-[#63cfa4]/30 bg-[#63cfa4]/[0.07] px-4 py-2.5 text-[10px] font-semibold text-[#84d8b7] transition hover:border-[#63cfa4]/50 hover:bg-[#63cfa4]/[0.11]"
                      >
                        Add note
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </section>

            {/* Metadata */}
            <section className="mt-5 rounded-[12px] border border-[#182630] bg-[#081019]/80 px-5 py-4">
              <div className="flex items-center justify-between gap-6">
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.09em] text-[#52616d]">
                    Case identifier
                  </p>

                  <code className="mt-1 block break-all text-[10px] text-[#71818d]">
                    {
                      investigationCase.id
                    }
                  </code>
                </div>

                <Link
                  href="/cases"
                  className="shrink-0 text-[10px] font-medium text-[#87949e] transition hover:text-[#d4dce2]"
                >
                  Return to investigation queue →
                </Link>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}


function SnapshotCard({
  label,
  value,
  context,
  accent,
  compact = false,
}: {
  label: string;
  value: string;
  context: string;
  accent: string;
  compact?: boolean;
}) {
  return (
    <div className="relative min-h-[132px] overflow-hidden rounded-[12px] border border-[#1b2a35] bg-[#0d1822]/95 p-5 shadow-[0_16px_45px_rgba(0,0,0,0.14)]">
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background:
            `linear-gradient(90deg, ${accent}, transparent 70%)`,
        }}
      />

      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium text-[#8996a1]">
          {label}
        </p>

        <span
          className="h-1.5 w-6 rounded-full"
          style={{
            background:
              accent,
            opacity:
              0.72,
          }}
        />
      </div>

      <p
        className={`mt-4 font-semibold leading-tight tracking-[-0.04em] text-[#f1f4f6] ${
          compact
            ? "truncate text-[22px]"
            : "text-[24px]"
        }`}
      >
        {value}
      </p>

      <p className="mt-3 truncate text-[10px] text-[#60707d]">
        {context}
      </p>
    </div>
  );
}


function PanelHeader({
  title,
  subtitle,
  accent,
  badge,
}: {
  title: string;
  subtitle: string;
  accent: string;
  badge?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-5 border-b border-[#1a2934] bg-[#0e1822]/75 px-6 py-5">
      <div className="flex items-center gap-3">
        <span
          className="h-2 w-2 rounded-full"
          style={{
            background:
              accent,
          }}
        />

        <div>
          <h3 className="text-[14px] font-semibold text-[#e3e9ed]">
            {title}
          </h3>

          <p className="mt-1 text-[10px] text-[#647481]">
            {subtitle}
          </p>
        </div>
      </div>

      {badge && (
        <span className="rounded-[6px] border border-[#263640] bg-[#0a131b] px-2.5 py-1.5 text-[8px] font-semibold tracking-[0.07em] text-[#71818d]">
          {badge}
        </span>
      )}
    </div>
  );
}


function DetailCell({
  label,
  value,
  borderLeft = false,
  borderTop = false,
}: {
  label: string;
  value: string;
  borderLeft?: boolean;
  borderTop?: boolean;
}) {
  return (
    <div
      className={`px-5 py-5 ${
        borderLeft
          ? "border-l border-[#1a2934]"
          : ""
      } ${
        borderTop
          ? "border-t border-[#1a2934]"
          : ""
      }`}
    >
      <p className="text-[8px] font-semibold uppercase tracking-[0.09em] text-[#53636f]">
        {label}
      </p>

      <p className="mt-2 break-words text-[11px] font-medium leading-5 text-[#c6d0d7]">
        {value}
      </p>
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
    <div className="rounded-[8px] border border-[#1a2934] bg-[#08111a] px-3 py-3">
      <p className="text-[8px] uppercase tracking-[0.08em] text-[#52616d]">
        {label}
      </p>

      <p className="mt-2 text-[18px] font-semibold text-[#e4eaee]">
        {value}
      </p>
    </div>
  );
}


type FormAction =
  (
    formData: FormData
  ) => void | Promise<void>;


function WorkflowAction({
  normalizedStatus,
  startInvestigationAction,
  resolveCaseAction,
  closeCaseAction,
  reopenCaseAction,
}: {
  normalizedStatus: string;
  startInvestigationAction: FormAction;
  resolveCaseAction: FormAction;
  closeCaseAction: FormAction;
  reopenCaseAction: FormAction;
}) {
  if (
    normalizedStatus === "open"
  ) {
    return (
      <form
        action={
          startInvestigationAction
        }
      >
        <button
          type="submit"
          className="w-full rounded-[8px] border border-[#c9a965]/30 bg-[#c9a965]/[0.07] px-4 py-3 text-[11px] font-semibold text-[#dfc47e] transition hover:border-[#c9a965]/50 hover:bg-[#c9a965]/[0.11]"
        >
          Start investigation
        </button>
      </form>
    );
  }

  if (
    normalizedStatus
    === "investigating"
  ) {
    return (
      <form
        action={
          resolveCaseAction
        }
      >
        <button
          type="submit"
          className="w-full rounded-[8px] border border-[#63cfa4]/30 bg-[#63cfa4]/[0.07] px-4 py-3 text-[11px] font-semibold text-[#84d8b7] transition hover:border-[#63cfa4]/50 hover:bg-[#63cfa4]/[0.11]"
        >
          Resolve investigation
        </button>
      </form>
    );
  }

  if (
    normalizedStatus
    === "resolved"
  ) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-[8px] border border-[#63cfa4]/20 bg-[#63cfa4]/[0.05] px-3 py-3">
          <span className="h-2 w-2 rounded-full bg-[#63cfa4]" />

          <p className="text-[10px] font-medium text-[#83d8b6]">
            Investigation resolved
          </p>
        </div>

        <form
          action={
            closeCaseAction
          }
        >
          <button
            type="submit"
            className="w-full rounded-[8px] border border-[#293844] bg-[#111b24] px-4 py-3 text-[11px] font-medium text-[#aeb9c1] transition hover:border-[#3b4b57] hover:bg-[#15212b]"
          >
            Close case
          </button>
        </form>

        <form
          action={
            reopenCaseAction
          }
        >
          <button
            type="submit"
            className="w-full rounded-[8px] border border-[#c9a965]/20 bg-[#c9a965]/[0.04] px-4 py-3 text-[11px] font-medium text-[#d8bd78] transition hover:border-[#c9a965]/40 hover:bg-[#c9a965]/[0.08]"
          >
            Reopen investigation
          </button>
        </form>
      </div>
    );
  }

  if (
    normalizedStatus
    === "closed"
  ) {
    return (
      <div className="space-y-3">
        <div className="rounded-[8px] border border-[#293844] bg-[#0a1219] px-3 py-3">
          <p className="text-[10px] text-[#7d8b96]">
            This case is currently closed.
          </p>
        </div>

        <form
          action={
            reopenCaseAction
          }
        >
          <button
            type="submit"
            className="w-full rounded-[8px] border border-[#c9a965]/25 bg-[#c9a965]/[0.05] px-4 py-3 text-[11px] font-medium text-[#d8bd78] transition hover:border-[#c9a965]/45 hover:bg-[#c9a965]/[0.09]"
          >
            Reopen investigation
          </button>
        </form>
      </div>
    );
  }

  return null;
}


function LinkedAlertRow({
  alert,
}: {
  alert: CaseAlert;
}) {
  return (
    <Link
      href={`/alerts/${alert.id}`}
      className="group grid grid-cols-[105px_minmax(0,1fr)_170px_130px_160px] items-center gap-5 px-6 py-5 transition hover:bg-[#12202b]/70"
    >
      <SeverityBadge
        severity={
          alert.severity
        }
      />

      <div className="min-w-0">
        <p className="truncate text-[12px] font-semibold text-[#dfe6ea] transition group-hover:text-white">
          {alert.title}
        </p>

        <p className="mt-1 truncate text-[9px] leading-5 text-[#60707d]">
          {alert.description ??
            "No alert description provided."}
        </p>
      </div>

      <div>
        <p className="truncate text-[10px] font-medium text-[#aeb9c1]">
          {alert.source}
        </p>

        <p className="mt-1 text-[8px] uppercase tracking-[0.08em] text-[#485966]">
          Detection source
        </p>
      </div>

      <AlertStatusBadge
        status={
          alert.status
        }
      />

      <p className="text-[9px] font-medium text-[#788792]">
        {formatCompactCaseTime(
          alert.created_at
        )}
      </p>
    </Link>
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
    <article className="relative flex gap-4">
      <div className="relative flex w-7 shrink-0 justify-center">
        {!isLast && (
          <div className="absolute bottom-0 top-8 w-px bg-[#1c2b35]" />
        )}

        <div
          className={`relative z-10 mt-6 h-2.5 w-2.5 rounded-full border ${presentation.dotStyle}`}
        />
      </div>

      <div
        className={`min-w-0 flex-1 py-5 ${
          !isLast
            ? "border-b border-[#1a2934]"
            : ""
        }`}
      >
        <div className="flex items-start justify-between gap-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-[5px] border px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.05em] ${presentation.badgeStyle}`}
              >
                {
                  presentation.label
                }
              </span>

              {activity.actor && (
                <span className="text-[9px] text-[#5f6f7b]">
                  by{" "}
                  {
                    activity.actor
                  }
                </span>
              )}
            </div>

            <p className="mt-3 text-[11px] leading-6 text-[#aebac2]">
              {
                activity.message
              }
            </p>
          </div>

          <time
            dateTime={
              activity.created_at
            }
            className="shrink-0 text-[9px] text-[#52616d]"
          >
            {formatCompactCaseTime(
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
    <article className="px-5 py-5">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#63cfa4]/20 bg-[#63cfa4]/[0.05] text-[9px] font-semibold text-[#82d8b6]">
          {getInitials(
            note.author
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold text-[#d7e0e5]">
                {note.author}
              </p>

              <p className="mt-1 text-[8px] uppercase tracking-[0.08em] text-[#52616d]">
                Analyst note
              </p>
            </div>

            <time
              dateTime={
                note.created_at
              }
              className="shrink-0 text-[8px] text-[#52616d]"
            >
              {formatCompactCaseTime(
                note.created_at
              )}
            </time>
          </div>

          <p className="mt-3 whitespace-pre-wrap text-[11px] leading-6 text-[#aebac2]">
            {note.content}
          </p>
        </div>
      </div>
    </article>
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

  return (
    <span
      className={`inline-flex rounded-[6px] border px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.05em] ${
        styles[normalized] ??
        "border-[#33414c] bg-[#18222c] text-[#9aa6af]"
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
      className={`inline-flex rounded-[6px] border px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.05em] ${
        styles[normalized] ??
        "border-[#33414c] bg-[#151d25] text-[#87949e]"
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
  const normalized =
    severity.toLowerCase();

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

  return (
    <span
      className={`inline-flex w-fit rounded-[6px] border px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.05em] ${
        styles[normalized] ??
        "border-[#33414c] bg-[#18222c] text-[#9aa6af]"
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
  const normalized =
    status.toLowerCase();

  const styles: Record<
    string,
    string
  > = {
    new:
      "border-[#36444f] bg-[#18222b] text-[#b9c3ca]",

    assigned:
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
      label:
        "Case Created",
      badgeStyle:
        "border-[#5f94c7]/25 bg-[#5f94c7]/[0.07] text-[#83b4e2]",
      dotStyle:
        "border-[#5f94c7]/60 bg-[#5f94c7]",
    },

    alert_linked: {
      label:
        "Alert Linked",
      badgeStyle:
        "border-[#9a7bd4]/25 bg-[#9a7bd4]/[0.07] text-[#b59be5]",
      dotStyle:
        "border-[#9a7bd4]/60 bg-[#9a7bd4]",
    },

    note_added: {
      label:
        "Note Added",
      badgeStyle:
        "border-[#63cfa4]/25 bg-[#63cfa4]/[0.07] text-[#83dbb8]",
      dotStyle:
        "border-[#63cfa4]/60 bg-[#63cfa4]",
    },

    status_changed: {
      label:
        "Status Changed",
      badgeStyle:
        "border-[#c9a965]/25 bg-[#c9a965]/[0.07] text-[#ddc27c]",
      dotStyle:
        "border-[#c9a965]/60 bg-[#c9a965]",
    },

    analyst_assigned: {
      label:
        "Analyst Assigned",
      badgeStyle:
        "border-[#69c5d7]/25 bg-[#69c5d7]/[0.07] text-[#91dbe4]",
      dotStyle:
        "border-[#69c5d7]/60 bg-[#69c5d7]",
    },
  };

  return (
    presentations[eventType] ?? {
      label:
        formatLabel(
          eventType
        ),

      badgeStyle:
        "border-[#33414c] bg-[#151d25] text-[#87949e]",

      dotStyle:
        "border-[#52616d] bg-[#71818d]",
    }
  );
}


function getPriorityAccent(
  priority: string
) {
  const normalized =
    priority.toLowerCase();

  if (
    normalized === "critical"
  ) {
    return "#d26464";
  }

  if (
    normalized === "high"
  ) {
    return "#d78247";
  }

  if (
    normalized === "medium"
  ) {
    return "#c9a965";
  }

  return "#5f94c7";
}


function formatLabel(
  value: string
) {
  return value
    .replaceAll("_", " ")
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase()
    );
}


function getInitials(
  name: string
) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(
        (part) =>
          part
            .charAt(0)
            .toUpperCase()
      )
      .join("");

  return initials || "?";
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