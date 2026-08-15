import { getApiHealth } from "@/lib/api";

export default async function Home() {
  const apiHealth = await getApiHealth();

  const apiOnline = apiHealth?.status === "online";
  const databaseOnline = apiHealth?.database === "online";

  const navigationItems = [
    "Dashboard",
    "Alerts",
    "Cases",
    "Hunt",
    "Intelligence",
    "Rules",
    "Playbooks",
  ];

  const metrics = [
    { label: "Events Today", value: "0" },
    { label: "Open Alerts", value: "0" },
    { label: "Active Cases", value: "0" },
    { label: "Critical", value: "0" },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="w-64 border-r border-zinc-800 bg-zinc-950 p-6">
          <div className="mb-10">
            <h1 className="text-2xl font-bold tracking-tight">
              CASE<span className="text-emerald-400">//ZERO</span>
            </h1>

            <p className="mt-2 text-xs uppercase tracking-[0.2em] text-zinc-500">
              Security Operations
            </p>
          </div>

          <nav className="space-y-2">
            {navigationItems.map((item) => (
              <button
                key={item}
                className={`w-full rounded-lg px-4 py-3 text-left text-sm transition ${
                  item === "Dashboard"
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                }`}
              >
                {item}
              </button>
            ))}
          </nav>

          <div className="mt-10 border-t border-zinc-800 pt-6">
            <button className="w-full rounded-lg px-4 py-3 text-left text-sm text-zinc-500 hover:bg-zinc-900 hover:text-white">
              Administration
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-10">
          <header className="mb-10 flex items-center justify-between">
            <div>
              <p className="text-sm text-emerald-400">CASE//ZERO</p>

              <h2 className="mt-1 text-3xl font-semibold">
                Security Operations Dashboard
              </h2>

              <p className="mt-2 text-sm text-zinc-500">
                Monitor alerts, investigations, and platform health.
              </p>
            </div>

            <div className="rounded-full border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-zinc-400">
              Local Development
            </div>
          </header>

          {/* Metrics */}
          <section>
            <h3 className="mb-4 text-sm font-medium uppercase tracking-wider text-zinc-500">
              Security Overview
            </h3>

            <div className="grid grid-cols-4 gap-4">
              {metrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-xl border border-zinc-800 bg-zinc-900 p-6"
                >
                  <p className="text-sm text-zinc-500">{metric.label}</p>

                  <p className="mt-3 text-3xl font-semibold">
                    {metric.value}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Lower Dashboard */}
          <div className="mt-8 grid grid-cols-3 gap-6">
            {/* System Status */}
            <section className="col-span-2 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="mb-6">
                <h3 className="font-medium">System Status</h3>

                <p className="mt-1 text-sm text-zinc-500">
                  CASE//ZERO platform services
                </p>
              </div>

              <div className="divide-y divide-zinc-800">
                <StatusRow
                  name="CASE//ZERO API"
                  status={apiOnline ? "ONLINE" : "OFFLINE"}
                  active={apiOnline}
                />

                <StatusRow
                  name="PostgreSQL Database"
                  status={databaseOnline ? "ONLINE" : "OFFLINE"}
                  active={databaseOnline}
                />

                <StatusRow
                  name="Detection Engine"
                  status="NOT CONFIGURED"
                />

                <StatusRow
                  name="Event Pipeline"
                  status="NOT CONFIGURED"
                />

                <StatusRow
                  name="Threat Intelligence"
                  status="NOT CONFIGURED"
                />
              </div>

              {apiOnline && apiHealth && (
                <div className="mt-4 border-t border-zinc-800 pt-4">
                  <p className="text-xs text-zinc-600">
                    API Version: {apiHealth.version}
                  </p>
                </div>
              )}
            </section>

            {/* Investigation Queue */}
            <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <h3 className="font-medium">Investigation Queue</h3>

              <p className="mt-1 text-sm text-zinc-500">
                Analyst workload
              </p>

              <div className="flex min-h-52 items-center justify-center">
                <div className="text-center">
                  <p className="text-4xl font-semibold">0</p>

                  <p className="mt-2 text-sm text-zinc-500">
                    Active investigations
                  </p>
                </div>
              </div>
            </section>
          </div>

          {/* Recent Alerts */}
          <section className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900">
            <div className="border-b border-zinc-800 p-6">
              <h3 className="font-medium">Recent Alerts</h3>

              <p className="mt-1 text-sm text-zinc-500">
                Latest security detections
              </p>
            </div>

            <div className="flex min-h-48 items-center justify-center">
              <div className="text-center">
                <p className="text-sm text-zinc-400">
                  No alerts detected
                </p>

                <p className="mt-1 text-xs text-zinc-600">
                  Detection events will appear here.
                </p>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function StatusRow({
  name,
  status,
  active = false,
}: {
  name: string;
  status: string;
  active?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-4">
      <div className="flex items-center gap-3">
        <div
          className={`h-2.5 w-2.5 rounded-full ${
            active ? "bg-emerald-400" : "bg-zinc-600"
          }`}
        />

        <span className="text-sm">{name}</span>
      </div>

      <span
        className={`text-xs font-medium ${
          active ? "text-emerald-400" : "text-zinc-500"
        }`}
      >
        {status}
      </span>
    </div>
  );
}