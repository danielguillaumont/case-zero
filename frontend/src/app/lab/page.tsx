import { notFound, redirect } from "next/navigation";

import Sidebar from "@/components/Sidebar";
import { isReplayPreviewEnabled } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { canRunReplay } from "@/lib/replay-preview-contract";
import ComparisonWorkspace from "./ComparisonWorkspace";
import ReplayWorkspace from "./ReplayWorkspace";

export default async function DetectionLabPage() {
  if (!isReplayPreviewEnabled()) notFound();

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col md:flex-row max-md:[&>aside]:static max-md:[&>aside]:h-[min(45dvh,320px)] max-md:[&>aside]:w-full">
      <Sidebar user={user} />
      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-[1400px] px-5 py-8 lg:px-10 lg:py-10">
          <header className="mb-7 border-b border-[var(--cz-border-strong)] pb-6">
            <p className="cz-section-label mb-2 text-[var(--cz-gold)]">Detection Engineering</p>
            <h1 className="text-[34px] font-semibold tracking-[-0.04em]">Detection Lab</h1>
            <p className="mt-2 max-w-xl text-[13px] leading-6 text-[var(--cz-text-muted)]">
              Replay a bundled synthetic PowerShell scenario and inspect the rule decisions and verified evidence.
            </p>
          </header>
          <div className="space-y-8">
            <ReplayWorkspace canRun={canRunReplay(user.role)} />
            <ComparisonWorkspace canRun={canRunReplay(user.role)} />
          </div>
        </div>
      </main>
    </div>
  );
}
