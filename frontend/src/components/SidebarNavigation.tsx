"use client";

import Link from "next/link";

import {
  usePathname,
} from "next/navigation";

import {
  logoutAction,
} from "@/app/login/actions";


type NavigationIcon =
  | "dashboard"
  | "events"
  | "alerts"
  | "cases"
  | "hunt"
  | "intelligence"
  | "rules"
  | "playbooks";


type NavigationItem = {
  label: string;
  href: string;
  icon: NavigationIcon;
};


type NavigationGroup = {
  label: string;
  items: NavigationItem[];
};


const navigationGroups: NavigationGroup[] = [
  {
    label: "Operations",

    items: [
      {
        label: "Dashboard",
        href: "/",
        icon: "dashboard",
      },
      {
        label: "Events",
        href: "/events",
        icon: "events",
      },
      {
        label: "Alerts",
        href: "/alerts",
        icon: "alerts",
      },
      {
        label: "Cases",
        href: "/cases",
        icon: "cases",
      },
    ],
  },

  {
    label: "Analysis",

    items: [
      {
        label: "Hunt",
        href: "/hunt",
        icon: "hunt",
      },
      {
        label: "Intelligence",
        href: "/intelligence",
        icon: "intelligence",
      },
    ],
  },

  {
    label: "Engineering",

    items: [
      {
        label: "Rules",
        href: "/rules",
        icon: "rules",
      },
      {
        label: "Playbooks",
        href: "/playbooks",
        icon: "playbooks",
      },
    ],
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
  const pathname =
    usePathname();

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
    <aside className="sticky top-0 flex h-screen w-[264px] shrink-0 flex-col border-r border-white/[0.065] bg-[#060b10]/95">

      <div className="flex min-h-0 flex-1 flex-col">

        {/* Brand */}
        <div className="px-6 pb-5 pt-7">

          <Link
            href="/"
            className="cz-focus-ring block rounded-sm"
          >

            <div className="flex items-center gap-3">

              <div className="relative flex h-9 w-9 items-center justify-center rounded-[9px] border border-[#c6a15b]/25 bg-[#c6a15b]/[0.055]">

                <span className="text-[11px] font-semibold tracking-[-0.04em] text-[#d8bb78]">
                  CZ
                </span>

                <span className="absolute -bottom-px -right-px h-2.5 w-2.5 rounded-tl-md border-l border-t border-[#67c7d5]/45 bg-[#060b10]" />

              </div>

              <div>

                <h1 className="text-[20px] font-semibold tracking-[-0.035em] text-[#f0f3f6]">
                  CASE
                  <span className="text-[#c6a15b]">
                    //
                  </span>
                  <span className="text-[#73cad6]">
                    ZERO
                  </span>
                </h1>

                <p className="mt-0.5 text-[10px] font-medium tracking-[0.12em] text-[#697681]">
                  SECURITY OPERATIONS
                </p>

              </div>

            </div>

          </Link>

        </div>

        {/* Navigation */}
        <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-5">

          <div className="space-y-6">

            {navigationGroups.map(
              (group) => (
                <div
                  key={group.label}
                >

                  <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#53606b]">
                    {group.label}
                  </p>

                  <div className="space-y-1">

                    {group.items.map(
                      (item) => {
                        const active =
                          isActive(
                            item.href
                          );

                        return (
                          <Link
                            key={item.label}
                            href={item.href}
                            className={`cz-focus-ring relative flex items-center gap-3 rounded-[8px] px-3 py-2.5 transition ${
                              active
                                ? "bg-white/[0.06] text-[#f0f3f6]"
                                : "text-[#8a96a1] hover:bg-white/[0.035] hover:text-[#dce2e7]"
                            }`}
                          >

                            {active && (
                              <span className="absolute inset-y-2 left-0 w-[2px] rounded-full bg-[#c6a15b]" />
                            )}

                            <NavIcon
                              icon={item.icon}
                              active={active}
                            />

                            <span className="text-[13px] font-medium">
                              {item.label}
                            </span>

                          </Link>
                        );
                      }
                    )}

                  </div>

                </div>
              )
            )}

          </div>

        </nav>

        {/* User */}
        <div className="border-t border-white/[0.06] px-4 py-4">

          <div className="rounded-[10px] border border-white/[0.07] bg-white/[0.02] p-3">

            <div className="flex items-center gap-3">

              <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#c6a15b]/10 text-[10px] font-semibold text-[#dbc27f]">

                {getInitials(
                  user.displayName
                )}

                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#0a1016] bg-[#59c99d]" />

              </div>

              <div className="min-w-0 flex-1">

                <p className="truncate text-[12px] font-medium text-[#e5eaee]">
                  {user.displayName}
                </p>

                <p className="mt-0.5 text-[10px] text-[#6f7c87]">
                  {formattedRole}
                </p>

              </div>

              <div className="flex items-center gap-1.5">

                <span className="h-1.5 w-1.5 rounded-full bg-[#59c99d]" />

                <span className="text-[9px] text-[#65736e]">
                  Online
                </span>

              </div>

            </div>

            <div className="mt-3 flex items-center justify-between border-t border-white/[0.055] pt-3">

              <p className="max-w-[130px] truncate text-[9px] text-[#596672]">
                {user.email}
              </p>

              <form
                action={logoutAction}
              >
                <button
                  type="submit"
                  className="cz-focus-ring rounded-md px-2 py-1 text-[10px] font-medium text-[#77848f] transition hover:bg-white/[0.045] hover:text-[#d5dce2]"
                >
                  Sign out
                </button>
              </form>

            </div>

          </div>

        </div>

      </div>

    </aside>
  );
}


function NavIcon({
  icon,
  active,
}: {
  icon: NavigationIcon;
  active: boolean;
}) {
  const className =
    active
      ? "text-[#d3b66f]"
      : "text-[#66737f]";

  const commonProps = {
    width: 17,
    height: 17,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap:
      "round" as const,
    strokeLinejoin:
      "round" as const,
    className,
    "aria-hidden": true,
  };

  switch (icon) {
    case "dashboard":
      return (
        <svg {...commonProps}>
          <rect
            x="3"
            y="3"
            width="7"
            height="7"
            rx="1"
          />
          <rect
            x="14"
            y="3"
            width="7"
            height="7"
            rx="1"
          />
          <rect
            x="3"
            y="14"
            width="7"
            height="7"
            rx="1"
          />
          <rect
            x="14"
            y="14"
            width="7"
            height="7"
            rx="1"
          />
        </svg>
      );

    case "events":
      return (
        <svg {...commonProps}>
          <path d="M4 6h16" />
          <path d="M4 12h16" />
          <path d="M4 18h16" />
          <circle
            cx="7"
            cy="6"
            r="1"
            fill="currentColor"
            stroke="none"
          />
        </svg>
      );

    case "alerts":
      return (
        <svg {...commonProps}>
          <path d="M12 3 2.8 19h18.4L12 3Z" />
          <path d="M12 9v4" />
          <path d="M12 16.5h.01" />
        </svg>
      );

    case "cases":
      return (
        <svg {...commonProps}>
          <rect
            x="3"
            y="7"
            width="18"
            height="13"
            rx="2"
          />
          <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <path d="M3 12h18" />
        </svg>
      );

    case "hunt":
      return (
        <svg {...commonProps}>
          <circle
            cx="11"
            cy="11"
            r="7"
          />
          <path d="m20 20-4-4" />
        </svg>
      );

    case "intelligence":
      return (
        <svg {...commonProps}>
          <circle
            cx="12"
            cy="12"
            r="8"
          />
          <path d="M12 8v4l3 2" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
        </svg>
      );

    case "rules":
      return (
        <svg {...commonProps}>
          <path d="M5 4h14" />
          <path d="M5 10h14" />
          <path d="M5 16h8" />
          <circle
            cx="17"
            cy="16"
            r="2"
          />
        </svg>
      );

    case "playbooks":
      return (
        <svg {...commonProps}>
          <path d="M5 3h11a3 3 0 0 1 3 3v15H8a3 3 0 0 1-3-3V3Z" />
          <path d="M8 21V6a3 3 0 0 0-3-3" />
          <path d="M11 9h5" />
          <path d="M11 13h5" />
        </svg>
      );
  }
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