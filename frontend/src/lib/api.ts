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
  created_at: string;
  updated_at: string;
};

export async function getApiHealth(): Promise<HealthStatus | null> {
  try {
    const response = await fetch("http://127.0.0.1:8000/api/health", {
      cache: "no-store",
    });

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
    const response = await fetch("http://127.0.0.1:8000/api/alerts", {
      cache: "no-store",
    });

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