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

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6">

      <div className="w-full max-w-lg">

        <div className="mb-10 text-center">

          <h1 className="text-5xl font-bold tracking-tight text-white">
            CASE
            <span className="text-emerald-400">
              //ZERO
            </span>
          </h1>

          <p className="mt-4 text-xs uppercase tracking-[0.3em] text-zinc-500">
            Security Operations Platform
          </p>

        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-10 shadow-2xl">

          <div className="mb-8">

            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
              Analyst Access
            </p>

            <h2 className="mt-3 text-3xl font-semibold text-white">
              Sign in
            </h2>

            <p className="mt-3 text-sm leading-6 text-zinc-400">
              Authenticate to access the
              CASE//ZERO investigation
              workspace.
            </p>

          </div>

          {error && (
            <div className="mb-6 rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <form
            action={loginAction}
            className="space-y-6"
          >

            <div>

              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-zinc-300"
              >
                Email
              </label>

              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="username"
                placeholder="analyst@example.com"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-500"
              />

            </div>

            <div>

              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium text-zinc-300"
              >
                Password
              </label>

              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••••••"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-500"
              />

            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-emerald-500 px-4 py-3.5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400"
            >
              Authenticate
            </button>

          </form>

          <div className="mt-7 border-t border-zinc-800 pt-6">

            <div className="flex items-center justify-center gap-2">

              <span className="h-2 w-2 rounded-full bg-emerald-400" />

              <p className="text-xs text-zinc-600">
                Secure analyst authentication
              </p>

            </div>

          </div>

        </div>

      </div>

    </main>
  );
}