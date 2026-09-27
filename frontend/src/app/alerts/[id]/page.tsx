import Link from "next/link";

import {
  notFound,
} from "next/navigation";

import Sidebar from "@/components/Sidebar";

import {
  getAlert,
  getCase,
  getCases,
  getDetectionRule,
  getPlaybooksForRule,
  getSecurityEvent,
  getThreatIndicators,
} from "@/lib/api";

import type {
  MitreAttackMapping,
  Playbook,
  ThreatIndicator,
} from "@/lib/api";

import {
  matchThreatIndicatorsToEvent,
} from "@/lib/intelligence";

import {
  assignAlertToMe,
  createCaseFromAlert,
  linkAlertToExistingCase,
  updateAlertStatus,
} from "./actions";


export default async function AlertDetailPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const { id } =
    await params;

  const alert =
    await getAlert(id);

  if (!alert) {
    notFound();
  }

  const linkedCase =
    alert.case_id
      ? await getCase(
          alert.case_id
        )
      : null;

  const sourceEvent =
    alert.source_event_id
      ? await getSecurityEvent(
          alert.source_event_id
        )
      : null;

  const detectionRule =
    alert.detection_rule_id
      ? await getDetectionRule(
          alert.detection_rule_id
        )
      : null;

  const recommendedPlaybooks =
    alert.detection_rule_id
      ? await getPlaybooksForRule(
          alert.detection_rule_id
        )
      : [];

  const threatIndicators =
    sourceEvent
      ? await getThreatIndicators({
          limit: 500,
        })
      : [];

  const threatMatches =
    sourceEvent
      ? matchThreatIndicatorsToEvent(
          sourceEvent,
          threatIndicators
        )
      : [];

  const existingCases =
    alert.case_id
      ? []
      : await getCases();

  const linkableCases =
    existingCases.filter(
      (investigationCase) =>
        ![
          "resolved",
          "closed",
        ].includes(
          investigationCase.status.toLowerCase()
        )
    );

  const normalizedStatus =
    alert.status.toLowerCase();

  const startInvestigationAction =
    updateAlertStatus.bind(
      null,
      alert.id,
      "investigating"
    );

  const resolveAlertAction =
    updateAlertStatus.bind(
      null,
      alert.id,
      "resolved"
    );

  const assignToMeAction =
    assignAlertToMe.bind(
      null,
      alert.id
    );

  const createCaseAction =
    createCaseFromAlert.bind(
      null,
      alert.id
    );

  const linkExistingCaseAction =
    linkAlertToExistingCase.bind(
      null,
      alert.id
    );

  const attackMappings =
    detectionRule?.mitre_attack
    ?? [];

  return (
    <div className="min-h-screen text-[#f1f4f7]">

      <div className="flex min-h-screen">

        <Sidebar />

        <main className="min-w-0 flex-1">

          <div className="mx-auto w-full max-w-[1700px] px-8 py-8 xl:px-10 xl:py-10">

            {/* Breadcrumb */}
            <div className="mb-6 flex items-center gap-2 text-[10px]">

              <Link
                href="/alerts"
                className="font-medium text-[#8c99a4] transition hover:text-[#e5eaee]"
              >
                Security Alerts
              </Link>

              <span className="text-[#3f4e5a]">
                /
              </span>

              <span className="text-[#5e6d79]">
                Alert Investigation
              </span>

            </div>

            {/* Header */}
            <header className="cz-dashboard-header mb-7 flex items-start justify-between gap-8">

              <div className="min-w-0">

                <div className="mb-3 flex flex-wrap items-center gap-3">

                  <span className="text-[12px] font-semibold text-[#c9a965]">
                    Security Operations
                  </span>

                  <span className="h-px w-8 bg-[#c9a965]/40" />

                  <span className="text-[11px] text-[#667583]">
                    Alert Investigation
                  </span>

                </div>

                <div className="flex flex-wrap items-center gap-3">

                  <h2 className="max-w-5xl text-[34px] font-semibold tracking-[-0.04em] text-[#f4f6f8]">
                    {alert.title}
                  </h2>

                  <SeverityBadge
                    severity={
                      alert.severity
                    }
                  />

                  <StatusBadge
                    status={
                      alert.status
                    }
                  />

                </div>

                <p className="mt-3 max-w-4xl text-[13px] leading-6 text-[#81909c]">
                  Review detection context,
                  supporting telemetry,
                  investigation ownership,
                  and recommended response
                  actions for this alert.
                </p>

              </div>

              <div className="flex shrink-0 items-center gap-3 pt-1">

                <div className="rounded-[10px] border border-[#ffffff]/[0.07] bg-[#0b141e]/80 px-4 py-3">

                  <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#667583]">
                    Source
                  </p>

                  <p className="mt-1 max-w-[150px] truncate text-[11px] font-medium text-[#c9d1d8]">
                    {alert.source}
                  </p>

                </div>

                <div className="rounded-[10px] border border-[#d9a950]/15 bg-[#d9a950]/[0.045] px-4 py-3">

                  <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#88784f]">
                    Detection
                  </p>

                  <div className="mt-1 flex items-center gap-2">

                    <span className="h-2 w-2 rounded-full bg-[#d9a950]" />

                    <p className="text-[11px] font-medium text-[#d8bd7a]">
                      Alert active
                    </p>

                  </div>

                </div>

              </div>

            </header>

            {/* Alert snapshot */}
            <section>

              <div className="mb-3 flex items-end justify-between">

                <div>
                  <h3 className="text-[14px] font-medium text-[#dce3e8]">
                    Investigation snapshot
                  </h3>

                  <p className="mt-1 text-[11px] text-[#657481]">
                    Current alert workflow
                    and ownership state
                  </p>
                </div>

                <p className="text-[10px] text-[#5e6d79]">
                  Created{" "}
                  {formatAlertTime(
                    alert.created_at
                  )}
                </p>

              </div>

              <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">

                <SummaryCard
                  label="Severity"
                  value={
                    alert.severity
                      .toUpperCase()
                  }
                  context="Detection priority"
                  accent={
                    getSeverityColor(
                      alert.severity
                    )
                  }
                />

                <SummaryCard
                  label="Workflow"
                  value={
                    formatLabel(
                      alert.status
                    )
                  }
                  context="Current alert state"
                  accent="#c9a965"
                />

                <SummaryCard
                  label="Analyst"
                  value={
                    alert.assigned_analyst
                    ?? "Unassigned"
                  }
                  context="Investigation owner"
                  accent="#69c5d7"
                />

                <SummaryCard
                  label="Case"
                  value={
                    linkedCase
                      ? "Linked"
                      : alert.case_id
                        ? "Unavailable"
                        : "Not linked"
                  }
                  context={
                    linkedCase
                      ? linkedCase.title
                      : "Investigation record"
                  }
                  accent="#63cfa4"
                />

              </div>

            </section>

            {/* Main investigation workspace */}
            <section className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-12">

              {/* Alert context */}
              <div className="overflow-hidden rounded-[14px] border border-[#1d2a36] bg-[#0b141e]/95 shadow-[0_18px_60px_rgba(0,0,0,0.18)] xl:col-span-8">

                <div className="flex items-start justify-between gap-6 border-b border-[#1c2833] px-6 py-5">

                  <div className="flex items-start gap-3">

                    <span className="mt-[7px] h-2 w-2 rounded-full bg-[#69c5d7]" />

                    <div>
                      <h3 className="text-[15px] font-semibold text-[#e8edf1]">
                        Alert context
                      </h3>

                      <p className="mt-1 text-[11px] text-[#667583]">
                        Detection evidence
                        and correlation metadata
                      </p>
                    </div>

                  </div>

                  <span className="rounded-[6px] border border-[#69c5d7]/15 bg-[#69c5d7]/[0.05] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.06em] text-[#82cfdb]">
                    Detection
                  </span>

                </div>

                <div className="p-6">

                  <div className="rounded-[11px] border border-[#1c2934] bg-[#08111a]/65 p-5">

                    <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#62717e]">
                      Detection summary
                    </p>

                    <p className="mt-3 text-[13px] leading-7 text-[#bac4cc]">
                      {alert.description
                        ?? "No alert description was provided."}
                    </p>

                  </div>

                  <div className="mt-5 grid grid-cols-1 border-y border-[#1c2833] md:grid-cols-2">

                    <DetailCell
                      label="Alert source"
                      value={alert.source}
                    />

                    <DetailCell
                      label="Assigned analyst"
                      value={
                        alert.assigned_analyst
                        ?? "Unassigned"
                      }
                    />

                    <DetailCell
                      label="Created"
                      value={formatAlertTime(
                        alert.created_at
                      )}
                    />

                    <DetailCell
                      label="Last updated"
                      value={formatAlertTime(
                        alert.updated_at
                      )}
                    />

                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">

                    {alert.detection_rule_id ? (
                      <LinkedContextCard
                        label="Detection rule"
                        value={
                          alert.detection_rule_id
                        }
                        href={`/rules/${alert.detection_rule_id}`}
                        accent="#c9a965"
                      />
                    ) : (
                      <ContextCard
                        label="Detection rule"
                        value="Not linked"
                      />
                    )}

                    {alert.source_event_id ? (
                      <LinkedContextCard
                        label="Source event"
                        value={
                          alert.source_event_id
                        }
                        href={`/events/${alert.source_event_id}`}
                        accent="#69c5d7"
                      />
                    ) : (
                      <ContextCard
                        label="Source event"
                        value="Not linked"
                      />
                    )}

                  </div>

                </div>

              </div>

              {/* Workflow */}
              <aside className="overflow-hidden rounded-[14px] border border-[#1d2a36] bg-[#0b141e]/95 shadow-[0_18px_60px_rgba(0,0,0,0.18)] xl:col-span-4">

                <div className="border-b border-[#1c2833] px-6 py-5">

                  <div className="flex items-start justify-between gap-4">

                    <div>
                      <h3 className="text-[15px] font-semibold text-[#e8edf1]">
                        Analyst workflow
                      </h3>

                      <p className="mt-1 text-[11px] text-[#667583]">
                        Triage and investigation
                        controls
                      </p>
                    </div>

                    <StatusBadge
                      status={
                        alert.status
                      }
                    />

                  </div>

                </div>

                <div className="divide-y divide-[#1c2833]">

                  {/* Status */}
                  <div className="p-6">

                    <p className="text-[9px] font-semibold uppercase tracking-[0.09em] text-[#62717e]">
                      Workflow state
                    </p>

                    <div className="mt-3 flex items-center justify-between">

                      <div>
                        <p className="text-[13px] font-semibold text-[#d9e0e5]">
                          {formatLabel(
                            alert.status
                          )}
                        </p>

                        <p className="mt-1 text-[10px] text-[#657481]">
                          Current triage stage
                        </p>
                      </div>

                      <span className="h-2 w-2 rounded-full bg-[#c9a965]" />

                    </div>

                    {[
                      "new",
                      "assigned",
                    ].includes(
                      normalizedStatus
                    ) && (
                      <form
                        action={
                          startInvestigationAction
                        }
                        className="mt-4"
                      >
                        <button
                          type="submit"
                          className="w-full rounded-[8px] border border-[#c9a965]/30 bg-[#c9a965]/[0.08] px-4 py-3 text-[11px] font-semibold text-[#d9bd7a] transition hover:border-[#c9a965]/50 hover:bg-[#c9a965]/[0.13]"
                        >
                          Start investigation
                        </button>
                      </form>
                    )}

                    {normalizedStatus
                      === "investigating" && (
                      <form
                        action={
                          resolveAlertAction
                        }
                        className="mt-4"
                      >
                        <button
                          type="submit"
                          className="w-full rounded-[8px] border border-[#63cfa4]/30 bg-[#63cfa4]/[0.07] px-4 py-3 text-[11px] font-semibold text-[#84dab9] transition hover:border-[#63cfa4]/50 hover:bg-[#63cfa4]/[0.12]"
                        >
                          Resolve alert
                        </button>
                      </form>
                    )}

                    {normalizedStatus
                      === "resolved" && (
                      <div className="mt-4 rounded-[8px] border border-[#63cfa4]/20 bg-[#63cfa4]/[0.05] px-4 py-3">

                        <div className="flex items-center gap-2">

                          <span className="h-2 w-2 rounded-full bg-[#63cfa4]" />

                          <p className="text-[11px] font-medium text-[#83d9b7]">
                            Investigation resolved
                          </p>

                        </div>

                      </div>
                    )}

                    {normalizedStatus
                      === "closed" && (
                      <div className="mt-4 rounded-[8px] border border-[#2a3640] bg-[#08111a] px-4 py-3">

                        <p className="text-[11px] text-[#7c8a95]">
                          Alert closed
                        </p>

                      </div>
                    )}

                  </div>

                  {/* Analyst */}
                  <div className="p-6">

                    <p className="text-[9px] font-semibold uppercase tracking-[0.09em] text-[#62717e]">
                      Analyst ownership
                    </p>

                    {alert.assigned_analyst ? (
                      <div className="mt-3">

                        <div className="flex items-center gap-3">

                          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#69c5d7]/20 bg-[#69c5d7]/[0.06] text-[10px] font-semibold text-[#87d0dc]">
                            {getInitials(
                              alert.assigned_analyst
                            )}
                          </div>

                          <div>
                            <p className="text-[12px] font-semibold text-[#d6dde2]">
                              {alert.assigned_analyst}
                            </p>

                            <p className="mt-1 text-[9px] text-[#687783]">
                              Investigation owner
                            </p>
                          </div>

                        </div>

                        {alert.assigned_analyst
                          === "Daniel Guillaumont" && (
                          <p className="mt-3 text-[10px] font-medium text-[#74cfaa]">
                            Assigned to you
                          </p>
                        )}

                      </div>
                    ) : (
                      <div className="mt-3">

                        <p className="text-[11px] text-[#71808c]">
                          No analyst currently owns
                          this alert.
                        </p>

                        <form
                          action={
                            assignToMeAction
                          }
                          className="mt-4"
                        >
                          <button
                            type="submit"
                            className="w-full rounded-[8px] border border-[#263440] bg-[#101a23] px-4 py-3 text-[11px] font-semibold text-[#c7d0d7] transition hover:border-[#3a4a57] hover:bg-[#15212c]"
                          >
                            Assign to me
                          </button>
                        </form>

                      </div>
                    )}

                  </div>

                  {/* Case */}
                  <div className="p-6">

                    <p className="text-[9px] font-semibold uppercase tracking-[0.09em] text-[#62717e]">
                      Investigation case
                    </p>

                    {linkedCase ? (
                      <div className="mt-3">

                        <p className="text-[12px] font-semibold leading-5 text-[#d8dfe4]">
                          {linkedCase.title}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2">

                          <CaseStatusBadge
                            status={
                              linkedCase.status
                            }
                          />

                          <PriorityBadge
                            priority={
                              linkedCase.priority
                            }
                          />

                        </div>

                        <Link
                          href={`/cases/${linkedCase.id}`}
                          className="mt-4 flex w-full items-center justify-between rounded-[8px] border border-[#263440] bg-[#08111a] px-4 py-3 text-[11px] font-semibold text-[#c7d0d7] transition hover:border-[#3a4a57] hover:text-white"
                        >
                          <span>
                            Open investigation
                          </span>

                          <span className="text-[#c9a965]">
                            →
                          </span>
                        </Link>

                      </div>
                    ) : alert.case_id ? (
                      <div className="mt-3 rounded-[8px] border border-[#d9a950]/20 bg-[#d9a950]/[0.05] px-4 py-3">

                        <p className="text-[11px] font-medium text-[#dfbd70]">
                          Linked case unavailable
                        </p>

                        <p className="mt-2 break-all font-mono text-[9px] text-[#687783]">
                          {alert.case_id}
                        </p>

                      </div>
                    ) : (
                      <div className="mt-3">

                        <p className="text-[11px] leading-5 text-[#71808c]">
                          Escalate this alert into a
                          dedicated investigation
                          case.
                        </p>

                        <form
                          action={
                            createCaseAction
                          }
                          className="mt-4"
                        >
                          <button
                            type="submit"
                            className="w-full rounded-[8px] border border-[#63cfa4]/25 bg-[#63cfa4]/[0.06] px-4 py-3 text-[11px] font-semibold text-[#80d5b4] transition hover:border-[#63cfa4]/45 hover:bg-[#63cfa4]/[0.1]"
                          >
                            Create investigation case
                          </button>
                        </form>

                        {linkableCases.length > 0 && (
                          <>
                            <div className="my-4 flex items-center gap-3">

                              <div className="h-px flex-1 bg-[#1d2933]" />

                              <span className="text-[8px] font-semibold uppercase tracking-[0.1em] text-[#53616d]">
                                or link existing
                              </span>

                              <div className="h-px flex-1 bg-[#1d2933]" />

                            </div>

                            <form
                              action={
                                linkExistingCaseAction
                              }
                            >

                              <select
                                id="case_id"
                                name="case_id"
                                required
                                defaultValue=""
                                className="w-full rounded-[8px] border border-[#25323d] bg-[#08111a] px-3 py-3 text-[11px] text-[#aeb8c1] outline-none transition focus:border-[#69c5d7]/45"
                              >
                                <option
                                  value=""
                                  disabled
                                >
                                  Select investigation...
                                </option>

                                {linkableCases.map(
                                  (
                                    investigationCase
                                  ) => (
                                    <option
                                      key={
                                        investigationCase.id
                                      }
                                      value={
                                        investigationCase.id
                                      }
                                    >
                                      {
                                        investigationCase.title
                                      }
                                    </option>
                                  )
                                )}

                              </select>

                              <button
                                type="submit"
                                className="mt-3 w-full rounded-[8px] border border-[#263440] bg-[#101a23] px-4 py-3 text-[11px] font-semibold text-[#c7d0d7] transition hover:border-[#3a4a57] hover:bg-[#15212c]"
                              >
                                Link existing case
                              </button>

                            </form>
                          </>
                        )}

                      </div>
                    )}

                  </div>

                </div>

              </aside>

            </section>

            {/* Detection intelligence */}
            {(detectionRule
              || recommendedPlaybooks.length > 0) && (
              <section className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">

                {/* MITRE */}
                <div className="overflow-hidden rounded-[14px] border border-[#1d2a36] bg-[#0b141e]/95">

                  <div className="flex items-start justify-between gap-5 border-b border-[#1c2833] px-6 py-5">

                    <div>

                      <div className="flex items-center gap-2">

                        <span className="h-2 w-2 rounded-full bg-[#df945b]" />

                        <h3 className="text-[15px] font-semibold text-[#e8edf1]">
                          Detection intelligence
                        </h3>

                      </div>

                      <p className="mt-2 text-[11px] text-[#667583]">
                        ATT&amp;CK context inherited
                        from the generating rule
                      </p>

                    </div>

                    {detectionRule && (
                      <Link
                        href={`/rules/${detectionRule.id}`}
                        className="text-[10px] font-semibold text-[#c9a965] transition hover:text-[#e3c77f]"
                      >
                        View rule →
                      </Link>
                    )}

                  </div>

                  <div className="p-6">

                    {attackMappings.length > 0 ? (
                      <div className="grid gap-3">

                        {attackMappings.map(
                          (mapping) => (
                            <MitreAttackCard
                              key={`${mapping.technique_id}-${mapping.tactic_id}`}
                              mapping={mapping}
                            />
                          )
                        )}

                      </div>
                    ) : (
                      <EmptyState
                        title="No ATT&CK mapping"
                        description="The linked detection rule does not currently expose an ATT&CK technique mapping."
                      />
                    )}

                  </div>

                </div>

                {/* Playbooks */}
                <div className="overflow-hidden rounded-[14px] border border-[#1d2a36] bg-[#0b141e]/95">

                  <div className="flex items-start justify-between gap-5 border-b border-[#1c2833] px-6 py-5">

                    <div>

                      <div className="flex items-center gap-2">

                        <span className="h-2 w-2 rounded-full bg-[#63cfa4]" />

                        <h3 className="text-[15px] font-semibold text-[#e8edf1]">
                          Recommended response
                        </h3>

                      </div>

                      <p className="mt-2 text-[11px] text-[#667583]">
                        Analyst procedures mapped to
                        the triggering detection
                      </p>

                    </div>

                    <span className="rounded-full border border-[#63cfa4]/15 bg-[#63cfa4]/[0.05] px-2.5 py-1 text-[9px] font-semibold text-[#7fd6b4]">
                      {recommendedPlaybooks.length}{" "}
                      mapped
                    </span>

                  </div>

                  <div className="space-y-3 p-6">

                    {recommendedPlaybooks.length > 0 ? (
                      recommendedPlaybooks.map(
                        (playbook) => (
                          <RecommendedPlaybookCard
                            key={
                              playbook.id
                            }
                            playbook={
                              playbook
                            }
                            detectionRuleId={
                              alert.detection_rule_id!
                            }
                          />
                        )
                      )
                    ) : (
                      <EmptyState
                        title="No response playbook mapped"
                        description="This alert has no enabled response playbook associated with its detection rule."
                      />
                    )}

                  </div>

                </div>

              </section>
            )}

            {/* Threat intelligence */}
            {threatMatches.length > 0 && (
              <section className="mt-5 overflow-hidden rounded-[14px] border border-[#e66b6b]/20 bg-[#0b141e]/95">

                <div className="flex items-start justify-between gap-6 border-b border-[#1c2833] px-6 py-5">

                  <div>

                    <div className="flex items-center gap-2">

                      <span className="h-2 w-2 rounded-full bg-[#e66b6b]" />

                      <h3 className="text-[15px] font-semibold text-[#e8edf1]">
                        Threat intelligence matches
                      </h3>

                    </div>

                    <p className="mt-2 text-[11px] text-[#667583]">
                      Source telemetry matched
                      against the CASE//ZERO IOC
                      registry
                    </p>

                  </div>

                  <div className="rounded-full border border-[#e66b6b]/20 bg-[#e66b6b]/[0.06] px-3 py-1.5 text-[9px] font-semibold text-[#ee8989]">
                    {threatMatches.length}{" "}
                    {threatMatches.length === 1
                      ? "match"
                      : "matches"}
                  </div>

                </div>

                <div className="grid gap-3 p-6">

                  {threatMatches.map(
                    (match) => (
                      <ThreatIntelligenceMatchCard
                        key={
                          match.indicator.id
                        }
                        indicator={
                          match.indicator
                        }
                        matchedFields={
                          match.matchedFields
                        }
                      />
                    )
                  )}

                </div>

              </section>
            )}

            {/* Source event */}
            {alert.source_event_id && (
              <section className="mt-5 overflow-hidden rounded-[14px] border border-[#1d2a36] bg-[#0b141e]/95">

                <div className="flex items-start justify-between gap-6 border-b border-[#1c2833] px-6 py-5">

                  <div>

                    <div className="flex items-center gap-2">

                      <span className="h-2 w-2 rounded-full bg-[#69c5d7]" />

                      <h3 className="text-[15px] font-semibold text-[#e8edf1]">
                        Detection evidence
                      </h3>

                    </div>

                    <p className="mt-2 text-[11px] text-[#667583]">
                      Original normalized telemetry
                      that triggered this detection
                    </p>

                  </div>

                  {sourceEvent && (
                    <Link
                      href={`/events/${sourceEvent.id}`}
                      className="text-[10px] font-semibold text-[#80cad6] transition hover:text-[#a2e1ea]"
                    >
                      Open event →
                    </Link>
                  )}

                </div>

                {sourceEvent ? (
                  <div className="p-6">

                    <div className="grid grid-cols-1 border border-[#1c2934] md:grid-cols-2 xl:grid-cols-3">

                      <EvidenceField
                        label="Event type"
                        value={formatLabel(
                          sourceEvent.event_type
                        )}
                      />

                      <EvidenceField
                        label="Telemetry source"
                        value={
                          sourceEvent.source
                        }
                      />

                      <EvidenceField
                        label="Event time"
                        value={formatAlertTime(
                          sourceEvent.event_time
                        )}
                      />

                      <EvidenceField
                        label="Hostname"
                        value={
                          sourceEvent.hostname
                          ?? "Unavailable"
                        }
                      />

                      <EvidenceField
                        label="Username"
                        value={
                          sourceEvent.username
                          ?? "Unavailable"
                        }
                      />

                      <EvidenceField
                        label="Process"
                        value={
                          sourceEvent.process_name
                          ?? "Unavailable"
                        }
                      />

                      <EvidenceField
                        label="Source address"
                        value={
                          sourceEvent.source_ip
                          ?? "Unavailable"
                        }
                        mono
                      />

                      <EvidenceField
                        label="Destination address"
                        value={
                          sourceEvent.destination_ip
                          ?? "Unavailable"
                        }
                        mono
                      />

                      <EvidenceField
                        label="Ingested"
                        value={formatAlertTime(
                          sourceEvent.created_at
                        )}
                      />

                    </div>

                    <div className="mt-5">

                      <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#62717e]">
                        Command line
                      </p>

                      <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words rounded-[10px] border border-[#202e39] bg-[#050b11] px-5 py-4 font-mono text-[11px] leading-6 text-[#d9b776]">
                        {sourceEvent.command_line
                          ?? "Command line unavailable."}
                      </pre>

                    </div>

                    {sourceEvent.raw_data && (
                      <details className="mt-5 rounded-[10px] border border-[#202e39] bg-[#071019]">

                        <summary className="cursor-pointer select-none px-5 py-4 text-[10px] font-semibold text-[#8e9ba5] transition hover:text-[#cbd4da]">
                          View raw event payload
                        </summary>

                        <div className="border-t border-[#1b2731] p-4">

                          <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-6 text-[#73828e]">
                            {JSON.stringify(
                              sourceEvent.raw_data,
                              null,
                              2
                            )}
                          </pre>

                        </div>

                      </details>
                    )}

                  </div>
                ) : (
                  <div className="p-6">

                    <div className="rounded-[10px] border border-[#d9a950]/20 bg-[#d9a950]/[0.04] px-5 py-4">

                      <p className="text-[12px] font-semibold text-[#ddbd73]">
                        Source event unavailable
                      </p>

                      <p className="mt-2 text-[11px] leading-5 text-[#73828e]">
                        This alert references a
                        security event, but the
                        event could not be
                        retrieved.
                      </p>

                    </div>

                  </div>
                )}

              </section>
            )}

            {/* Technical metadata */}
            <section className="mt-5 overflow-hidden rounded-[14px] border border-[#1d2a36] bg-[#0b141e]/75">

              <div className="border-b border-[#1c2833] px-6 py-5">

                <h3 className="text-[14px] font-semibold text-[#dce3e8]">
                  Technical metadata
                </h3>

                <p className="mt-1 text-[10px] text-[#61707c]">
                  Internal identifiers used by
                  CASE//ZERO correlation and
                  investigation workflows
                </p>

              </div>

              <div className="grid grid-cols-1 gap-px bg-[#1c2833] md:grid-cols-2 xl:grid-cols-4">

                <MetadataField
                  label="Alert ID"
                  value={
                    alert.id
                  }
                />

                <MetadataField
                  label="Detection rule ID"
                  value={
                    alert.detection_rule_id
                    ?? "Not linked"
                  }
                />

                <MetadataField
                  label="Case ID"
                  value={
                    alert.case_id
                    ?? "Not linked"
                  }
                />

                <MetadataField
                  label="Source event ID"
                  value={
                    alert.source_event_id
                    ?? "Not linked"
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


function SummaryCard({
  label,
  value,
  context,
  accent,
}: {
  label: string;
  value: string;
  context: string;
  accent: string;
}) {
  return (
    <div className="cz-metric min-h-[128px] p-5">

      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background:
            `linear-gradient(90deg, ${accent}, transparent 70%)`,
        }}
      />

      <div className="relative z-10">

        <div className="flex items-center justify-between gap-3">

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

        <p className="mt-4 truncate text-[20px] font-semibold leading-none tracking-[-0.03em] text-[#eef2f5]">
          {value}
        </p>

        <p className="mt-4 truncate text-[10px] text-[#657481]">
          {context}
        </p>

      </div>

    </div>
  );
}


function DetailCell({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="border-b border-[#1c2833] px-5 py-4 even:md:border-l">

      <p className="text-[8px] font-semibold uppercase tracking-[0.1em] text-[#5f6e7a]">
        {label}
      </p>

      <p className="mt-2 break-words text-[11px] font-medium text-[#b7c1c9]">
        {value}
      </p>

    </div>
  );
}


function ContextCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[9px] border border-[#1d2a35] bg-[#08111a] px-4 py-4">

      <p className="text-[8px] font-semibold uppercase tracking-[0.1em] text-[#5d6b77]">
        {label}
      </p>

      <p className="mt-2 truncate text-[11px] font-medium text-[#8c99a4]">
        {value}
      </p>

    </div>
  );
}


function LinkedContextCard({
  label,
  value,
  href,
  accent,
}: {
  label: string;
  value: string;
  href: string;
  accent: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-[9px] border border-[#1d2a35] bg-[#08111a] px-4 py-4 transition hover:border-[#344550] hover:bg-[#0b1620]"
    >

      <div className="flex items-center justify-between gap-4">

        <div className="min-w-0">

          <p className="text-[8px] font-semibold uppercase tracking-[0.1em] text-[#5d6b77]">
            {label}
          </p>

          <p className="mt-2 truncate font-mono text-[10px] text-[#98a5af]">
            {value}
          </p>

        </div>

        <span
          className="text-[14px] transition group-hover:translate-x-0.5"
          style={{
            color:
              accent,
          }}
        >
          →
        </span>

      </div>

    </Link>
  );
}


function EvidenceField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-h-[86px] bg-[#09121b] px-5 py-4">

      <p className="text-[8px] font-semibold uppercase tracking-[0.1em] text-[#5d6b77]">
        {label}
      </p>

      <p
        className={`mt-2 break-words text-[11px] text-[#bdc6cd] ${
          mono
            ? "font-mono"
            : ""
        }`}
      >
        {value}
      </p>

    </div>
  );
}


function MetadataField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 bg-[#08111a] px-5 py-4">

      <p className="text-[8px] font-semibold uppercase tracking-[0.1em] text-[#5d6b77]">
        {label}
      </p>

      <code className="mt-2 block overflow-x-auto break-all font-mono text-[9px] leading-5 text-[#82909b]">
        {value}
      </code>

    </div>
  );
}


function MitreAttackCard({
  mapping,
}: {
  mapping: MitreAttackMapping;
}) {
  return (
    <article className="rounded-[10px] border border-[#df945b]/15 bg-[#08111a] p-5">

      <div className="flex flex-wrap items-center gap-2">

        <span className="rounded-[5px] border border-[#df945b]/25 bg-[#df945b]/[0.07] px-2 py-1 font-mono text-[9px] font-semibold text-[#e6a46f]">
          {mapping.technique_id}
        </span>

        <span className="text-[8px] font-semibold uppercase tracking-[0.08em] text-[#5f6e79]">
          Technique
        </span>

      </div>

      <p className="mt-3 text-[13px] font-semibold text-[#dbe2e7]">
        {mapping.technique_name}
      </p>

      <div className="mt-4 flex items-center justify-between gap-4 border-t border-[#1c2833] pt-4">

        <div>

          <p className="text-[8px] font-semibold uppercase tracking-[0.09em] text-[#5c6a76]">
            ATT&amp;CK tactic
          </p>

          <p className="mt-1 text-[10px] text-[#8e9ba5]">
            {mapping.tactic_name}
          </p>

        </div>

        <code className="font-mono text-[9px] text-[#c99762]">
          {mapping.tactic_id}
        </code>

      </div>

    </article>
  );
}


function RecommendedPlaybookCard({
  playbook,
  detectionRuleId,
}: {
  playbook: Playbook;
  detectionRuleId: string;
}) {
  const categories =
    Array.from(
      new Set(
        playbook.steps.map(
          (step) =>
            step.category
        )
      )
    );

  return (
    <article className="rounded-[10px] border border-[#20303b] bg-[#08111a] p-5">

      <div className="flex flex-wrap items-center gap-2">

        <SeverityBadge
          severity={
            playbook.severity
          }
        />

        <span className="rounded-[5px] border border-[#63cfa4]/20 bg-[#63cfa4]/[0.06] px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.06em] text-[#7ed6b3]">
          Recommended
        </span>

        <span className="rounded-[5px] border border-[#293640] bg-[#111a22] px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.06em] text-[#7d8a95]">
          {playbook.steps.length} steps
        </span>

      </div>

      <h4 className="mt-4 text-[13px] font-semibold text-[#dce3e8]">
        {playbook.name}
      </h4>

      <p className="mt-2 text-[10px] leading-5 text-[#6c7b87]">
        {playbook.description}
      </p>

      {categories.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">

          {categories.map(
            (category) => (
              <CategoryBadge
                key={
                  category
                }
                category={
                  category
                }
              />
            )
          )}

        </div>
      )}

      <div className="mt-5 flex items-center justify-between gap-4 border-t border-[#1d2933] pt-4">

        <Link
          href={`/rules/${detectionRuleId}`}
          className="max-w-[55%] truncate font-mono text-[9px] text-[#70808c] transition hover:text-[#c9a965]"
        >
          {detectionRuleId}
        </Link>

        <Link
          href={`/playbooks/${playbook.id}`}
          className="text-[10px] font-semibold text-[#79d1ae] transition hover:text-[#9ae0c4]"
        >
          Open playbook →
        </Link>

      </div>

    </article>
  );
}


function ThreatIntelligenceMatchCard({
  indicator,
  matchedFields,
}: {
  indicator: ThreatIndicator;
  matchedFields: string[];
}) {
  return (
    <article className="rounded-[10px] border border-[#e66b6b]/15 bg-[#08111a] p-5">

      <div className="flex flex-col justify-between gap-5 xl:flex-row">

        <div className="min-w-0 flex-1">

          <div className="flex flex-wrap items-center gap-2">

            <IndicatorTypeBadge
              indicatorType={
                indicator.indicator_type
              }
            />

            <ReputationBadge
              reputation={
                indicator.reputation
              }
            />

            <span className="rounded-[5px] border border-[#2c3943] bg-[#111a22] px-2 py-1 text-[8px] font-semibold text-[#85929c]">
              {indicator.confidence}%
              confidence
            </span>

          </div>

          <code className="mt-4 block break-all font-mono text-[13px] font-semibold text-[#e98a8a]">
            {indicator.value}
          </code>

          {indicator.description && (
            <p className="mt-2 max-w-4xl text-[10px] leading-5 text-[#6e7d89]">
              {indicator.description}
            </p>
          )}

          <div className="mt-4">

            <p className="text-[8px] font-semibold uppercase tracking-[0.09em] text-[#596874]">
              Matched fields
            </p>

            <div className="mt-2 flex flex-wrap gap-2">

              {matchedFields.map(
                (field) => (
                  <span
                    key={field}
                    className="rounded-[5px] border border-[#7ca3d8]/20 bg-[#7ca3d8]/[0.06] px-2 py-1 text-[8px] font-medium text-[#91b0d9]"
                  >
                    {formatMatchedField(
                      field
                    )}
                  </span>
                )
              )}

            </div>

          </div>

        </div>

        <div className="w-full rounded-[9px] border border-[#1d2933] bg-[#050b11] p-4 xl:w-56">

          <p className="text-[8px] font-semibold uppercase tracking-[0.09em] text-[#596874]">
            Intelligence source
          </p>

          <p className="mt-2 truncate text-[10px] font-medium text-[#aab4bc]">
            {indicator.source}
          </p>

          <p className="mt-4 text-[8px] font-semibold uppercase tracking-[0.09em] text-[#596874]">
            Confidence
          </p>

          <p className="mt-2 text-[18px] font-semibold text-[#e1e6ea]">
            {indicator.confidence}

            <span className="ml-1 text-[9px] font-normal text-[#61707c]">
              /100
            </span>
          </p>

          <Link
            href={`/intelligence/${indicator.id}`}
            className="mt-4 flex items-center justify-between border-t border-[#1d2933] pt-4 text-[9px] font-semibold text-[#d98484] transition hover:text-[#f09a9a]"
          >
            <span>
              Open IOC
            </span>

            <span>
              →
            </span>
          </Link>

        </div>

      </div>

    </article>
  );
}


function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[10px] border border-[#202d38] bg-[#08111a] px-5 py-5">

      <p className="text-[12px] font-semibold text-[#aeb9c1]">
        {title}
      </p>

      <p className="mt-2 text-[10px] leading-5 text-[#64737f]">
        {description}
      </p>

    </div>
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

  return (
    <span
      className={`inline-flex w-fit rounded-[6px] border px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.05em] ${
        styles[normalized]
        ?? "border-[#33404b] bg-[#17212a] text-[#9aa6b0]"
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
      className={`rounded-[5px] border px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.05em] ${
        styles[normalized]
        ?? "border-[#33404b] bg-[#17212a] text-[#9aa6b0]"
      }`}
    >
      {status}
    </span>
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
    critical:
      "border-[#e66b6b]/30 bg-[#e66b6b]/[0.08] text-[#f08a8a]",
    high:
      "border-[#df8950]/30 bg-[#df8950]/[0.08] text-[#e9a067]",
    medium:
      "border-[#d9a950]/30 bg-[#d9a950]/[0.08] text-[#e0bb69]",
    low:
      "border-[#69c5d7]/25 bg-[#69c5d7]/[0.07] text-[#86d2df]",
  };

  return (
    <span
      className={`rounded-[5px] border px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.05em] ${
        styles[normalized]
        ?? "border-[#33404b] bg-[#17212a] text-[#9aa6b0]"
      }`}
    >
      {priority}
    </span>
  );
}


function CategoryBadge({
  category,
}: {
  category: string;
}) {
  const normalized =
    category.toLowerCase();

  const styles: Record<
    string,
    string
  > = {
    triage:
      "border-[#7ca3d8]/20 bg-[#7ca3d8]/[0.06] text-[#91b0d9]",
    investigation:
      "border-[#aa82db]/20 bg-[#aa82db]/[0.06] text-[#b89ae0]",
    containment:
      "border-[#df945b]/20 bg-[#df945b]/[0.06] text-[#e3a472]",
    eradication:
      "border-[#e66b6b]/20 bg-[#e66b6b]/[0.06] text-[#e98a8a]",
    recovery:
      "border-[#63cfa4]/20 bg-[#63cfa4]/[0.06] text-[#7fd6b4]",
    documentation:
      "border-[#69c5d7]/20 bg-[#69c5d7]/[0.06] text-[#84cfda]",
  };

  return (
    <span
      className={`rounded-[5px] border px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.05em] ${
        styles[normalized]
        ?? "border-[#33404b] bg-[#17212a] text-[#8f9ca6]"
      }`}
    >
      {category}
    </span>
  );
}


function IndicatorTypeBadge({
  indicatorType,
}: {
  indicatorType: string;
}) {
  const labels: Record<
    string,
    string
  > = {
    ip: "IP",
    domain: "Domain",
    url: "URL",
    hash: "Hash",
  };

  return (
    <span className="rounded-[5px] border border-[#7ca3d8]/20 bg-[#7ca3d8]/[0.06] px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.05em] text-[#94b3dc]">
      {labels[indicatorType]
        ?? indicatorType.toUpperCase()}
    </span>
  );
}


function ReputationBadge({
  reputation,
}: {
  reputation: string;
}) {
  const normalized =
    reputation.toLowerCase();

  const styles: Record<
    string,
    string
  > = {
    malicious:
      "border-[#e66b6b]/25 bg-[#e66b6b]/[0.07] text-[#ec8585]",
    suspicious:
      "border-[#df945b]/25 bg-[#df945b]/[0.07] text-[#e4a372]",
    unknown:
      "border-[#47545e]/30 bg-[#47545e]/[0.08] text-[#8e9aa4]",
    benign:
      "border-[#63cfa4]/25 bg-[#63cfa4]/[0.07] text-[#7fd6b4]",
  };

  return (
    <span
      className={`rounded-[5px] border px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.05em] ${
        styles[normalized]
        ?? "border-[#33404b] bg-[#17212a] text-[#8f9ca6]"
      }`}
    >
      {reputation}
    </span>
  );
}


function getSeverityColor(
  severity: string
) {
  const colors: Record<
    string,
    string
  > = {
    critical: "#e66b6b",
    high: "#df945b",
    medium: "#d9a950",
    low: "#69c5d7",
  };

  return (
    colors[
      severity.toLowerCase()
    ] ?? "#7f8d98"
  );
}


function formatMatchedField(
  field: string
) {
  const labels: Record<
    string,
    string
  > = {
    source_ip:
      "Source IP",
    destination_ip:
      "Destination IP",
    command_line:
      "Command Line",
    raw_data:
      "Raw Event Data",
  };

  return (
    labels[field]
    ?? formatLabel(field)
  );
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


function getInitials(
  displayName: string
) {
  const names =
    displayName
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  if (names.length === 0) {
    return "CZ";
  }

  if (names.length === 1) {
    return names[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return (
    names[0][0]
    + names[
      names.length - 1
    ][0]
  ).toUpperCase();
}


function formatAlertTime(
  timestamp: string
) {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      dateStyle:
        "medium",
      timeStyle:
        "short",
    }
  ).format(
    new Date(timestamp)
  );
}