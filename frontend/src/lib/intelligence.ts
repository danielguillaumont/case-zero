import type {
  SecurityEvent,
  ThreatIndicator,
} from "@/lib/api";


export type ThreatIndicatorMatch = {
  indicator: ThreatIndicator;
  matchedFields: string[];
};


export function matchThreatIndicatorsToEvent(
  event: SecurityEvent,
  indicators: ThreatIndicator[]
): ThreatIndicatorMatch[] {
  const commandLine =
    (
      event.command_line
      ?? ""
    ).toLowerCase();

  const rawData =
    JSON.stringify(
      event.raw_data
      ?? {}
    ).toLowerCase();

  const matches:
    ThreatIndicatorMatch[] = [];

  for (const indicator of indicators) {
    const indicatorValue =
      indicator.value.trim();

    if (!indicatorValue) {
      continue;
    }

    const normalizedValue =
      indicatorValue.toLowerCase();

    const matchedFields =
      new Set<string>();


    if (
      indicator.indicator_type
      === "ip"
    ) {
      if (
        event.source_ip
        === indicatorValue
      ) {
        matchedFields.add(
          "source_ip"
        );
      }

      if (
        event.destination_ip
        === indicatorValue
      ) {
        matchedFields.add(
          "destination_ip"
        );
      }
    }


    if (
      commandLine.includes(
        normalizedValue
      )
    ) {
      matchedFields.add(
        "command_line"
      );
    }


    if (
      rawData.includes(
        normalizedValue
      )
    ) {
      matchedFields.add(
        "raw_data"
      );
    }


    if (
      matchedFields.size > 0
    ) {
      matches.push({
        indicator,
        matchedFields:
          Array.from(
            matchedFields
          ),
      });
    }
  }


  return matches.sort(
    (
      firstMatch,
      secondMatch
    ) =>
      secondMatch.indicator.confidence
      -
      firstMatch.indicator.confidence
  );
}