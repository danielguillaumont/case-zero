import { redirect } from "next/navigation";

import SidebarNavigation
  from "@/components/SidebarNavigation";

import {
  getCurrentUser,
} from "@/lib/auth";


export default async function Sidebar() {
  const currentUser =
    await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  return (
    <SidebarNavigation
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