"use client";

import Link from "next/link";

import {
  useMemo,
  useState,
} from "react";

import type {
  SecurityEvent,
} from "@/lib/api";


export default function EventExplorerClient({
  events,
}: {
  events: SecurityEvent[];
}) {
  const [
    searchQuery,
    setSearchQuery,
  ] = useState("");

  const [
    selectedType,
    setSelectedType,
  ] = useState("all");

  const [
    selectedSource,
    setSelectedSource,
  ] = useState("all");

  const eventTypes =
    useMemo(
      () =>
        Array.from(
          new Set(
            events.map(
              (event) =>
                event.event_type
            )
          )
        ).sort(),
      [
        events,
      ]
    );

  const sources =
    useMemo(
      () =>
        Array.from(
          new Set(
            events
              .map(
                (event) =>
                  event.source
              )
              .filter(Boolean)
          )
        ).sort(),
      [
        events,
      ]
    );

  const filteredEvents =
    useMemo(
      () => {
        const normalizedSearch =
          searchQuery
            .trim()
            .toLowerCase();

        return events.filter(
          (event) => {
            const matchesType =
              selectedType === "all"
              || event.event_type
                === selectedType;

            const matchesSource =
              selectedSource === "all"
              || event.source
                === selectedSource;

            if (
              !matchesType
              || !matchesSource
            ) {
              return false;
            }

            if (
              !normalizedSearch
            ) {
              return true;
            }

            const searchableValues =
              [
                event.event_type,
                event.source,
                event.hostname,
                event.username,
                event.process_name,
                event.command_line,
                event.source_ip,
                event.destination_ip,
                String(
                  event.id
                ),
              ];

            return searchableValues
              .filter(Boolean)
              .some(
                (value) =>
                  String(
                    value
                  )
                    .toLowerCase()
                    .includes(
                      normalizedSearch
                    )
              );
          }
        );
      },
      [
        events,
        searchQuery,
        selectedType,
        selectedSource,
      ]
    );

  const activeFilterCount =
    [
      searchQuery.trim()
        ? 1
        : 0,

      selectedType !== "all"
        ? 1
        : 0,

      selectedSource !== "all"
        ? 1
        : 0,
    ].reduce(
      (
        total,
        value
      ) =>
        total + value,
      0
    );

  function clearFilters() {
    setSearchQuery("");
    setSelectedType("all");
    setSelectedSource("all");
  }

  return (
    <div className="cz-panel overflow-hidden">

      {/* Explorer header */}
      <div className="border-b border-white/[0.055] px-6 py-5">

        <div className="flex items-center justify-between gap-8">

          <div>

            <div className="flex items-center gap-2.5">

              <span className="h-2 w-2 rounded-full bg-[#69c5d7]" />

              <h3 className="text-[16px] font-medium text-[#e7ecf0]">
                Event stream
              </h3>

            </div>

            <p className="mt-1.5 pl-[18px] text-[11px] text-[#6b7a87]">
              Investigate normalized telemetry
              captured by CASE//ZERO
            </p>

          </div>

          <div className="text-right">

            <p className="text-[11px] font-medium text-[#b6c0c8]">
              {
                filteredEvents.length
              } results
            </p>

            <p className="mt-1 text-[9px] uppercase tracking-[0.08em] text-[#5e6d79]">
              {
                events.length
              } total events
            </p>

          </div>

        </div>

      </div>

      {/* Filter toolbar */}
      <div className="border-b border-white/[0.055] bg-[#09121b]/75 px-6 py-4">

        <div className="flex flex-wrap items-center gap-3">

          {/* Search */}
          <div className="relative min-w-[280px] flex-1">

            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5e6d79]"
            >
              <circle
                cx="11"
                cy="11"
                r="7"
              />

              <path
                d="m20 20-3.8-3.8"
              />
            </svg>

            <input
              type="search"
              value={
                searchQuery
              }
              onChange={
                (
                  event
                ) =>
                  setSearchQuery(
                    event.target.value
                  )
              }
              placeholder="Search host, user, process, IP, command line..."
              className="cz-focus-ring h-10 w-full rounded-[9px] border border-white/[0.075] bg-[#0a141e] pl-10 pr-4 text-[11px] text-[#d8e0e6] outline-none transition placeholder:text-[#54636f] hover:border-white/[0.12] focus:border-[#69c5d7]/35"
            />

          </div>

          {/* Event type */}
          <select
            value={
              selectedType
            }
            onChange={
              (
                event
              ) =>
                setSelectedType(
                  event.target.value
                )
            }
            className="cz-focus-ring h-10 min-w-[170px] rounded-[9px] border border-white/[0.075] bg-[#0a141e] px-3 text-[11px] text-[#aeb9c2] outline-none transition hover:border-white/[0.12]"
          >

            <option value="all">
              All event types
            </option>

            {
              eventTypes.map(
                (
                  eventType
                ) => (
                  <option
                    key={
                      eventType
                    }
                    value={
                      eventType
                    }
                  >
                    {
                      formatLabel(
                        eventType
                      )
                    }
                  </option>
                )
              )
            }

          </select>

          {/* Source */}
          <select
            value={
              selectedSource
            }
            onChange={
              (
                event
              ) =>
                setSelectedSource(
                  event.target.value
                )
            }
            className="cz-focus-ring h-10 min-w-[150px] rounded-[9px] border border-white/[0.075] bg-[#0a141e] px-3 text-[11px] text-[#aeb9c2] outline-none transition hover:border-white/[0.12]"
          >

            <option value="all">
              All sources
            </option>

            {
              sources.map(
                (
                  source
                ) => (
                  <option
                    key={
                      source
                    }
                    value={
                      source
                    }
                  >
                    {
                      formatLabel(
                        source
                      )
                    }
                  </option>
                )
              )
            }

          </select>

          {
            activeFilterCount > 0 && (
              <button
                type="button"
                onClick={
                  clearFilters
                }
                className="cz-focus-ring h-10 rounded-[9px] border border-[#c9a965]/15 bg-[#c9a965]/[0.045] px-4 text-[10px] font-medium text-[#cdb16f] transition hover:border-[#c9a965]/30 hover:bg-[#c9a965]/[0.08]"
              >
                Clear {
                  activeFilterCount
                } filter{
                  activeFilterCount === 1
                    ? ""
                    : "s"
                }
              </button>
            )
          }

        </div>

      </div>

      {/* Empty state */}
      {
        filteredEvents.length === 0 ? (
          <div className="flex min-h-[420px] items-center justify-center">

            <div className="max-w-sm text-center">

              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-[10px] border border-white/[0.07] bg-white/[0.025]">

                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="h-5 w-5 text-[#657481]"
                >
                  <circle
                    cx="11"
                    cy="11"
                    r="7"
                  />

                  <path
                    d="m20 20-3.8-3.8"
                  />
                </svg>

              </div>

              <p className="mt-4 text-[13px] font-medium text-[#b4bec6]">
                No matching events
              </p>

              <p className="mt-2 text-[11px] leading-5 text-[#657481]">
                Adjust your search or
                remove one of the active
                filters.
              </p>

              <button
                type="button"
                onClick={
                  clearFilters
                }
                className="mt-4 text-[11px] font-medium text-[#c9a965] transition hover:text-[#e0c17b]"
              >
                Reset event explorer
              </button>

            </div>

          </div>
        ) : (
          <>

            {/* Desktop table */}
            <div className="hidden xl:block">

              <div className="grid grid-cols-[130px_155px_minmax(260px,1fr)_140px_230px_160px] gap-5 border-b border-white/[0.045] bg-[#08111a]/70 px-6 py-3.5">

                <span className="cz-table-head">
                  Time
                </span>

                <span className="cz-table-head">
                  Event type
                </span>

                <span className="cz-table-head">
                  Activity
                </span>

                <span className="cz-table-head">
                  Source
                </span>

                <span className="cz-table-head">
                  Identity / host
                </span>

                <span className="cz-table-head">
                  Network
                </span>

              </div>

              <div className="divide-y divide-white/[0.05]">

                {
                  filteredEvents.map(
                    (
                      event
                    ) => (
                      <SecurityEventRow
                        key={
                          event.id
                        }
                        event={
                          event
                        }
                      />
                    )
                  )
                }

              </div>

            </div>

            {/* Smaller screens */}
            <div className="divide-y divide-white/[0.05] xl:hidden">

              {
                filteredEvents.map(
                  (
                    event
                  ) => (
                    <SecurityEventMobileRow
                      key={
                        event.id
                      }
                      event={
                        event
                      }
                    />
                  )
                )
              }

            </div>

          </>
        )
      }

      {/* Footer */}
      {
        filteredEvents.length > 0 && (
          <div className="flex items-center justify-between border-t border-white/[0.055] bg-[#09121b]/60 px-6 py-4">

            <p className="text-[10px] text-[#61707d]">
              Showing {
                filteredEvents.length
              } of {
                events.length
              } events
            </p>

            <div className="flex items-center gap-2">

              <span className="h-1.5 w-1.5 rounded-full bg-[#63cfa4]" />

              <span className="text-[10px] text-[#668c7d]">
                Telemetry pipeline active
              </span>

            </div>

          </div>
        )
      }

    </div>
  );
}


function SecurityEventRow({
  event,
}: {
  event: SecurityEvent;
}) {
  return (
    <Link
      href={
        `/events/${event.id}`
      }
      className="cz-interactive-row group grid grid-cols-[130px_155px_minmax(260px,1fr)_140px_230px_160px] items-center gap-5 px-6 py-[17px]"
    >

      {/* Time */}
      <div>

        <p className="cz-mono text-[11px] text-[#a9b4bd]">
          {
            formatEventTimeOnly(
              event.event_time
            )
          }
        </p>

        <p className="mt-1 text-[9px] text-[#5f6e7b]">
          {
            formatEventDate(
              event.event_time
            )
          }
        </p>

      </div>

      {/* Type */}
      <EventTypeBadge
        eventType={
          event.event_type
        }
      />

      {/* Activity */}
      <div className="min-w-0">

        <div className="flex items-center gap-2">

          <p className="truncate text-[12px] font-medium text-[#dce3e8] group-hover:text-white">
            {
              getEventTitle(
                event
              )
            }
          </p>

          <span className="text-[10px] text-[#485763] opacity-0 transition group-hover:opacity-100">
            →
          </span>

        </div>

        <p className="cz-mono mt-1 truncate text-[9px] text-[#657481]">
          {
            getEventDescription(
              event
            )
          }
        </p>

      </div>

      {/* Source */}
      <div>

        <p className="text-[11px] font-medium text-[#9ba7b1]">
          {
            formatLabel(
              event.source
            )
          }
        </p>

      </div>

      {/* Identity */}
      <div className="min-w-0">

        <p className="truncate text-[11px] font-medium text-[#c6ced5]">
          {
            event.hostname
            ?? "Unknown host"
          }
        </p>

        <p className="mt-1 truncate text-[9px] text-[#63727f]">
          {
            event.username
            ?? "Unknown user"
          }
        </p>

      </div>

      {/* Network */}
      <div className="min-w-0">

        {
          event.source_ip ? (
            <>
              <p className="cz-mono truncate text-[10px] text-[#82919d]">
                {
                  event.source_ip
                }
              </p>

              {
                event.destination_ip && (
                  <p className="cz-mono mt-1 truncate text-[9px] text-[#53626e]">
                    → {
                      event.destination_ip
                    }
                  </p>
                )
              }
            </>
          ) : (
            <span className="text-[10px] text-[#4e5d69]">
              —
            </span>
          )
        }

      </div>

    </Link>
  );
}


function SecurityEventMobileRow({
  event,
}: {
  event: SecurityEvent;
}) {
  return (
    <Link
      href={
        `/events/${event.id}`
      }
      className="cz-interactive-row block px-5 py-5"
    >

      <div className="flex items-start justify-between gap-5">

        <div className="min-w-0">

          <div className="mb-2 flex items-center gap-3">

            <EventTypeBadge
              eventType={
                event.event_type
              }
            />

            <span className="cz-mono text-[9px] text-[#61707d]">
              {
                formatEventTimeOnly(
                  event.event_time
                )
              }
            </span>

          </div>

          <p className="truncate text-[12px] font-medium text-[#dce3e8]">
            {
              getEventTitle(
                event
              )
            }
          </p>

          <p className="cz-mono mt-1 truncate text-[9px] text-[#657481]">
            {
              getEventDescription(
                event
              )
            }
          </p>

          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">

            <EventDetail
              label="Source"
              value={
                formatLabel(
                  event.source
                )
              }
            />

            <EventDetail
              label="Host"
              value={
                event.hostname
                ?? "Unknown"
              }
            />

            <EventDetail
              label="User"
              value={
                event.username
                ?? "Unknown"
              }
            />

          </div>

        </div>

        <span className="text-[#667583]">
          →
        </span>

      </div>

    </Link>
  );
}


function EventDetail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>

      <p className="text-[8px] font-semibold uppercase tracking-[0.07em] text-[#4f5e6a]">
        {label}
      </p>

      <p className="mt-1 text-[10px] text-[#8795a0]">
        {value}
      </p>

    </div>
  );
}


function EventTypeBadge({
  eventType,
}: {
  eventType: string;
}) {
  const normalized =
    eventType.toLowerCase();

  const styles: Record<
    string,
    {
      dot: string;
      badge: string;
    }
  > = {
    process_creation: {
      dot:
        "bg-[#c9a965]",

      badge:
        "border-[#c9a965]/15 bg-[#c9a965]/[0.055] text-[#d3b66f]",
    },

    authentication: {
      dot:
        "bg-[#739bd3]",

      badge:
        "border-[#739bd3]/15 bg-[#739bd3]/[0.055] text-[#88aee0]",
    },

    network_connection: {
      dot:
        "bg-[#69c5d7]",

      badge:
        "border-[#69c5d7]/15 bg-[#69c5d7]/[0.055] text-[#82d0dd]",
    },

    file_creation: {
      dot:
        "bg-[#d98c55]",

      badge:
        "border-[#d98c55]/15 bg-[#d98c55]/[0.055] text-[#df9d6c]",
    },
  };

  const style =
    styles[
      normalized
    ] ?? {
      dot:
        "bg-[#75838f]",

      badge:
        "border-white/[0.07] bg-white/[0.035] text-[#8f9ba5]",
    };

  return (
    <span
      className={`inline-flex w-fit items-center gap-2 rounded-[6px] border px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.045em] ${style.badge}`}
    >

      <span
        className={`h-1.5 w-1.5 rounded-full ${style.dot}`}
      />

      {
        formatLabel(
          eventType
        )
      }

    </span>
  );
}


function getEventTitle(
  event: SecurityEvent
) {
  const eventType =
    event.event_type
      .toLowerCase();

  if (
    eventType
    === "process_creation"
  ) {
    return (
      event.process_name
      ?? "Process creation"
    );
  }

  if (
    eventType
    === "authentication"
  ) {
    return "Authentication activity";
  }

  if (
    eventType
    === "network_connection"
  ) {
    return "Network connection";
  }

  if (
    eventType
    === "file_creation"
  ) {
    return "File creation";
  }

  return formatLabel(
    event.event_type
  );
}


function getEventDescription(
  event: SecurityEvent
) {
  if (
    event.command_line
  ) {
    return event.command_line;
  }

  if (
    event.source_ip
    && event.destination_ip
  ) {
    return (
      `${event.source_ip} → ${event.destination_ip}`
    );
  }

  if (
    event.source_ip
  ) {
    return (
      `Source IP: ${event.source_ip}`
    );
  }

  return (
    `Event ID: ${event.id}`
  );
}


function formatLabel(
  value: string
) {
  if (!value) {
    return value;
  }

  return value
    .replaceAll(
      "_",
      " "
    )
    .replace(
      /\b\w/g,
      (
        character
      ) =>
        character.toUpperCase()
    );
}


function formatEventTimeOnly(
  timestamp: string
) {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      hour:
        "numeric",
      minute:
        "2-digit",
      second:
        "2-digit",
    }
  ).format(
    new Date(
      timestamp
    )
  );
}


function formatEventDate(
  timestamp: string
) {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      month:
        "short",
      day:
        "numeric",
    }
  ).format(
    new Date(
      timestamp
    )
  );
}