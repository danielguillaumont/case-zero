import Link from "next/link";

import Sidebar from "@/components/Sidebar";

import {
  getThreatIndicators,
} from "@/lib/api";

import type {
  ThreatIndicator,
} from "@/lib/api";


type IntelligenceSearchParams = {
  search?: string;
  indicator_type?: string;
  reputation?: string;
  source?: string;
};


export default async function IntelligencePage({
  searchParams,
}: {
  searchParams: Promise<IntelligenceSearchParams>;
}) {
  const params =
    await searchParams;

  const search =
    params.search?.trim() ?? "";

  const indicatorType =
    params.indicator_type?.trim() ?? "";

  const reputation =
    params.reputation?.trim() ?? "";

  const source =
    params.source?.trim() ?? "";

  const [
    allIndicators,
    filteredIndicators,
  ] = await Promise.all([
    getThreatIndicators({
      limit: 500,
    }),

    getThreatIndicators({
      search:
        search || null,
      indicator_type:
        indicatorType || null,
      reputation:
        reputation || null,
      source:
        source || null,
      limit: 500,
    }),
  ]);

  const maliciousCount =
    allIndicators.filter(
      (indicator) =>
        indicator.reputation.toLowerCase()
        === "malicious"
    ).length;

  const suspiciousCount =
    allIndicators.filter(
      (indicator) =>
        indicator.reputation.toLowerCase()
        === "suspicious"
    ).length;

  const highConfidenceCount =
    allIndicators.filter(
      (indicator) =>
        indicator.confidence >= 80
    ).length;

  const uniqueTypes =
    new Set(
      allIndicators.map(
        (indicator) =>
          indicator.indicator_type.toLowerCase()
      )
    ).size;

  const hasFilters =
    Boolean(
      search
      || indicatorType
      || reputation
      || source
    );

  const activeFilterCount =
    [
      search,
      indicatorType,
      reputation,
      source,
    ].filter(Boolean).length;

  const latestObservation =
    getLatestIndicatorTime(
      allIndicators.map(
        (indicator) =>
          indicator.last_seen
      )
    );

  const metrics = [
    {
      label:
        "Tracked indicators",
      value:
        allIndicators.length,
      context:
        `${uniqueTypes} indicator ${
          uniqueTypes === 1
            ? "type"
            : "types"
        }`,
      accent:
        "#69c5d7",
    },
    {
      label:
        "Malicious",
      value:
        maliciousCount,
      context:
        "Confirmed hostile reputation",
      accent:
        "#df7171",
    },
    {
      label:
        "Suspicious",
      value:
        suspiciousCount,
      context:
        "Requires additional review",
      accent:
        "#d99a5e",
    },
    {
      label:
        "High confidence",
      value:
        highConfidenceCount,
      context:
        "Confidence score of 80+",
      accent:
        "#69c59f",
    },
  ];

  return (
    <div className="min-h-screen text-[#f1f4f7]">
      <div className="flex min-h-screen">
        <Sidebar />

        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-[1700px] px-8 py-8 xl:px-10 xl:py-10">

            {/* Header */}
            <header className="mb-7 flex items-start justify-between gap-8 border-b border-[#1b2833] pb-7">
              <div>
                <div className="mb-3 flex items-center gap-3">
                  <span className="text-[12px] font-semibold text-[#c9a965]">
                    Security Operations
                  </span>

                  <span className="h-px w-8 bg-[#c9a965]/40" />

                  <span className="text-[11px] text-[#667583]">
                    Intelligence Registry
                  </span>
                </div>

                <h2 className="text-[34px] font-semibold tracking-[-0.04em] text-[#f4f6f8]">
                  Threat Intelligence
                </h2>

                <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[#81909c]">
                  Investigate indicators of compromise,
                  assess reputation and confidence, and
                  pivot directly into correlated CASE//ZERO
                  telemetry.
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-3 pt-1">
                <div className="rounded-[10px] border border-[#1d2d39] bg-[#0b141d]/80 px-4 py-3">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#61717e]">
                    Registry
                  </p>

                  <div className="mt-1 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#69c59f]" />

                    <span className="text-[11px] font-medium text-[#88d8b8]">
                      Operational
                    </span>
                  </div>
                </div>

                <div className="rounded-[10px] border border-[#1d2d39] bg-[#0b141d]/80 px-4 py-3">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#61717e]">
                    Dataset
                  </p>

                  <p className="mt-1 text-[11px] font-medium text-[#d9e1e7]">
                    {allIndicators.length} tracked
                  </p>
                </div>
              </div>
            </header>

            {/* Intelligence posture */}
            <section>
              <div className="mb-3 flex items-end justify-between gap-5">
                <div>
                  <h3 className="text-[14px] font-medium text-[#dce3e8]">
                    Intelligence posture
                  </h3>

                  <p className="mt-1 text-[11px] text-[#657481]">
                    Reputation and confidence across the current IOC registry
                  </p>
                </div>

                <p className="text-[10px] text-[#5e6d79]">
                  {latestObservation
                    ? `Latest observation ${formatCompactTime(
                        latestObservation
                      )}`
                    : "No indicator observations"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                {metrics.map(
                  (metric) => (
                    <MetricCard
                      key={
                        metric.label
                      }
                      label={
                        metric.label
                      }
                      value={
                        metric.value
                      }
                      context={
                        metric.context
                      }
                      accent={
                        metric.accent
                      }
                    />
                  )
                )}
              </div>
            </section>

            {/* Query builder */}
            <section className="mt-5 overflow-hidden rounded-[14px] border border-[#1b2a36] bg-[#0b141d]/95">
              <div className="flex items-start justify-between gap-8 border-b border-[#1a2833] px-6 py-5">
                <div className="flex items-start gap-3">
                  <span className="mt-[6px] h-2 w-2 shrink-0 rounded-full bg-[#d5b35f]" />

                  <div>
                    <h3 className="text-[15px] font-semibold text-[#e8edf1]">
                      Intelligence search
                    </h3>

                    <p className="mt-1 text-[11px] text-[#657481]">
                      Search IOC value, type,
                      reputation, intelligence source,
                      or descriptive context.
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-[11px] font-medium text-[#d7dde2]">
                    {hasFilters
                      ? `${activeFilterCount} active ${
                          activeFilterCount === 1
                            ? "filter"
                            : "filters"
                        }`
                      : "Registry-wide search"}
                  </p>

                  <p className="mt-1 text-[9px] uppercase tracking-[0.1em] text-[#566571]">
                    Maximum 500 records
                  </p>
                </div>
              </div>

              <form
                method="GET"
                className="px-6 py-6"
              >
                <div className="grid gap-5 xl:grid-cols-12">

                  <div className="xl:col-span-6">
                    <label
                      htmlFor="search"
                      className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#667683]"
                    >
                      Search intelligence
                    </label>

                    <div className="relative mt-2">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#52616e]">
                        <SearchIcon />
                      </span>

                      <input
                        id="search"
                        name="search"
                        defaultValue={
                          search
                        }
                        placeholder="Search IP, domain, URL, hash, description..."
                        className="h-12 w-full rounded-[9px] border border-[#20303d] bg-[#071019] pl-11 pr-4 text-[13px] text-[#e6ebef] outline-none transition placeholder:text-[#50606d] focus:border-[#6b8799]"
                      />
                    </div>
                  </div>

                  <div className="xl:col-span-3">
                    <label
                      htmlFor="indicator_type"
                      className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#667683]"
                    >
                      Indicator type
                    </label>

                    <select
                      id="indicator_type"
                      name="indicator_type"
                      defaultValue={
                        indicatorType
                      }
                      className="mt-2 h-12 w-full rounded-[9px] border border-[#20303d] bg-[#071019] px-4 text-[13px] text-[#bbc6ce] outline-none transition focus:border-[#6b8799]"
                    >
                      <option value="">
                        All indicator types
                      </option>

                      <option value="ip">
                        IP address
                      </option>

                      <option value="domain">
                        Domain
                      </option>

                      <option value="url">
                        URL
                      </option>

                      <option value="hash">
                        File hash
                      </option>
                    </select>
                  </div>

                  <div className="xl:col-span-3">
                    <label
                      htmlFor="reputation"
                      className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#667683]"
                    >
                      Reputation
                    </label>

                    <select
                      id="reputation"
                      name="reputation"
                      defaultValue={
                        reputation
                      }
                      className="mt-2 h-12 w-full rounded-[9px] border border-[#20303d] bg-[#071019] px-4 text-[13px] text-[#bbc6ce] outline-none transition focus:border-[#6b8799]"
                    >
                      <option value="">
                        All reputations
                      </option>

                      <option value="malicious">
                        Malicious
                      </option>

                      <option value="suspicious">
                        Suspicious
                      </option>

                      <option value="unknown">
                        Unknown
                      </option>

                      <option value="benign">
                        Benign
                      </option>
                    </select>
                  </div>
                </div>

                <div className="mt-5 grid items-end gap-5 xl:grid-cols-12">
                  <div className="xl:col-span-6">
                    <label
                      htmlFor="source"
                      className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#667683]"
                    >
                      Intelligence source
                    </label>

                    <input
                      id="source"
                      name="source"
                      defaultValue={
                        source
                      }
                      placeholder="e.g. case-zero-lab"
                      className="mt-2 h-12 w-full rounded-[9px] border border-[#20303d] bg-[#071019] px-4 text-[13px] text-[#e6ebef] outline-none transition placeholder:text-[#50606d] focus:border-[#6b8799]"
                    />
                  </div>

                  <div className="xl:col-span-6">
                    <div className="flex h-full items-end justify-end gap-3">
                      <Link
                        href="/intelligence"
                        className="inline-flex h-12 items-center justify-center rounded-[9px] border border-[#21313e] bg-[#09121a] px-5 text-[12px] font-medium text-[#b6c0c8] transition hover:border-[#334553] hover:bg-[#0d1822] hover:text-white"
                      >
                        Clear filters
                      </Link>

                      <button
                        type="submit"
                        className="inline-flex h-12 items-center justify-center gap-2 rounded-[9px] border border-[#7b693d] bg-[#c9a965]/[0.08] px-6 text-[12px] font-semibold text-[#e2c87e] transition hover:border-[#a68b4d] hover:bg-[#c9a965]/[0.12]"
                      >
                        <SearchIcon />
                        Search intelligence
                      </button>
                    </div>
                  </div>
                </div>

                {hasFilters && (
                  <div className="mt-6 border-t border-[#192733] pt-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="mr-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#566672]">
                        Active query
                      </span>

                      {search && (
                        <QueryChip
                          label="Search"
                          value={
                            search
                          }
                        />
                      )}

                      {indicatorType && (
                        <QueryChip
                          label="Type"
                          value={
                            formatIndicatorType(
                              indicatorType
                            )
                          }
                        />
                      )}

                      {reputation && (
                        <QueryChip
                          label="Reputation"
                          value={
                            formatLabel(
                              reputation
                            )
                          }
                        />
                      )}

                      {source && (
                        <QueryChip
                          label="Source"
                          value={
                            source
                          }
                        />
                      )}
                    </div>
                  </div>
                )}
              </form>
            </section>

            {/* Registry */}
            <section className="mt-5 overflow-hidden rounded-[14px] border border-[#1b2a36] bg-[#0b141d]/95">
              <div className="flex items-start justify-between gap-8 border-b border-[#1a2833] px-6 py-5">
                <div className="flex items-start gap-3">
                  <span className="mt-[6px] h-2 w-2 shrink-0 rounded-full bg-[#69c5d7]" />

                  <div>
                    <h3 className="text-[15px] font-semibold text-[#e8edf1]">
                      Indicator registry
                    </h3>

                    <p className="mt-1 text-[11px] text-[#657481]">
                      Current IOC intelligence records
                      available for analyst investigation.
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-[11px] font-semibold text-[#dde4e9]">
                    {filteredIndicators.length}{" "}
                    {filteredIndicators.length === 1
                      ? "result"
                      : "results"}
                  </p>

                  <p className="mt-1 text-[9px] uppercase tracking-[0.1em] text-[#53626e]">
                    {hasFilters
                      ? `${allIndicators.length} total indicators`
                      : "CASE//ZERO intelligence"}
                  </p>
                </div>
              </div>

              {filteredIndicators.length === 0 ? (
                <div className="flex min-h-[300px] items-center justify-center px-8 py-16">
                  <div className="max-w-md text-center">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-[#243540] bg-[#0a141c] text-[#71828f]">
                      <SearchIcon />
                    </div>

                    <p className="mt-4 text-[14px] font-medium text-[#dce3e8]">
                      No indicators matched this query
                    </p>

                    <p className="mt-2 text-[12px] leading-5 text-[#657481]">
                      Adjust the intelligence filters or clear
                      the active query to return to the full IOC registry.
                    </p>

                    <Link
                      href="/intelligence"
                      className="mt-5 inline-flex rounded-[8px] border border-[#293a47] px-4 py-2 text-[11px] font-medium text-[#bcc6ce] transition hover:border-[#415260] hover:text-white"
                    >
                      Clear intelligence query
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="min-w-[1220px]">

                    <div className="grid grid-cols-[2.2fr_0.75fr_0.9fr_0.9fr_1fr_1.05fr_1.2fr_110px] gap-5 border-b border-[#192733] bg-[#071019]/70 px-6 py-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#61717e]">
                      <span>
                        Indicator
                      </span>

                      <span>
                        Type
                      </span>

                      <span>
                        Reputation
                      </span>

                      <span>
                        Confidence
                      </span>

                      <span>
                        Source
                      </span>

                      <span>
                        Last seen
                      </span>

                      <span>
                        Tags
                      </span>

                      <span>
                        Record
                      </span>
                    </div>

                    <div className="divide-y divide-[#192733]">
                      {filteredIndicators.map(
                        (indicator) => (
                          <IndicatorRow
                            key={
                              indicator.id
                            }
                            indicator={
                              indicator
                            }
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
    <div className="relative overflow-hidden rounded-[14px] border border-[#1d2c38] bg-[linear-gradient(180deg,rgba(15,28,39,0.98),rgba(11,21,30,0.98))] p-5">
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background:
            `linear-gradient(90deg, ${accent}, transparent 72%)`,
        }}
      />

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
              0.72,
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
  );
}


function IndicatorRow({
  indicator,
}: {
  indicator: ThreatIndicator;
}) {
  const accent =
    getReputationAccent(
      indicator.reputation
    );

  return (
    <div className="grid grid-cols-[2.2fr_0.75fr_0.9fr_0.9fr_1fr_1.05fr_1.2fr_110px] items-center gap-5 px-6 py-5 transition hover:bg-[#101c26]">

      <div className="min-w-0">
        <Link
          href={
            `/intelligence/${indicator.id}`
          }
          className="group block"
        >
          <div className="flex items-center gap-2">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{
                background:
                  accent,
              }}
            />

            <code className="break-all text-[12px] font-semibold text-[#e7edf1] transition group-hover:text-[#8dd9e4]">
              {indicator.value}
            </code>
          </div>

          <p className="mt-2 line-clamp-2 max-w-xl text-[10px] leading-5 text-[#657481]">
            {indicator.description
              ?? "No analyst context recorded for this indicator."}
          </p>
        </Link>
      </div>

      <div>
        <IndicatorTypeBadge
          indicatorType={
            indicator.indicator_type
          }
        />
      </div>

      <div>
        <ReputationBadge
          reputation={
            indicator.reputation
          }
        />
      </div>

      <div>
        <div className="flex items-baseline gap-1">
          <span className="text-[14px] font-semibold text-[#e4e9ed]">
            {indicator.confidence}
          </span>

          <span className="text-[9px] text-[#566572]">
            /100
          </span>
        </div>

        <div className="mt-2 h-1 w-20 overflow-hidden rounded-full bg-[#18242d]">
          <div
            className="h-full rounded-full"
            style={{
              width:
                `${Math.min(
                  Math.max(
                    indicator.confidence,
                    0
                  ),
                  100
                )}%`,
              background:
                getConfidenceAccent(
                  indicator.confidence
                ),
            }}
          />
        </div>
      </div>

      <div className="min-w-0">
        <p className="truncate text-[11px] text-[#bbc6cd]">
          {indicator.source}
        </p>

        <p className="mt-1 text-[8px] uppercase tracking-[0.1em] text-[#53626e]">
          Intelligence source
        </p>
      </div>

      <div>
        <p className="text-[10px] text-[#aab5bd]">
          {formatCompactTime(
            indicator.last_seen
          )}
        </p>

        <p className="mt-1 text-[8px] uppercase tracking-[0.08em] text-[#52616e]">
          Last observation
        </p>
      </div>

      <div className="flex min-w-0 flex-wrap gap-1.5">
        {indicator.tags.length > 0 ? (
          <>
            {indicator.tags
              .slice(0, 3)
              .map(
                (tag) => (
                  <span
                    key={tag}
                    className="max-w-[105px] truncate rounded-[5px] border border-[#283843] bg-[#081119] px-2 py-1 text-[9px] text-[#82909b]"
                  >
                    {tag}
                  </span>
                )
              )}

            {indicator.tags.length > 3 && (
              <span className="rounded-[5px] border border-[#283843] bg-[#081119] px-2 py-1 text-[9px] text-[#71808c]">
                +{
                  indicator.tags.length
                  - 3
                }
              </span>
            )}
          </>
        ) : (
          <span className="text-[10px] text-[#53626e]">
            No tags
          </span>
        )}
      </div>

      <div>
        <Link
          href={
            `/intelligence/${indicator.id}`
          }
          className="inline-flex items-center gap-2 rounded-[7px] border border-[#263743] bg-[#09131b] px-3 py-2 text-[10px] font-semibold text-[#b9c4cc] transition hover:border-[#536672] hover:text-white"
        >
          Inspect
          <span className="text-[#c9a965]">
            →
          </span>
        </Link>
      </div>
    </div>
  );
}


function QueryChip({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-[6px] border border-[#3c3524] bg-[#c9a965]/[0.045] px-3 py-1.5 text-[9px]">
      <span className="uppercase tracking-[0.08em] text-[#817351]">
        {label}
      </span>

      <span className="font-medium text-[#d8bd78]">
        {value}
      </span>
    </span>
  );
}


function IndicatorTypeBadge({
  indicatorType,
}: {
  indicatorType: string;
}) {
  const normalized =
    indicatorType.toLowerCase();

  const styles: Record<
    string,
    string
  > = {
    ip:
      "border-[#284258] bg-[#132235] text-[#8ab7ec]",

    domain:
      "border-[#3c3559] bg-[#211a37] text-[#b29ae8]",

    url:
      "border-[#27504c] bg-[#102b28] text-[#79cdbf]",

    hash:
      "border-[#524125] bg-[#2b2112] text-[#d4b16c]",
  };

  return (
    <span
      className={`inline-flex rounded-[5px] border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.04em] ${
        styles[normalized]
        ?? "border-[#33434f] bg-[#17212a] text-[#9aa7b1]"
      }`}
    >
      {formatIndicatorType(
        indicatorType
      )}
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
      "border-[#673239] bg-[#32161b] text-[#ef8585]",

    suspicious:
      "border-[#624225] bg-[#301f12] text-[#e5a66e]",

    unknown:
      "border-[#374550] bg-[#172129] text-[#96a3ad]",

    benign:
      "border-[#285245] bg-[#112a23] text-[#78d0aa]",
  };

  return (
    <span
      className={`inline-flex rounded-[5px] border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.04em] ${
        styles[normalized]
        ?? "border-[#374550] bg-[#172129] text-[#96a3ad]"
      }`}
    >
      {reputation}
    </span>
  );
}


function SearchIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="11"
        cy="11"
        r="6.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />

      <path
        d="M16 16L20 20"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}


function getLatestIndicatorTime(
  timestamps: string[]
) {
  if (
    timestamps.length === 0
  ) {
    return null;
  }

  const validDates =
    timestamps
      .map(
        (timestamp) =>
          new Date(timestamp)
      )
      .filter(
        (date) =>
          !Number.isNaN(
            date.getTime()
          )
      );

  if (
    validDates.length === 0
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


function getReputationAccent(
  reputation: string
) {
  switch (
    reputation.toLowerCase()
  ) {
    case "malicious":
      return "#df7171";

    case "suspicious":
      return "#d99a5e";

    case "benign":
      return "#69c59f";

    default:
      return "#758591";
  }
}


function getConfidenceAccent(
  confidence: number
) {
  if (
    confidence >= 80
  ) {
    return "#69c59f";
  }

  if (
    confidence >= 50
  ) {
    return "#d5b35f";
  }

  return "#7e8b96";
}


function formatIndicatorType(
  indicatorType: string
) {
  const normalized =
    indicatorType.toLowerCase();

  const labels: Record<
    string,
    string
  > = {
    ip:
      "IP",

    domain:
      "Domain",

    url:
      "URL",

    hash:
      "Hash",
  };

  return (
    labels[normalized]
    ?? formatLabel(
      indicatorType
    )
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


function formatCompactTime(
  timestamp: string
) {
  const date =
    new Date(timestamp);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Unavailable";
  }

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
    date
  );
}