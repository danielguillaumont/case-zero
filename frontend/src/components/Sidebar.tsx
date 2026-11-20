import {
  redirect,
} from "next/navigation";

import SidebarNavigation
  from "@/components/SidebarNavigation";

import {
  getCurrentUser,
  type CurrentUser,
} from "@/lib/auth";
import { isReplayPreviewEnabled } from "@/lib/api";
import { canRunReplay } from "@/lib/replay-preview-contract";


export default async function Sidebar({ user }: { user?: CurrentUser } = {}) {
  const currentUser =
    user ?? await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  return (
    <SidebarNavigation
      showDetectionLab={isReplayPreviewEnabled() && canRunReplay(currentUser.role)}
      user={{
        displayName:
          currentUser.display_name,

        email:
          currentUser.email,

        role:
          currentUser.role,
      }}
    />
  );
}
