"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";


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
    href: null,
  },
  {
    label: "Rules",
    href: "/rules",
  },
  {
    label: "Playbooks",
    href: null,
  },
];


export default function Sidebar() {
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

  return (
    <aside className="w-64 border-r border-zinc-800 bg-zinc-950 p-6">

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
            if (item.href === null) {
              return (
                <div
                  key={item.label}
                  className="w-full rounded-lg px-4 py-3 text-sm text-zinc-500"
                >
                  {item.label}
                </div>
              );
            }

            const active =
              isActive(item.href);

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

      <div className="mt-10 border-t border-zinc-800 pt-6">

        <div className="rounded-lg px-4 py-3 text-sm text-zinc-500">
          Administration
        </div>

      </div>

    </aside>
  );
}