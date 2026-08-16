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