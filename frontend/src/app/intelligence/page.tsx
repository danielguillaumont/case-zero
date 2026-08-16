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
  searchParams:
    Promise<IntelligenceSearchParams>;
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
        indicator.reputation
        === "malicious"
    ).length;

  const suspiciousCount =
    allIndicators.filter(
      (indicator) =>
        indicator.reputation
        === "suspicious"
    ).length;

  const highConfidenceCount =
    allIndicators.filter(
      (indicator) =>
        indicator.confidence >= 80
    ).length;

  const metrics = [
    {
      label: "Total Indicators",
      value: allIndicators.length,
    },
    {
      label: "Malicious",
      value: maliciousCount,
    },
    {
      label: "Suspicious",
      value: suspiciousCount,
    },
    {
      label: "High Confidence",
      value: highConfidenceCount,
    },
  ];

  const hasFilters =
    Boolean(
      search
      || indicatorType
      || reputation
      || source
    );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">

      <div className="flex min-h-screen">

        <Sidebar />

        <main className="flex-1 p-10">

          {/* Header */}
          <header className="mb-10 flex items-start justify-between gap-6">

            <div>

              <p className="text-sm text-emerald-400">
                CASE//ZERO
              </p>

              <h2 className="mt-1 text-3xl font-semibold">
                Threat Intelligence
              </h2>

              <p className="mt-2 text-sm text-zinc-500">
                Search, classify, and review indicators of compromise tracked by CASE//ZERO.
              </p>

            </div>

            <div className="rounded-full border border-emerald-900 bg-emerald-950 px-4 py-2 text-sm text-emerald-400">
              IOC Registry Active
            </div>

          </header>

          {/* Metrics */}
          <section>

            <p className="mb-4 text-xs uppercase tracking-[0.15em] text-zinc-500">
              Intelligence Overview
            </p>

            <div className="grid grid-cols-4 gap-4">

              {metrics.map(
                (metric) => (
                  <MetricCard
                    key={metric.label}
                    label={metric.label}
                    value={metric.value}
                  />
                )
              )}

            </div>

          </section>

          {/* Search */}
          <section className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900">

            <div className="border-b border-zinc-800 px-6 py-5">

              <h3 className="font-medium">
                Indicator Search
              </h3>

              <p className="mt-1 text-sm text-zinc-500">
                Search the CASE//ZERO intelligence registry by IOC value, type, reputation, or source.
              </p>

            </div>

            <form
              method="GET"
              className="p-6"
            >

              <div className="grid grid-cols-4 gap-4">

                <div className="col-span-2">

                  <label
                    htmlFor="search"
                    className="text-xs uppercase tracking-wider text-zinc-500"
                  >
                    Search
                  </label>

                  <input
                    id="search"
                    name="search"
                    defaultValue={search}
                    placeholder="IP, domain, URL, hash, source..."
                    className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-200 outline-none transition placeholder:text-zinc-600 focus:border-emerald-700"
                  />

                </div>

                <div>

                  <label
                    htmlFor="indicator_type"
                    className="text-xs uppercase tracking-wider text-zinc-500"
                  >
                    Indicator Type
                  </label>

                  <select
                    id="indicator_type"
                    name="indicator_type"
                    defaultValue={
                      indicatorType
                    }
                    className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-300 outline-none transition focus:border-emerald-700"
                  >
                    <option value="">
                      All Types
                    </option>

                    <option value="ip">
                      IP Address
                    </option>

                    <option value="domain">
                      Domain
                    </option>

                    <option value="url">
                      URL
                    </option>

                    <option value="hash">
                      File Hash
                    </option>

                  </select>

                </div>

                <div>

                  <label
                    htmlFor="reputation"
                    className="text-xs uppercase tracking-wider text-zinc-500"
                  >
                    Reputation
                  </label>

                  <select
                    id="reputation"
                    name="reputation"
                    defaultValue={
                      reputation
                    }
                    className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-300 outline-none transition focus:border-emerald-700"
                  >
                    <option value="">
                      All Reputations
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

              <div className="mt-4 grid grid-cols-4 gap-4">

                <div className="col-span-2">

                  <label
                    htmlFor="source"
                    className="text-xs uppercase tracking-wider text-zinc-500"
                  >
                    Intelligence Source
                  </label>

                  <input
                    id="source"
                    name="source"
                    defaultValue={source}
                    placeholder="e.g. case-zero-lab"
                    className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-200 outline-none transition placeholder:text-zinc-600 focus:border-emerald-700"
                  />

                </div>

                <div className="col-span-2 flex items-end gap-3">

                  <button
                    type="submit"
                    className="rounded-lg border border-emerald-800 bg-emerald-950 px-5 py-3 text-sm font-medium text-emerald-400 transition hover:bg-emerald-900"
                  >
                    Search Intelligence
                  </button>

                  <Link
                    href="/intelligence"
                    className="rounded-lg border border-zinc-700 bg-zinc-800 px-5 py-3 text-sm font-medium text-zinc-300 transition hover:bg-zinc-700"
                  >
                    Clear
                  </Link>

                </div>

              </div>

            </form>

          </section>

          {/* IOC Registry */}
          <section className="mt-8 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">

            <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-5">

              <div>

                <h3 className="font-medium">
                  Indicator Registry
                </h3>

                <p className="mt-1 text-sm text-zinc-500">
                  IOC records currently tracked by CASE//ZERO.
                </p>

              </div>

              <div className="text-right">

                <p className="text-sm font-medium text-zinc-300">
                  {
                    filteredIndicators.length
                  }{" "}
                  {
                    filteredIndicators.length
                    === 1
                      ? "indicator"
                      : "indicators"
                  }
                </p>

                {hasFilters && (
                  <p className="mt-1 text-xs text-zinc-600">
                    Filtered results
                  </p>
                )}

              </div>

            </div>

            {filteredIndicators.length
              === 0 ? (
              <div className="px-6 py-16 text-center">

                <p className="text-sm font-medium text-zinc-300">
                  No threat indicators found
                </p>

                <p className="mt-2 text-sm text-zinc-500">
                  Try adjusting the search criteria or add intelligence through the CASE//ZERO API.
                </p>

              </div>
            ) : (
              <div className="overflow-x-auto">

                <table className="w-full">

                  <thead className="border-b border-zinc-800 bg-zinc-950/60">

                    <tr className="text-left text-xs uppercase tracking-wider text-zinc-500">

                      <th className="px-6 py-4 font-medium">
                        Indicator
                      </th>

                      <th className="px-6 py-4 font-medium">
                        Type
                      </th>

                      <th className="px-6 py-4 font-medium">
                        Reputation
                      </th>

                      <th className="px-6 py-4 font-medium">
                        Confidence
                      </th>

                      <th className="px-6 py-4 font-medium">
                        Source
                      </th>

                      <th className="px-6 py-4 font-medium">
                        Last Seen
                      </th>

                      <th className="px-6 py-4 font-medium">
                        Tags
                      </th>

                      <th className="px-6 py-4 font-medium">
                        Action
                      </th>

                    </tr>

                  </thead>

                  <tbody className="divide-y divide-zinc-800">

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

                  </tbody>

                </table>

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

      <p className="mt-3 text-3xl font-semibold">
        {value}
      </p>

    </div>
  );
}


function IndicatorRow({
  indicator,
}: {
  indicator: ThreatIndicator;
}) {
  return (
    <tr className="transition hover:bg-zinc-800/30">

      <td className="px-6 py-5">

        <Link
          href={`/intelligence/${indicator.id}`}
          className="break-all font-mono text-sm font-medium text-emerald-400 transition hover:text-emerald-300"
        >
          {indicator.value} &rarr;
        </Link>

        {indicator.description && (
          <p className="mt-2 max-w-md text-xs leading-5 text-zinc-600">
            {indicator.description}
          </p>
        )}

      </td>

      <td className="px-6 py-5">

        <IndicatorTypeBadge
          indicatorType={
            indicator.indicator_type
          }
        />

      </td>

      <td className="px-6 py-5">

        <ReputationBadge
          reputation={
            indicator.reputation
          }
        />

      </td>

      <td className="px-6 py-5">

        <div className="flex items-center gap-3">

          <span className="text-sm font-medium text-zinc-200">
            {indicator.confidence}
          </span>

          <span className="text-xs text-zinc-600">
            / 100
          </span>

        </div>

      </td>

      <td className="px-6 py-5">

        <span className="text-sm text-zinc-400">
          {indicator.source}
        </span>

      </td>

      <td className="px-6 py-5">

        <span className="text-sm text-zinc-400">
          {formatIndicatorTime(
            indicator.last_seen
          )}
        </span>

      </td>

      <td className="px-6 py-5">

        <div className="flex max-w-xs flex-wrap gap-2">

          {indicator.tags.length > 0 ? (
            indicator.tags.map(
              (tag) => (
                <span
                  key={tag}
                  className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-400"
                >
                  {tag}
                </span>
              )
            )
          ) : (
            <span className="text-xs text-zinc-600">
              No tags
            </span>
          )}

        </div>

      </td>

      <td className="px-6 py-5">

        <Link
          href={`/intelligence/${indicator.id}`}
          className="inline-flex rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:border-emerald-800 hover:bg-emerald-950 hover:text-emerald-400"
        >
          View Details &rarr;
        </Link>

      </td>

    </tr>
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


function formatIndicatorTime(
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