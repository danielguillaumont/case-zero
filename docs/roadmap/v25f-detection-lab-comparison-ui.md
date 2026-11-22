# v2.5-F Detection Lab comparison

Open `/lab` in local development. The existing replay workspace is followed by
**Detection comparison**. Run the comparison to see the weakened baseline and
corrected candidate, their labeled results, and the change for each expectation.
Use **Inspect evidence** in a row to see the recorded event reference and UTC
time, expected and observed outcomes, requested and executed rule versions, and
the fixed grading diagnostics. Digest disclosures show the full values.

## Configuration and access

- Frontend: run the existing Next.js development environment with
  `CASE_ZERO_LAB_PREVIEW=true` and `CASE_ZERO_API_URL` pointed at the local API.
  The Lab remains excluded from production builds even with the frontend opt-in.
- Backend: run the existing development/test preview configuration with
  `CASE_ZERO_REPLAY_PREVIEW=true`. An active administrator or analyst is required.
  See [comparison preview](v25d-comparison-preview-api.md) and
  [evidence investigation](v25e-evidence-investigation.md).
- Next.js server actions use the existing HttpOnly session and server-only API
  client to read `GET /api/lab/comparison-preview` and
  `GET /api/lab/comparison-preview/expectations/{expectation_id}/evidence`.
  Requests disable caching, reject redirects and use a five-second budget per
  action. Each upstream response is limited to 16 KiB. Before fetching evidence,
  the server validates a fresh comparison and confirms the selected expectation
  and parent digest. It then validates the evidence against that comparison.
- Idle, loading, success, disabled, signed-out, forbidden, unavailable, invalid
  response and missing evidence have distinct states. Failed requests display
  fixed messages. No fallback result is shown.

## Reading the results

The bundled synthetic scenario covers three authored expectations. The weakened
baseline satisfies 2/3 labels (0 true positives, 2 true negatives, 1 false
negative). The corrected candidate satisfies 3/3 labels (1 true positive, 2 true
negatives). `encoded-switch` improves and the two controls are unchanged. Counts
and classifications in the interface come from the authenticated API response.
These results describe this fixture's labels and do not establish real-world
detection accuracy. The evidence panel displays recorded references and fixed
grading diagnostics. Built-in condition-level traces and operational case
associations are outside this workflow. SHA-256 values are backend-supplied
identities with validated formats and cross-references. The frontend does not
independently compute the digests or establish evidence authenticity.

## Verification

From `frontend`, run `node --experimental-strip-types --test tests/*.test.mjs`,
`.\node_modules\.bin\tsc.cmd --noEmit`, `npm.cmd run lint`, and `npm.cmd run build`.
From `backend`, run
`.\.venv\Scripts\python.exe -m pytest -q --noconftest tests/test_replay_preview_api.py`.
The Node suite exercises strict parsing,
cross-response validation, request gating, failure states and rendered markup
using captured backend responses. The API suite exercises the actual routes
without a database.

Validation passed 15 Node tests and 82 backend API tests. The local browser
smoke attempt stopped when Chrome closed its debugging connection before page
interaction, so browser keyboard and responsive behavior still need a manual
check. Automated markup tests cover semantic controls and accessible names.
