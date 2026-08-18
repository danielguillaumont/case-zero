"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  logoutAction,
} from "@/app/login/actions";


const navigationItems = [
  {
    label: "Dashboard",
    href: "/",
  },
  {
    label: "Events",
    href: "/events",
  },
  {
    label: "Alerts",
    href: "/alerts",
  },
  {
    label: "Cases",
    href: "/cases",
  },
  {
    label: "Hunt",
    href: "/hunt",
  },
  {
    label: "Intelligence",
    href: "/intelligence",
  },
  {
    label: "Rules",
    href: "/rules",
  },
  {
    label: "Playbooks",
    href: "/playbooks",
  },
];


type SidebarUser = {
  displayName: string;
  email: string;
  role: string;
};


export default function SidebarNavigation({
  user,
}: {
  user: SidebarUser;
}) {
  const pathname = usePathname();

  function isActive(
    href: string
  ): boolean {
    if (href === "/") {
      return pathname === "/";
    }

    return (
      pathname === href
      || pathname.startsWith(
        `${href}/`
      )
    );
  }

  const formattedRole =
    user.role
      .charAt(0)
      .toUpperCase()
    + user.role.slice(1);

  return (
    <aside className="flex min-h-screen w-64 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 p-6">

      <div>

        <div className="mb-10">

          <Link
            href="/"
            className="block"
          >
            <h1 className="text-2xl font-bold tracking-tight">
              CASE
              <span className="text-emerald-400">
                //ZERO
              </span>
            </h1>
          </Link>

          <p className="mt-2 text-xs uppercase tracking-[0.2em] text-zinc-500">
            Security Operations
          </p>

        </div>

        <nav className="space-y-2">

          {navigationItems.map(
            (item) => {
              const active =
                isActive(
                  item.href
                );

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`block w-full rounded-lg px-4 py-3 text-sm transition ${
                    active
                      ? "bg-zinc-800 text-white"
                      : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            }
          )}

        </nav>

      </div>

      <div className="mt-auto border-t border-zinc-800 pt-6">

        <p className="mb-3 px-4 text-xs uppercase tracking-[0.15em] text-zinc-600">
          Authenticated User
        </p>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">

          <div className="flex items-start gap-3">

            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-emerald-900 bg-emerald-950 text-xs font-semibold text-emerald-400">
              {getInitials(
                user.displayName
              )}
            </div>

            <div className="min-w-0">

              <p className="truncate text-sm font-medium text-zinc-100">
                {user.displayName}
              </p>

              <p className="mt-1 text-xs text-emerald-400">
                {formattedRole}
              </p>

            </div>

          </div>

          <div className="mt-4 flex items-center gap-2 border-t border-zinc-800 pt-4">

            <span className="h-2 w-2 rounded-full bg-emerald-400" />

            <span className="text-xs text-zinc-500">
              Authenticated
            </span>

          </div>

          <form
            action={logoutAction}
            className="mt-4"
          >
            <button
              type="submit"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-400 transition hover:border-zinc-600 hover:bg-zinc-800 hover:text-white"
            >
              Sign Out
            </button>
          </form>

        </div>

      </div>

    </aside>
  );
}


function getInitials(
  displayName: string
): string {
  const names =
    displayName
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  if (names.length === 0) {
    return "CZ";
  }

  if (names.length === 1) {
    return names[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return (
    names[0][0]
    + names[
      names.length - 1
    ][0]
  ).toUpperCase();
}