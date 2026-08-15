export type HealthStatus = {
  status: string;
  service: string;
  version: string;
  database: string;
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