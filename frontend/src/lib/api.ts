import {
  getAuthorizationHeaders,
} from "@/lib/auth";


const API_BASE_URL =
  process.env.CASE_ZERO_API_URL
  ?? "http://127.0.0.1:8000";


export type HealthStatus = {
  status: string;
  service: string;
  version: string;
  database: string;
};


export type Alert = {
  id: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  source: string;
  detection_rule_id: string | null;
  assigned_analyst: string | null;
  case_id: string | null;
  source_event_id: string | null;
  created_at: string;
  updated_at: string;
};


export type SecurityEvent = {
  id: string;
  event_type: string;
  source: string;
  event_time: string;
  hostname: string | null;
  username: string | null;
  source_ip: string | null;
  destination_ip: string | null;
  process_name: string | null;
  command_line: string | null;
  raw_data: Record<string, unknown> | null;
  created_at: string;
};


export type MitreAttackMapping = {
  technique_id: string;
  technique_name: string;
  tactic_id: string;
  tactic_name: string;
};


export type DetectionRule = {
  id: string;
  name: string;
  description: string;
  severity: string;
  rule_type:
    | "single_event"
    | "correlation";
  enabled: boolean;
  event_type: string;
  logic: string;
  mitre_attack: MitreAttackMapping[];
};


export type HuntQuery = {
  event_type?: string | null;
  source?: string | null;
  hostname?: string | null;
  username?: string | null;
  source_ip?: string | null;
  process_name?: string | null;
  contains?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  limit?: number;
};


export type PlaybookStep = {
  id: string;
  order: number;
  title: string;
  description: string;
  category:
    | "triage"
    | "investigation"
    | "containment"
    | "eradication"
    | "recovery"
    | "documentation";
};


export type Playbook = {
  id: string;
  name: string;
  description: string;
  severity: string;
  enabled: boolean;
  trigger_rule_ids: string[];
  steps: PlaybookStep[];
};


export type ThreatIndicator = {
  id: string;
  indicator_type:
    | "ip"
    | "domain"
    | "url"
    | "hash";
  value: string;
  reputation:
    | "benign"
    | "unknown"
    | "suspicious"
    | "malicious";
  confidence: number;
  source: string;
  description: string | null;
  tags: string[];
  first_seen: string;
  last_seen: string;
  created_at: string;
  updated_at: string;
};


export type ThreatIndicatorQuery = {
  indicator_type?: string | null;
  reputation?: string | null;
  source?: string | null;
  search?: string | null;
  limit?: number;
};


export type Case = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigned_analyst: string | null;
  created_at: string;
  updated_at: string;
};


export type CaseAlert = {
  id: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  source: string;
  assigned_analyst: string | null;
  created_at: string;
  updated_at: string;
};


export type CaseDetail = Case & {
  alerts: CaseAlert[];
};


export type CaseNote = {
  id: string;
  case_id: string;
  author: string;
  content: string;
  created_at: string;
};


export type CaseActivity = {
  id: string;
  case_id: string;
  event_type: string;
  actor: string | null;
  message: string;
  created_at: string;
};


async function apiFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const authorizationHeaders =
    await getAuthorizationHeaders();

  const headers =
    new Headers(
      init.headers
    );

  for (
    const [key, value]
    of Object.entries(
      authorizationHeaders
    )
  ) {
    headers.set(
      key,
      value
    );
  }

  return fetch(
    `${API_BASE_URL}${path}`,
    {
      ...init,
      headers,
      cache: "no-store",
    }
  );
}


export async function getApiHealth():
Promise<HealthStatus | null> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/health`,
      {
        cache: "no-store",
      }
    );

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}


export async function getAlerts():
Promise<Alert[]> {
  try {
    const response =
      await apiFetch(
        "/api/alerts"
      );

    if (!response.ok) {
      return [];
    }

    return await response.json();
  } catch {
    return [];
  }
}


export async function getAlert(
  alertId: string
): Promise<Alert | null> {
  try {
    const response =
      await apiFetch(
        `/api/alerts/${alertId}`
      );

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}


export async function getSecurityEvents():
Promise<SecurityEvent[]> {
  try {
    const response =
      await apiFetch(
        "/api/events"
      );

    if (!response.ok) {
      return [];
    }

    return await response.json();
  } catch {
    return [];
  }
}


export async function getSecurityEvent(
  eventId: string
): Promise<SecurityEvent | null> {
  try {
    const response =
      await apiFetch(
        `/api/events/${eventId}`
      );

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}


export async function getDetectionRules():
Promise<DetectionRule[]> {
  try {
    const response =
      await apiFetch(
        "/api/rules"
      );

    if (!response.ok) {
      return [];
    }

    return await response.json();
  } catch {
    return [];
  }
}


export async function getDetectionRule(
  ruleId: string
): Promise<DetectionRule | null> {
  try {
    const response =
      await apiFetch(
        `/api/rules/${ruleId}`
      );

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}


export async function huntSecurityEvents(
  huntQuery: HuntQuery
): Promise<SecurityEvent[]> {
  try {
    const response =
      await apiFetch(
        "/api/hunt",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            event_type:
              huntQuery.event_type
              ?? null,

            source:
              huntQuery.source
              ?? null,

            hostname:
              huntQuery.hostname
              ?? null,

            username:
              huntQuery.username
              ?? null,

            source_ip:
              huntQuery.source_ip
              ?? null,

            process_name:
              huntQuery.process_name
              ?? null,

            contains:
              huntQuery.contains
              ?? null,

            start_time:
              huntQuery.start_time
              ?? null,

            end_time:
              huntQuery.end_time
              ?? null,

            limit:
              huntQuery.limit
              ?? 100,
          }),
        }
      );

    if (!response.ok) {
      return [];
    }

    return await response.json();
  } catch {
    return [];
  }
}


export async function getPlaybooks():
Promise<Playbook[]> {
  try {
    const response =
      await apiFetch(
        "/api/playbooks"
      );

    if (!response.ok) {
      return [];
    }

    return await response.json();
  } catch {
    return [];
  }
}


export async function getPlaybook(
  playbookId: string
): Promise<Playbook | null> {
  try {
    const response =
      await apiFetch(
        `/api/playbooks/${playbookId}`
      );

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}


export async function getPlaybooksForRule(
  ruleId: string
): Promise<Playbook[]> {
  try {
    const response =
      await apiFetch(
        `/api/playbooks/rule/${ruleId}`
      );

    if (!response.ok) {
      return [];
    }

    return await response.json();
  } catch {
    return [];
  }
}


export async function getThreatIndicators(
  query: ThreatIndicatorQuery = {}
): Promise<ThreatIndicator[]> {
  try {
    const searchParams =
      new URLSearchParams();

    if (query.indicator_type) {
      searchParams.set(
        "indicator_type",
        query.indicator_type
      );
    }

    if (query.reputation) {
      searchParams.set(
        "reputation",
        query.reputation
      );
    }

    if (query.source) {
      searchParams.set(
        "source",
        query.source
      );
    }

    if (query.search) {
      searchParams.set(
        "search",
        query.search
      );
    }

    searchParams.set(
      "limit",
      String(
        query.limit ?? 100
      )
    );

    const response =
      await apiFetch(
        (
          "/api/intelligence?"
          + searchParams.toString()
        )
      );

    if (!response.ok) {
      return [];
    }

    return await response.json();
  } catch {
    return [];
  }
}


export async function getThreatIndicator(
  indicatorId: string
): Promise<ThreatIndicator | null> {
  try {
    const response =
      await apiFetch(
        `/api/intelligence/${indicatorId}`
      );

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}


export async function getCases():
Promise<Case[]> {
  try {
    const response =
      await apiFetch(
        "/api/cases"
      );

    if (!response.ok) {
      return [];
    }

    return await response.json();
  } catch {
    return [];
  }
}


export async function getCase(
  caseId: string
): Promise<CaseDetail | null> {
  try {
    const response =
      await apiFetch(
        `/api/cases/${caseId}`
      );

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}


export async function getCaseNotes(
  caseId: string
): Promise<CaseNote[]> {
  try {
    const response =
      await apiFetch(
        `/api/cases/${caseId}/notes`
      );

    if (!response.ok) {
      return [];
    }

    return await response.json();
  } catch {
    return [];
  }
}


export async function getCaseActivities(
  caseId: string
): Promise<CaseActivity[]> {
  try {
    const response =
      await apiFetch(
        `/api/cases/${caseId}/activities`
      );

    if (!response.ok) {
      return [];
    }

    return await response.json();
  } catch {
    return [];
  }
}