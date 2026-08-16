import Link from "next/link";
import { notFound } from "next/navigation";

import Sidebar from "@/components/Sidebar";

import {
  getAlert,
  getCase,
  getCases,
  getPlaybooksForRule,
  getSecurityEvent,
  getThreatIndicators,
} from "@/lib/api";

import type {
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
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const alert = await getAlert(id);

  if (!alert) {
    notFound();
  }

  const linkedCase = alert.case_id
    ? await getCase(alert.case_id)
    : null;

  const sourceEvent = alert.source_event_id
    ? await getSecurityEvent(
        alert.source_event_id
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

  const existingCases = alert.case_id
    ? []
    : await getCases();

  const linkableCases = existingCases.filter(
    (investigationCase) =>
      !["resolved", "closed"].includes(
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

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">

      <div className="flex min-h-screen">

        <Sidebar />

        <main className="flex-1 p-10">

          {/* Back Link */}
          <div className="mb-8">

            <Link
              href="/alerts"
              className="text-sm text-zinc-500 transition hover:text-zinc-200"
            >
              &larr; Back to Alerts
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

              <SeverityBadge
                severity={alert.severity}
              />

              <StatusBadge
                status={alert.status}
              />

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
                    value={
                      alert.severity.toUpperCase()
                    }
                  />

                  <DetailField
                    label="Status"
                    value={
                      alert.status.toUpperCase()
                    }
                  />

                  {alert.detection_rule_id ? (
                    <LinkedDetailField
                      label="Detection Rule"
                      value={
                        alert.detection_rule_id
                      }
                      href={`/rules/${alert.detection_rule_id}`}
                    />
                  ) : (
                    <DetailField
                      label="Detection Rule"
                      value="Not linked"
                    />
                  )}

                  <DetailField
                    label="Assigned Analyst"
                    value={
                      alert.assigned_analyst ??
                      "Unassigned"
                    }
                  />

                  <DetailField
                    label="Created"
                    value={formatAlertTime(
                      alert.created_at
                    )}
                  />

                  <DetailField
                    label="Last Updated"
                    value={formatAlertTime(
                      alert.updated_at
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
                  Analyst workflow
                </p>

              </div>

              <div className="space-y-6 p-6">

                <div>

                  <p className="text-xs uppercase tracking-wider text-zinc-500">
                    Current Status
                  </p>

                  <div className="mt-3">

                    <StatusBadge
                      status={alert.status}
                    />

                  </div>

                </div>

                <div className="border-t border-zinc-800 pt-6">

                  <p className="text-xs uppercase tracking-wider text-zinc-500">
                    Analyst Action
                  </p>

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
                        resolveAlertAction
                      }
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
                        Alert closed
                      </p>

                    </div>
                  )}

                </div>

                <div className="border-t border-zinc-800 pt-6">

                  <p className="text-xs uppercase tracking-wider text-zinc-500">
                    Assigned Analyst
                  </p>

                  {alert.assigned_analyst ? (
                    <div className="mt-3">

                      <p className="text-sm font-medium text-zinc-200">
                        {alert.assigned_analyst}
                      </p>

                      {alert.assigned_analyst ===
                        "Daniel Guillaumont" && (
                        <p className="mt-1 text-xs text-emerald-400">
                          Assigned to you
                        </p>
                      )}

                    </div>
                  ) : (
                    <div className="mt-3">

                      <p className="text-sm text-zinc-500">
                        Unassigned
                      </p>

                      <form
                        action={
                          assignToMeAction
                        }
                        className="mt-4"
                      >
                        <button
                          type="submit"
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm font-medium text-zinc-200 transition hover:bg-zinc-700"
                        >
                          Assign to Me
                        </button>
                      </form>

                    </div>
                  )}

                </div>

                <div className="border-t border-zinc-800 pt-6">

                  <p className="text-xs uppercase tracking-wider text-zinc-500">
                    Investigation Case
                  </p>

                  {linkedCase ? (
                    <div className="mt-3">

                      <p className="text-sm font-medium text-zinc-200">
                        {linkedCase.title}
                      </p>

                      <div className="mt-3 flex items-center gap-2">

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
                        className="mt-4 inline-flex text-sm font-medium text-emerald-400 transition hover:text-emerald-300"
                      >
                        View Case &rarr;
                      </Link>

                    </div>
                  ) : alert.case_id ? (
                    <div className="mt-3">

                      <p className="text-sm text-yellow-400">
                        Linked case unavailable
                      </p>

                      <p className="mt-1 text-xs text-zinc-600">
                        Case ID:{" "}
                        {alert.case_id}
                      </p>

                    </div>
                  ) : (
                    <div className="mt-3">

                      <p className="text-sm text-zinc-400">
                        No investigation case linked.
                      </p>

                      <p className="mt-1 text-xs leading-5 text-zinc-600">
                        Create a new case or associate this alert with an existing investigation.
                      </p>

                      <form
                        action={
                          createCaseAction
                        }
                        className="mt-4"
                      >
                        <button
                          type="submit"
                          className="w-full rounded-lg border border-emerald-800 bg-emerald-950 px-4 py-3 text-sm font-medium text-emerald-400 transition hover:bg-emerald-900"
                        >
                          Create New Investigation Case
                        </button>
                      </form>

                      <div className="my-5 flex items-center gap-3">

                        <div className="h-px flex-1 bg-zinc-800" />

                        <span className="text-xs uppercase tracking-wider text-zinc-600">
                          or
                        </span>

                        <div className="h-px flex-1 bg-zinc-800" />

                      </div>

                      {linkableCases.length > 0 ? (
                        <form
                          action={
                            linkExistingCaseAction
                          }
                        >
                          <label
                            htmlFor="case_id"
                            className="text-xs uppercase tracking-wider text-zinc-500"
                          >
                            Existing Case
                          </label>

                          <select
                            id="case_id"
                            name="case_id"
                            required
                            defaultValue=""
                            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm text-zinc-300 outline-none transition focus:border-emerald-700"
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
                            className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm font-medium text-zinc-200 transition hover:bg-zinc-700"
                          >
                            Link to Existing Case
                          </button>

                        </form>
                      ) : (
                        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-4 py-3">

                          <p className="text-xs leading-5 text-zinc-500">
                            No active investigation cases are currently available.
                          </p>

                        </div>
                      )}

                    </div>
                  )}

                </div>

              </div>

            </section>

          </div>

          {/* Recommended Response */}
          {alert.detection_rule_id && (
            <section className="mt-6 overflow-hidden rounded-xl border border-emerald-900/70 bg-zinc-900">

              <div className="flex items-start justify-between gap-6 border-b border-zinc-800 px-6 py-5">

                <div>

                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-400">
                    Recommended Response
                  </p>

                  <h3 className="mt-2 font-medium">
                    Incident Response Playbook
                  </h3>

                  <p className="mt-1 text-sm text-zinc-500">
                    CASE//ZERO matched this alert&apos;s detection rule to the recommended analyst response procedure.
                  </p>

                </div>

                <Link
                  href={`/rules/${alert.detection_rule_id}`}
                  className="rounded-md border border-violet-900 bg-violet-950 px-3 py-1.5 text-xs font-medium text-violet-400 transition hover:bg-violet-900"
                >
                  {alert.detection_rule_id} &rarr;
                </Link>

              </div>

              {recommendedPlaybooks.length > 0 ? (
                <div className="space-y-4 p-6">

                  {recommendedPlaybooks.map(
                    (playbook) => (
                      <RecommendedPlaybookCard
                        key={playbook.id}
                        playbook={playbook}
                        detectionRuleId={
                          alert.detection_rule_id!
                        }
                      />
                    )
                  )}

                </div>
              ) : (
                <div className="p-6">

                  <div className="rounded-lg border border-yellow-900 bg-yellow-950/30 px-4 py-4">

                    <p className="text-sm font-medium text-yellow-400">
                      No response playbook mapped
                    </p>

                    <p className="mt-2 text-sm leading-6 text-zinc-500">
                      This alert was generated by detection rule{" "}
                      <span className="font-medium text-zinc-300">
                        {alert.detection_rule_id}
                      </span>
                      , but no enabled response playbook is currently mapped to that rule.
                    </p>

                  </div>

                </div>
              )}

            </section>
          )}

          {/* Threat Intelligence */}
          {threatMatches.length > 0 && (
            <section className="mt-6 overflow-hidden rounded-xl border border-red-900/70 bg-zinc-900">

              <div className="flex items-start justify-between gap-6 border-b border-zinc-800 px-6 py-5">

                <div>

                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-red-400">
                    Threat Intelligence Match
                  </p>

                  <h3 className="mt-2 font-medium">
                    Known Indicators
                  </h3>

                  <p className="mt-1 text-sm text-zinc-500">
                    CASE//ZERO matched values from the source security event against the local IOC registry.
                  </p>

                </div>

                <div className="rounded-md border border-red-900 bg-red-950 px-3 py-1.5 text-xs font-medium text-red-400">
                  {threatMatches.length}{" "}
                  {threatMatches.length === 1
                    ? "Match"
                    : "Matches"}
                </div>

              </div>

              <div className="space-y-4 p-6">

                {threatMatches.map(
                  (match) => (
                    <ThreatIntelligenceMatchCard
                      key={match.indicator.id}
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

          {/* Source Security Event */}
          {alert.source_event_id && (
            <section className="mt-6 overflow-hidden rounded-xl border border-violet-900/70 bg-zinc-900">

              <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-5">

                <div>

                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-violet-400">
                    Detection Evidence
                  </p>

                  <h3 className="mt-2 font-medium">
                    Triggered By Security Event
                  </h3>

                  <p className="mt-1 text-sm text-zinc-500">
                    Original telemetry that caused this alert to be generated.
                  </p>

                </div>

                <span className="rounded-md border border-violet-900 bg-violet-950 px-3 py-1.5 text-xs font-medium uppercase text-violet-400">
                  Source Event
                </span>

              </div>

              {sourceEvent ? (
                <div className="p-6">

                  <div className="grid grid-cols-3 gap-x-8 gap-y-7">

                    <DetailField
                      label="Event Type"
                      value={
                        sourceEvent.event_type
                      }
                    />

                    <DetailField
                      label="Telemetry Source"
                      value={
                        sourceEvent.source
                      }
                    />

                    <DetailField
                      label="Event Time"
                      value={formatAlertTime(
                        sourceEvent.event_time
                      )}
                    />

                    <DetailField
                      label="Hostname"
                      value={
                        sourceEvent.hostname ??
                        "Unavailable"
                      }
                    />

                    <DetailField
                      label="Username"
                      value={
                        sourceEvent.username ??
                        "Unavailable"
                      }
                    />

                    <DetailField
                      label="Source IP"
                      value={
                        sourceEvent.source_ip ??
                        "Unavailable"
                      }
                    />

                    <DetailField
                      label="Destination IP"
                      value={
                        sourceEvent.destination_ip ??
                        "Unavailable"
                      }
                    />

                    <DetailField
                      label="Process"
                      value={
                        sourceEvent.process_name ??
                        "Unavailable"
                      }
                    />

                    <DetailField
                      label="Ingested"
                      value={formatAlertTime(
                        sourceEvent.created_at
                      )}
                    />

                  </div>

                  <div className="mt-8 border-t border-zinc-800 pt-6">

                    <p className="text-xs uppercase tracking-wider text-zinc-500">
                      Command Line
                    </p>

                    <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-4 font-mono text-sm leading-6 text-orange-300">
                      {sourceEvent.command_line ??
                        "Command line unavailable."}
                    </pre>

                  </div>

                  {sourceEvent.raw_data && (
                    <div className="mt-6">

                      <p className="text-xs uppercase tracking-wider text-zinc-500">
                        Raw Event Data
                      </p>

                      <pre className="mt-3 max-h-80 overflow-auto rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-4 font-mono text-xs leading-6 text-zinc-400">
                        {JSON.stringify(
                          sourceEvent.raw_data,
                          null,
                          2
                        )}
                      </pre>

                    </div>
                  )}

                </div>
              ) : (
                <div className="px-6 py-8">

                  <div className="rounded-lg border border-yellow-900 bg-yellow-950/30 px-4 py-4">

                    <p className="text-sm font-medium text-yellow-400">
                      Source event unavailable
                    </p>

                    <p className="mt-2 text-sm text-zinc-500">
                      This alert contains a source event ID, but the event could not be retrieved from the API.
                    </p>

                  </div>

                </div>
              )}

            </section>
          )}

          {/* Technical Metadata */}
          <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6">

            <h3 className="font-medium">
              Technical Metadata
            </h3>

            <p className="mt-1 text-sm text-zinc-500">
              Internal CASE//ZERO alert identifiers.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-6 xl:grid-cols-4">

              <MetadataField
                label="Alert ID"
                value={alert.id}
              />

              <MetadataField
                label="Detection Rule ID"
                value={
                  alert.detection_rule_id ??
                  "Not linked"
                }
              />

              <MetadataField
                label="Case ID"
                value={
                  alert.case_id ??
                  "Not linked"
                }
              />

              <MetadataField
                label="Source Event ID"
                value={
                  alert.source_event_id ??
                  "Not linked"
                }
              />

            </div>

          </section>

        </main>

      </div>

    </div>
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
    <article className="rounded-xl border border-red-900/60 bg-zinc-950/70 p-6">

      <div className="flex items-start justify-between gap-8">

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

            <span className="rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs font-medium text-zinc-400">
              {indicator.confidence}% confidence
            </span>

          </div>

          <code className="mt-4 block break-all font-mono text-lg font-semibold text-red-300">
            {indicator.value}
          </code>

          {indicator.description && (
            <p className="mt-3 max-w-4xl text-sm leading-6 text-zinc-500">
              {indicator.description}
            </p>
          )}

          <div className="mt-5">

            <p className="text-xs uppercase tracking-wider text-zinc-600">
              Matched Event Fields
            </p>

            <div className="mt-2 flex flex-wrap gap-2">

              {matchedFields.map(
                (field) => (
                  <span
                    key={field}
                    className="rounded-md border border-violet-900 bg-violet-950 px-2.5 py-1 text-xs text-violet-400"
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

        <div className="w-64 shrink-0 rounded-lg border border-zinc-800 bg-zinc-950 p-4">

          <p className="text-xs uppercase tracking-wider text-zinc-600">
            Intelligence Source
          </p>

          <p className="mt-2 text-sm font-medium text-zinc-300">
            {indicator.source}
          </p>

          <p className="mt-5 text-xs uppercase tracking-wider text-zinc-600">
            Confidence
          </p>

          <p className="mt-2 text-lg font-semibold text-zinc-100">
            {indicator.confidence}
            <span className="ml-1 text-xs font-normal text-zinc-600">
              / 100
            </span>
          </p>

        </div>

      </div>

      <div className="mt-6 border-t border-zinc-800 pt-5">

        <Link
          href={`/intelligence/${indicator.id}`}
          className="inline-flex rounded-lg border border-red-900 bg-red-950 px-5 py-3 text-sm font-medium text-red-400 transition hover:bg-red-900/60"
        >
          Open Intelligence Record &rarr;
        </Link>

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
          (step) => step.category
        )
      )
    );

  return (
    <article className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-6">

      <div className="flex items-start justify-between gap-8">

        <div className="min-w-0 flex-1">

          <div className="flex flex-wrap items-center gap-2">

            <SeverityBadge
              severity={playbook.severity}
            />

            <span className="rounded-md border border-emerald-900 bg-emerald-950 px-2.5 py-1 text-xs font-medium uppercase text-emerald-400">
              Recommended
            </span>

            <span className="rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs font-medium uppercase text-zinc-400">
              {playbook.steps.length} Steps
            </span>

          </div>

          <h4 className="mt-4 text-xl font-medium text-zinc-100">
            {playbook.name}
          </h4>

          <p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-500">
            {playbook.description}
          </p>

          <div className="mt-5 flex flex-wrap gap-2">

            {categories.map(
              (category) => (
                <CategoryBadge
                  key={category}
                  category={category}
                />
              )
            )}

          </div>

        </div>

        <div className="w-72 shrink-0 rounded-lg border border-zinc-800 bg-zinc-950 p-4">

          <p className="text-xs uppercase tracking-wider text-zinc-600">
            Triggered By
          </p>

          <Link
            href={`/rules/${detectionRuleId}`}
            className="mt-2 inline-flex break-words text-sm font-medium text-violet-400 transition hover:text-violet-300"
          >
            {detectionRuleId} &rarr;
          </Link>

          <p className="mt-5 text-xs uppercase tracking-wider text-zinc-600">
            Playbook ID
          </p>

          <p className="mt-2 break-words text-sm text-zinc-400">
            {playbook.id}
          </p>

        </div>

      </div>

      <div className="mt-6 border-t border-zinc-800 pt-5">

        <Link
          href={`/playbooks/${playbook.id}`}
          className="inline-flex rounded-lg border border-emerald-800 bg-emerald-950 px-5 py-3 text-sm font-medium text-emerald-400 transition hover:bg-emerald-900"
        >
          Open Response Playbook &rarr;
        </Link>

      </div>

    </article>
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
    <div>

      <p className="text-xs uppercase tracking-wider text-zinc-500">
        {label}
      </p>

      <code className="mt-2 block overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-400">
        {value}
      </code>

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
        className={`mt-2 break-words text-zinc-300 ${
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


function LinkedDetailField({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href: string;
}) {
  return (
    <div>

      <p className="text-xs uppercase tracking-wider text-zinc-500">
        {label}
      </p>

      <Link
        href={href}
        className="mt-2 inline-flex break-words text-sm font-medium text-violet-400 transition hover:text-violet-300"
      >
        {value} &rarr;
      </Link>

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
      className={`rounded-md border px-3 py-1.5 text-xs font-medium uppercase ${
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


function StatusBadge({
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
      className={`rounded-md border px-3 py-1.5 text-xs font-medium uppercase ${
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
      className={`rounded-md border px-2.5 py-1 text-xs font-medium uppercase ${
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
      className={`rounded-md border px-2.5 py-1 text-xs font-medium uppercase ${
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


function CategoryBadge({
  category,
}: {
  category: string;
}) {
  const styles: Record<
    string,
    string
  > = {
    triage:
      "border-blue-900 bg-blue-950 text-blue-400",

    investigation:
      "border-violet-900 bg-violet-950 text-violet-400",

    containment:
      "border-orange-900 bg-orange-950 text-orange-400",

    eradication:
      "border-red-900 bg-red-950 text-red-400",

    recovery:
      "border-emerald-900 bg-emerald-950 text-emerald-400",

    documentation:
      "border-cyan-900 bg-cyan-950 text-cyan-400",
  };

  const normalized =
    category.toLowerCase();

  return (
    <span
      className={`rounded-md border px-2.5 py-1 text-xs font-medium uppercase ${
        styles[normalized]
        ??
        "border-zinc-700 bg-zinc-800 text-zinc-400"
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
    domain: "DOMAIN",
    url: "URL",
    hash: "HASH",
  };

  return (
    <span className="rounded-md border border-blue-900 bg-blue-950 px-2.5 py-1 text-xs font-medium text-blue-400">
      {
        labels[indicatorType]
        ?? indicatorType.toUpperCase()
      }
    </span>
  );
}


function ReputationBadge({
  reputation,
}: {
  reputation: string;
}) {
  const styles: Record<
    string,
    string
  > = {
    malicious:
      "border-red-900 bg-red-950 text-red-400",

    suspicious:
      "border-orange-900 bg-orange-950 text-orange-400",

    unknown:
      "border-zinc-700 bg-zinc-800 text-zinc-400",

    benign:
      "border-emerald-900 bg-emerald-950 text-emerald-400",
  };

  const normalized =
    reputation.toLowerCase();

  return (
    <span
      className={`rounded-md border px-2.5 py-1 text-xs font-medium uppercase ${
        styles[normalized]
        ??
        "border-zinc-700 bg-zinc-800 text-zinc-400"
      }`}
    >
      {reputation}
    </span>
  );
}


function formatMatchedField(
  field: string
) {
  const labels: Record<
    string,
    string
  > = {
    source_ip: "Source IP",
    destination_ip: "Destination IP",
    command_line: "Command Line",
    raw_data: "Raw Event Data",
  };

  return (
    labels[field]
    ?? field.replaceAll(
      "_",
      " "
    )
  );
}


function formatAlertTime(
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