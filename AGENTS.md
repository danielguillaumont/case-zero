# CASE//ZERO — Repository Instructions for Codex

## Mission and source of truth

CASE//ZERO is evolving from the documented v2.0.1 SOC application into the v3 Detection Proof Engine. The product promise is: **Replay the attack. Find the gaps. Prove the fix.**

Read `docs/roadmap/CASE_ZERO_V3_MASTER_BUILD_PLAN.md` before proposing a milestone change. That file is the detailed product contract. Treat its proposed architecture as a plan, **not** proof of existing implementation. Verify all assumptions against current source and tests. Keep the roadmap updated only in an explicitly approved documentation task.

The release order is: v2.1 baseline -> v2.2 isolated replay -> v2.3 rule versions and grading -> v2.4 external rule/data compatibility -> v2.5 evidence and UX -> v2.6 reliability and CI -> optional v2.7 AI -> v3.0 verified release.

## Working agreement

- Work in small, bounded slices. State the objective, files touched, risks, tests, and evidence for each slice.
- Inspect Git branch, HEAD, status, and relevant code before editing. **Never discard uncommitted changes.**
- Do not make unrelated refactors, wholesale UI redesigns, broad package upgrades, or technology substitutions without an explicit decision.
- Keep the existing Python/FastAPI, Next.js/TypeScript, PostgreSQL/Alembic, and Vercel/Render/Neon foundations unless measured evidence justifies change.
- Preserve existing authentication, RBAC, SOC investigations, production configuration, and API behavior unless the scoped task specifically authorizes a change.
- Prefer modifying only necessary files; do not generate empty scaffolding or speculative abstractions.
- For code tasks, add or update appropriate unit/integration tests and execute supported checks when safe. Report exact commands, observed outcomes, and any skipped checks. Never claim a test passed without running it.
- On Windows, prefer PowerShell-compatible instructions. Avoid assuming Bash commands work in Windows PowerShell 5.1.
- Do not commit, push, merge, tag, publish, or deploy unless the user explicitly authorizes the action for the current slice. Prepare reviewable changes first.

## Security and safety boundaries

- Never open, print, copy, commit, or upload `.env`, real tokens, passwords, private keys, production data, or any other secrets. You may inspect `.env.example` and names of config variables without exposing values.
- Never execute migrations, data resets, destructive commands, live attack tooling, or operations against Neon/Render/Vercel production without explicit separate approval and a verified backup/rollback plan.
- Never use `git reset --hard`, `git clean -fd`, force-push, or blindly overwrite existing files.
- Detection replay is **evaluation of recorded events**, never execution of commands from telemetry, rules, ZIP files, or uploaded datasets.
- Replayed scenarios must remain isolated from operational alerts and production case data.
- Unsupported Sigma syntax must fail explicitly rather than produce plausible but incorrect results.
- Do not implement autonomous response or AI-driven rule modification as part of core milestones. AI is an optional, later, read-only feature.
- Treat file uploads, event content, and rule text as untrusted inputs. Preserve per-object authorization, bounded resource use, and evidence provenance.

## Response format for completed slices

1. Confirmed repository branch/commit and working-tree state.
2. What was inspected or changed (exact paths).
3. Observed test/build evidence, including failures and what was not run.
4. Risks, security implications, production impact, and unknowns.
5. Acceptance criteria passed/not yet proven.
6. Next **smallest** recommended slice, with clear stop/continue gate.
