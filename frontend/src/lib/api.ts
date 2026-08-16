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


export type DetectionRule = {
  id: string;
  name: string;
  description: string;
  severity: string;
  rule_type: "single_event" | "correlation";
  enabled: boolean;
  event_type: string;
  logic: string;
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


export async function getApiHealth(): Promise<HealthStatus | null> {
  try {
    const response = await fetch(
      "http://127.0.0.1:8000/api/health",
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


export async function getAlerts(): Promise<Alert[]> {
  try {
    const response = await fetch(
      "http://127.0.0.1:8000/api/alerts",
      {
        cache: "no-store",
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


export async function getAlert(
  alertId: string
): Promise<Alert | null> {
  try {
    const response = await fetch(
      `http://127.0.0.1:8000/api/alerts/${alertId}`,
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


export async function getSecurityEvents(): Promise<SecurityEvent[]> {
  try {
    const response = await fetch(
      "http://127.0.0.1:8000/api/events",
      {
        cache: "no-store",
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


export async function getSecurityEvent(
  eventId: string
): Promise<SecurityEvent | null> {
  try {
    const response = await fetch(
      `http://127.0.0.1:8000/api/events/${eventId}`,
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


export async function getDetectionRules(): Promise<DetectionRule[]> {
  try {
    const response = await fetch(
      "http://127.0.0.1:8000/api/rules",
      {
        cache: "no-store",
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


export async function getDetectionRule(
  ruleId: string
): Promise<DetectionRule | null> {
  try {
    const response = await fetch(
      `http://127.0.0.1:8000/api/rules/${ruleId}`,
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


export async function huntSecurityEvents(
  huntQuery: HuntQuery
): Promise<SecurityEvent[]> {
  try {
    const response = await fetch(
      "http://127.0.0.1:8000/api/hunt",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          event_type:
            huntQuery.event_type ?? null,
          source:
            huntQuery.source ?? null,
          hostname:
            huntQuery.hostname ?? null,
          username:
            huntQuery.username ?? null,
          source_ip:
            huntQuery.source_ip ?? null,
          process_name:
            huntQuery.process_name ?? null,
          contains:
            huntQuery.contains ?? null,
          start_time:
            huntQuery.start_time ?? null,
          end_time:
            huntQuery.end_time ?? null,
          limit:
            huntQuery.limit ?? 100,
        }),
        cache: "no-store",
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


export async function getCases(): Promise<Case[]> {
  try {
    const response = await fetch(
      "http://127.0.0.1:8000/api/cases",
      {
        cache: "no-store",
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


export async function getCase(
  caseId: string
): Promise<CaseDetail | null> {
  try {
    const response = await fetch(
      `http://127.0.0.1:8000/api/cases/${caseId}`,
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


export async function getCaseNotes(
  caseId: string
): Promise<CaseNote[]> {
  try {
    const response = await fetch(
      `http://127.0.0.1:8000/api/cases/${caseId}/notes`,
      {
        cache: "no-store",
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


export async function getCaseActivities(
  caseId: string
): Promise<CaseActivity[]> {
  try {
    const response = await fetch(
      `http://127.0.0.1:8000/api/cases/${caseId}/activities`,
      {
        cache: "no-store",
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