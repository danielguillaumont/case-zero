import { redirect } from "next/navigation";

import {
  getCurrentUser,
} from "@/lib/auth";

import {
  loginAction,
} from "./actions";


type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};


export default async function LoginPage({
  searchParams,
}: LoginPageProps) {
  const currentUser =
    await getCurrentUser();

  if (currentUser) {
    redirect("/");
  }

  const params =
    await searchParams;

  const error =
    params.error;

  const environmentLabel =
    process.env.NODE_ENV === "production"
      ? "Production"
      : "Local Development";

  return (
    <main className="relative min-h-screen overflow-hidden text-[#eef2f5]">

      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0">

        <div className="absolute inset-0 bg-[#05090e]" />

        <div className="absolute left-[8%] top-[-260px] h-[700px] w-[700px] rounded-full bg-[#c9a965]/[0.035] blur-[150px]" />

        <div className="absolute right-[-180px] top-[-140px] h-[780px] w-[780px] rounded-full bg-[#69c5d7]/[0.06] blur-[170px]" />

        <div className="absolute bottom-[-260px] right-[12%] h-[560px] w-[560px] rounded-full bg-[#69c5d7]/[0.025] blur-[140px]" />

        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#69c5d7]/40 to-transparent" />

      </div>


      <div className="relative z-10 grid min-h-screen lg:grid-cols-[minmax(0,1.06fr)_minmax(500px,0.94fr)]">

        {/* Product / brand panel */}
        <section className="relative hidden min-h-screen overflow-hidden border-r border-white/[0.055] lg:flex lg:flex-col">

          {/* Very subtle architectural grid */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.17]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)",
              backgroundSize:
                "88px 88px",
            }}
          />

          <div className="relative z-10 flex min-h-screen flex-col px-14 py-11 xl:px-[68px] xl:py-[54px]">

            {/* Brand */}
            <div className="flex items-center justify-between">

              <div className="flex items-center gap-4">

                <div className="relative flex h-[42px] w-[42px] items-center justify-center rounded-[3px] border border-[#c9a965]/35 bg-[#c9a965]/[0.025]">

                  <span className="font-mono text-[10px] font-semibold tracking-[0.08em] text-[#d7b86d]">
                    CZ
                  </span>

                  <span className="absolute -bottom-px -right-px h-[9px] w-[9px] border-b border-r border-[#69c5d7]/65" />

                </div>

                <div>

                  <p className="text-[20px] font-semibold tracking-[-0.04em] text-[#f2f4f6]">
                    CASE
                    <span className="text-[#c9a965]">
                      //
                    </span>
                    <span className="text-[#77cad7]">
                      ZERO
                    </span>
                  </p>

                  <p className="mt-1 text-[8px] font-semibold uppercase tracking-[0.24em] text-[#65737f]">
                    Security Operations
                  </p>

                </div>

              </div>


              <div className="flex items-center gap-2">

                <span className="h-1.5 w-1.5 rounded-full bg-[#68d0a6] shadow-[0_0_10px_rgba(104,208,166,0.4)]" />

                <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-[#52626e]">
                  System online
                </span>

              </div>

            </div>


            {/* Hero */}
            <div className="flex flex-1 items-center">

              <div className="w-full max-w-[680px]">

                <div className="mb-6 flex items-center gap-3">

                  <span className="text-[11px] font-semibold text-[#c9a965]">
                    Security Operations Platform
                  </span>

                  <span className="h-px w-8 bg-[#c9a965]/35" />

                  <span className="text-[9px] uppercase tracking-[0.12em] text-[#566571]">
                    Analyst Workspace
                  </span>

                </div>


                <div className="border-l border-[#c9a965]/35 pl-6">

                  <h1 className="max-w-[620px] text-[54px] font-semibold leading-[0.98] tracking-[-0.055em] text-[#f3f5f7] xl:text-[64px]">

                    Investigate.

                    <br />

                    Correlate.

                    <br />

                    <span className="text-[#8997a2]">
                      Respond.
                    </span>

                  </h1>

                  <p className="mt-7 max-w-[580px] text-[13px] leading-7 text-[#82909b] xl:text-[14px]">
                    Unified security operations for telemetry,
                    detection engineering, alert triage, threat
                    hunting, intelligence, investigations, and
                    incident response.
                  </p>

                </div>


                {/* Platform coverage */}
                <div className="mt-10">

                  <div className="mb-3 flex items-center justify-between">

                    <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#5e6d79]">
                      Operational coverage
                    </p>

                    <p className="font-mono text-[8px] uppercase tracking-[0.12em] text-[#43515c]">
                      CASE//ZERO PLATFORM
                    </p>

                  </div>


                  <div className="grid grid-cols-3 overflow-hidden rounded-[12px] border border-white/[0.07] bg-[#081018]/75">

                    <Capability
                      index="01"
                      title="Telemetry"
                      description="Event ingestion"
                      accent="#69c5d7"
                    />

                    <Capability
                      index="02"
                      title="Detection"
                      description="Rules & alerts"
                      accent="#c9a965"
                      bordered
                    />

                    <Capability
                      index="03"
                      title="Investigation"
                      description="Cases & hunting"
                      accent="#83a7d6"
                    />

                    <Capability
                      index="04"
                      title="Intelligence"
                      description="IOC enrichment"
                      accent="#69c5d7"
                      topBorder
                    />

                    <Capability
                      index="05"
                      title="Engineering"
                      description="Detection logic"
                      accent="#c9a965"
                      bordered
                      topBorder
                    />

                    <Capability
                      index="06"
                      title="Response"
                      description="Analyst playbooks"
                      accent="#68d0a6"
                      topBorder
                    />

                  </div>

                </div>

              </div>

            </div>


            {/* Platform footer */}
            <div className="flex items-center justify-between border-t border-white/[0.055] pt-5">

              <div className="flex items-center gap-2.5">

                <span className="h-1.5 w-1.5 rounded-full bg-[#68d0a6]" />

                <span className="text-[9px] font-medium uppercase tracking-[0.14em] text-[#667581]">
                  Platform operational
                </span>

              </div>

              <div className="flex items-center gap-5">

                <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-[#44525d]">
                  SECOPS
                </span>

                <span className="h-3 w-px bg-white/[0.07]" />

                <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-[#44525d]">
                  CASE//ZERO
                </span>

              </div>

            </div>

          </div>

        </section>


        {/* Authentication side */}
        <section className="relative flex min-h-screen items-center justify-center px-6 py-10 sm:px-10 lg:px-12 xl:px-16">

          <div className="w-full max-w-[510px]">

            {/* Mobile brand */}
            <div className="mb-10 flex items-center gap-3 lg:hidden">

              <div className="relative flex h-10 w-10 items-center justify-center border border-[#c9a965]/35 bg-[#c9a965]/[0.03]">

                <span className="font-mono text-[10px] font-semibold text-[#d6b76f]">
                  CZ
                </span>

                <span className="absolute -bottom-px -right-px h-2 w-2 border-b border-r border-[#69c5d7]/60" />

              </div>

              <div>

                <p className="text-[20px] font-semibold tracking-[-0.04em]">
                  CASE
                  <span className="text-[#c9a965]">
                    //
                  </span>
                  <span className="text-[#77cad7]">
                    ZERO
                  </span>
                </p>

                <p className="mt-1 text-[8px] uppercase tracking-[0.22em] text-[#65737f]">
                  Security Operations
                </p>

              </div>

            </div>


            {/* Gateway identifier */}
            <div className="mb-4 flex items-center justify-between px-1">

              <div className="flex items-center gap-3">

                <span className="font-mono text-[9px] font-semibold tracking-[0.08em] text-[#c9a965]">
                  ACCESS / 01
                </span>

                <span className="h-px w-8 bg-[#c9a965]/30" />

                <span className="text-[9px] text-[#596874]">
                  Identity Gateway
                </span>

              </div>

              <div className="flex items-center gap-2">

                <span className="h-1.5 w-1.5 rounded-full bg-[#68d0a6] shadow-[0_0_8px_rgba(104,208,166,0.4)]" />

                <span className="text-[8px] font-medium uppercase tracking-[0.1em] text-[#627a70]">
                  Available
                </span>

              </div>

            </div>


            {/* Login card */}
            <div className="overflow-hidden rounded-[15px] border border-white/[0.085] bg-[#09121a]/95 shadow-[0_34px_100px_rgba(0,0,0,0.33)]">

              <div className="h-px bg-gradient-to-r from-[#c9a965]/75 via-[#69c5d7]/45 to-transparent" />


              {/* Card header */}
              <div className="border-b border-white/[0.055] px-8 py-7 sm:px-9">

                <div className="flex items-start justify-between gap-6">

                  <div>

                    <p className="text-[9px] font-semibold uppercase tracking-[0.13em] text-[#657480]">
                      Analyst authentication
                    </p>

                    <h2 className="mt-3 text-[32px] font-semibold tracking-[-0.045em] text-[#f3f5f7]">
                      Sign in
                    </h2>

                    <p className="mt-2 max-w-[330px] text-[12px] leading-5 text-[#778692]">
                      Enter your analyst credentials to
                      access the CASE//ZERO operations
                      workspace.
                    </p>

                  </div>


                  <div className="shrink-0 rounded-[9px] border border-white/[0.07] bg-[#060c12]/75 px-3 py-2.5">

                    <p className="text-[7px] font-semibold uppercase tracking-[0.12em] text-[#53616d]">
                      Environment
                    </p>

                    <p className="mt-1.5 whitespace-nowrap text-[9px] font-medium text-[#b5bec6]">
                      {environmentLabel}
                    </p>

                  </div>

                </div>

              </div>


              <div className="px-8 py-7 sm:px-9 sm:py-8">

                {error && (
                  <div
                    role="alert"
                    className="mb-6 rounded-[9px] border border-[#df6d6d]/25 bg-[#df6d6d]/[0.055] px-4 py-3"
                  >

                    <div className="flex items-start gap-3">

                      <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#df6d6d]" />

                      <div>

                        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#e78686]">
                          Authentication failed
                        </p>

                        <p className="mt-1 text-[11px] leading-5 text-[#ba8585]">
                          {error}
                        </p>

                      </div>

                    </div>

                  </div>
                )}


                <form
                  action={loginAction}
                  className="space-y-5"
                >

                  {/* Identity */}
                  <div>

                    <div className="mb-2 flex items-center justify-between">

                      <label
                        htmlFor="email"
                        className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#7e8c98]"
                      >
                        Analyst identity
                      </label>

                      <span className="font-mono text-[7px] uppercase tracking-[0.13em] text-[#41505c]">
                        ID / EMAIL
                      </span>

                    </div>

                    <div className="relative">

                      <div className="pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center border-r border-white/[0.055]">

                        <IdentityIcon />

                      </div>

                      <input
                        id="email"
                        name="email"
                        type="email"
                        required
                        autoComplete="username"
                        autoFocus
                        aria-invalid={
                          error
                            ? true
                            : undefined
                        }
                        placeholder="analyst@example.com"
                        className="cz-focus-ring h-[50px] w-full rounded-[9px] border border-white/[0.085] bg-[#050b10]/90 pl-[58px] pr-4 text-[12px] text-[#edf1f4] outline-none transition placeholder:text-[#46535f] hover:border-white/[0.13] focus:border-[#69c5d7]/45 focus:bg-[#071019]"
                      />

                    </div>

                  </div>


                  {/* Password */}
                  <div>

                    <div className="mb-2 flex items-center justify-between">

                      <label
                        htmlFor="password"
                        className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#7e8c98]"
                      >
                        Password
                      </label>

                      <span className="font-mono text-[7px] uppercase tracking-[0.13em] text-[#41505c]">
                        ENCRYPTED
                      </span>

                    </div>

                    <div className="relative">

                      <div className="pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center border-r border-white/[0.055]">

                        <LockIcon />

                      </div>

                      <input
                        id="password"
                        name="password"
                        type="password"
                        required
                        autoComplete="current-password"
                        aria-invalid={
                          error
                            ? true
                            : undefined
                        }
                        placeholder="••••••••••••"
                        className="cz-focus-ring h-[50px] w-full rounded-[9px] border border-white/[0.085] bg-[#050b10]/90 pl-[58px] pr-4 text-[12px] text-[#edf1f4] outline-none transition placeholder:text-[#46535f] hover:border-white/[0.13] focus:border-[#69c5d7]/45 focus:bg-[#071019]"
                      />

                    </div>

                  </div>


                  {/* CTA */}
                  <button
                    type="submit"
                    className="cz-focus-ring group mt-2 flex min-h-[54px] w-full items-center justify-between rounded-[9px] border border-[#d3b267]/75 bg-[#c9a965] px-5 py-3 text-left text-[#091018] shadow-[0_10px_30px_rgba(201,169,101,0.08)] transition duration-200 hover:border-[#e2c47e] hover:bg-[#d5b66c] hover:shadow-[0_12px_34px_rgba(201,169,101,0.12)]"
                  >

                    <span>

                      <span className="block text-[12px] font-semibold">
                        Authenticate
                      </span>

                      <span className="mt-0.5 block text-[8px] font-medium uppercase tracking-[0.08em] text-[#56451f]">
                        Enter operations workspace
                      </span>

                    </span>

                    <span className="font-mono text-[17px] transition-transform duration-200 group-hover:translate-x-1">
                      →
                    </span>

                  </button>

                </form>

              </div>


              {/* Session footer */}
              <div className="border-t border-white/[0.055] bg-[#060d13]/80 px-8 py-4 sm:px-9">

                <div className="flex items-center justify-between gap-4">

                  <div className="flex items-center gap-2.5">

                    <span className="h-1.5 w-1.5 rounded-full bg-[#68d0a6] shadow-[0_0_8px_rgba(104,208,166,0.35)]" />

                    <span className="text-[8px] font-semibold uppercase tracking-[0.13em] text-[#64737e]">
                      Authentication service online
                    </span>

                  </div>

                  <span className="font-mono text-[7px] uppercase tracking-[0.14em] text-[#40505b]">
                    SECURE ACCESS
                  </span>

                </div>

              </div>

            </div>


            {/* Lower access notice */}
            <div className="mt-5 flex items-center justify-center gap-3">

              <span className="h-px w-5 bg-white/[0.07]" />

              <p className="text-[8px] font-medium uppercase tracking-[0.15em] text-[#44535e]">
                Authorized analyst access only
              </p>

              <span className="h-px w-5 bg-white/[0.07]" />

            </div>

          </div>

        </section>

      </div>

    </main>
  );
}


function Capability({
  index,
  title,
  description,
  accent,
  bordered = false,
  topBorder = false,
}: {
  index: string;
  title: string;
  description: string;
  accent: string;
  bordered?: boolean;
  topBorder?: boolean;
}) {
  return (
    <div
      className={[
        "relative px-5 py-4",
        bordered
          ? "border-x border-white/[0.055]"
          : "",
        topBorder
          ? "border-t border-white/[0.055]"
          : "",
      ].join(" ")}
    >

      <div
        className="absolute left-0 top-0 h-px w-10"
        style={{
          background:
            accent,
          opacity:
            0.55,
        }}
      />

      <div className="flex items-start justify-between gap-4">

        <div>

          <p className="font-mono text-[7px] text-[#485762]">
            {index}
          </p>

          <p className="mt-2 text-[11px] font-semibold text-[#cbd3da]">
            {title}
          </p>

          <p className="mt-1 text-[8px] text-[#5d6b77]">
            {description}
          </p>

        </div>

        <span
          className="mt-1 h-1.5 w-1.5 rounded-full"
          style={{
            background:
              accent,
            opacity:
              0.85,
          }}
        />

      </div>

    </div>
  );
}


function IdentityIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >

      <circle
        cx="12"
        cy="8"
        r="3.5"
        stroke="#667783"
        strokeWidth="1.5"
      />

      <path
        d="M5.5 19C6.4 15.7 8.6 14 12 14C15.4 14 17.6 15.7 18.5 19"
        stroke="#667783"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

    </svg>
  );
}


function LockIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >

      <rect
        x="5.5"
        y="10"
        width="13"
        height="9"
        rx="2"
        stroke="#667783"
        strokeWidth="1.5"
      />

      <path
        d="M8.5 10V7.5C8.5 5.57 10.07 4 12 4C13.93 4 15.5 5.57 15.5 7.5V10"
        stroke="#667783"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

    </svg>
  );
}