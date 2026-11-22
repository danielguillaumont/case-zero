# v2.6-A frontend CI quality gates

The frontend job previously installed dependencies and ran the Next.js
production build. It did not run the frontend Node regression suite or ESLint.
Those checks now run as separate steps after `npm ci` and before the build.
[CI workflow](../../.github/workflows/ci.yml) · [v2.5 acceptance review](../releases/v2.5.md)

1. **Run frontend regression tests** runs `node --experimental-strip-types
   --test tests/*.test.mjs` on Node 22. The glob includes both the comparison
   and replay preview test modules.
2. **Lint frontend** runs `npm run lint` with the existing ESLint configuration.
   Errors fail the step. Warnings retain their existing non-blocking behavior.
3. **Build frontend** runs the existing Next.js production build after both
   gates pass.

A nonzero exit from either gate marks the frontend check failed on the PR
and skips the build. The backend job runs independently. Workflow triggers,
permissions, concurrency, runtime versions, caching and build configuration
are preserved. The existing PostgreSQL test service, migration, backend tests
and offline proof remain in place. This slice makes no production or database
changes and does not activate the Detection Lab in production.

## Local verification

From `frontend`, use Node 22 and install the locked dependencies with `npm ci`
if needed. The following PowerShell commands use `.cmd` launchers on Windows.
The loopback API URL and telemetry setting apply only to the build subprocess.

```powershell
node --experimental-strip-types --test tests/*.test.mjs
npm.cmd run lint
npx.cmd --no-install tsc --noEmit
cmd.exe /d /c 'set CASE_ZERO_API_URL=http://127.0.0.1:8000&&set NEXT_TELEMETRY_DISABLED=1&&npm.cmd run build'
```

On Node 22.15.0, all 15 tests passed across both modules. Node emitted its
experimental type-stripping and typeless-package warnings. ESLint reported
five existing unused `_formData` warnings in alert and case actions. TypeScript
is a separate local check and also runs as part of the production build.
Browser automation, including the authenticated narrow-viewport walkthrough,
is deferred. The Node suite exercises contracts and rendered markup.
