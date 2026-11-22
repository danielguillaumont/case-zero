import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import { createElement } from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const src = new URL("../src/", import.meta.url);
globalThis.comparisonTestJsx = jsxRuntime;
const authStub = `data:text/javascript,${encodeURIComponent(`
  export async function getAccessToken() { return globalThis.comparisonTestToken; }
  export async function getAuthorizationHeaders() {
    return globalThis.comparisonTestToken ? {Authorization: "Bearer " + globalThis.comparisonTestToken} : {};
  }
`)}`;
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "server-only") return { url: "data:text/javascript,export%20%7B%7D", shortCircuit: true };
    if (specifier === "@/lib/auth") return { url: authStub, shortCircuit: true };
    if (specifier === "next/link") return {
      url: "data:text/javascript,export%20default%20function%20Link()%20%7Breturn%20null%7D",
      shortCircuit: true,
    };
    if (specifier === "react/jsx-runtime") return {
      url: "data:text/javascript,export%20const%20%7Bjsx%2Cjsxs%2CFragment%7D%3DglobalThis.comparisonTestJsx",
      shortCircuit: true,
    };
    const base = specifier.startsWith("@/") ? new URL(specifier.slice(2), src) :
      specifier.startsWith("./") && context.parentURL?.startsWith(src.href) ? new URL(specifier, context.parentURL) : null;
    if (base) return { url: new URL(base.href + ".ts").href, shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith(src.href) && /\.(ts|tsx)$/.test(url)) {
      const source = ts.transpileModule(readFileSync(new URL(url), "utf8"), {
        fileName: url,
        compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
      }).outputText;
      return { format: "module", source, shortCircuit: true };
    }
    return next(url, context);
  },
});

const { parseComparison, parseEvidence } = await import("../src/lib/comparison-preview-contract.ts");
const { requestComparisonPreview, requestExpectationEvidence } = await import("../src/lib/api.ts");
const { inspectEvidenceAction } = await import("../src/app/lab/actions.ts");
const { default: Workspace, ComparisonResults, EvidenceDetails } = await import("../src/app/lab/ComparisonWorkspace.tsx");
const captured = JSON.parse(readFileSync(new URL("./fixtures/comparison-preview.json", import.meta.url), "utf8"));
const digest = captured.comparison.comparison_sha256;
const selected = "encoded-switch";

test("parses the actual comparison and each actual evidence response", () => {
  const comparison = parseComparison(captured.comparison);
  assert.deepEqual(comparison, captured.comparison);
  assert.deepEqual(comparison.baseline.labeled_satisfaction, { numerator: 2, denominator: 3 });
  assert.deepEqual(comparison.candidate.labeled_satisfaction, { numerator: 3, denominator: 3 });
  assert.equal(comparison.baseline.totals.false_negative, 1);
  assert.equal(comparison.candidate.totals.true_positive, 1);
  for (const [id, evidence] of Object.entries(captured.evidence)) {
    assert.deepEqual(parseEvidence(evidence, comparison, id), evidence);
  }
});

test("rejects incorrect comparison schema, counts, identities and references", () => {
  for (const mutate of [
    (p) => { p.schema_version = 2; },
    (p) => { p.fixture_id = "wrong"; },
    (p) => { p.baseline.requested_version_id[0] = "wrong"; },
    (p) => { p.candidate.executed_version_id = p.baseline.executed_version_id; },
    (p) => { p.fixture_sha256 = "wrong"; },
    (p) => { p.baseline.labeled_satisfaction.denominator = 2; },
    (p) => { p.baseline.totals.false_negative = 0; },
    (p) => { p.labeled_events = 2; },
    (p) => { p.candidate.passed = false; },
    (p) => { p.candidate_minus_baseline.false_negative = 1; },
    (p) => { p.change_totals.improved = 0; },
    (p) => { p.expectations.reverse(); },
    (p) => { p.expectations[2].baseline_classification = "true_negative"; },
    (p) => { p.expectations[2].change = "regressed"; },
    (p) => { p.expectations[2].command_line = "TEST_ONLY_PRIVATE_VALUE"; },
  ]) {
    const comparison = structuredClone(captured.comparison);
    mutate(comparison);
    assert.equal(parseComparison(comparison), null);
  }
});

test("rejects evidence that does not agree with the selected row and parent", () => {
  const comparison = parseComparison(captured.comparison);
  const evidence = captured.evidence[selected];
  assert.equal(parseEvidence(evidence, comparison, "benign-get-date"), null);
  for (const mutate of [
    (e) => { e.source_event_id = "other"; },
    (e) => { e.source_event_ordinal = 3; },
    (e) => { e.expected_outcome = "no_match"; },
    (e) => { e.event_time = "2026-02-30T12:00:00.000000Z"; },
    (e) => { e.comparison_sha256 = "0".repeat(64); },
    (e) => { e.evidence_sha256 = "bad"; },
    (e) => { e.baseline.grade_sha256 = e.candidate.grade_sha256; },
    (e) => { e.baseline.executed_version_id = e.candidate.executed_version_id; },
    (e) => { e.candidate.observed_outcome = "no_match"; },
    (e) => { e.candidate.diagnostic_code = "TEST_ONLY_PRIVATE_VALUE"; },
    (e) => { e.candidate.command_line = "TEST_ONLY_PRIVATE_VALUE"; },
  ]) {
    const sample = structuredClone(evidence);
    mutate(sample);
    assert.equal(parseEvidence(sample, comparison, selected), null);
  }
});

test("reversed classifications produce a regression and preserve the denominator", () => {
  const input = structuredClone(captured.comparison);
  [input.baseline, input.candidate] = [input.candidate, input.baseline];
  for (const row of input.expectations) {
    [row.baseline_classification, row.candidate_classification] = [row.candidate_classification, row.baseline_classification];
    if (row.change === "improved") row.change = "regressed";
  }
  [input.change_totals.improved, input.change_totals.regressed] = [0, 1];
  for (const key of Object.keys(input.candidate_minus_baseline)) input.candidate_minus_baseline[key] *= -1;
  const comparison = parseComparison(input);
  assert.equal(comparison.expectations[2].change, "regressed");
  assert.equal(comparison.labeled_events, 3);
  assert.match(renderToStaticMarkup(createElement(ComparisonResults, { comparison })), /Regressed/);
});

function serverContext(t) {
  const savedEnv = { ...process.env };
  const originalFetch = globalThis.fetch;
  process.env.NODE_ENV = "development";
  process.env.CASE_ZERO_LAB_PREVIEW = "true";
  globalThis.comparisonTestToken = "unit-test-session";
  t.after(() => {
    globalThis.fetch = originalFetch;
    delete globalThis.comparisonTestToken;
    for (const name of ["NODE_ENV", "CASE_ZERO_LAB_PREVIEW"]) {
      if (savedEnv[name] === undefined) delete process.env[name];
      else process.env[name] = savedEnv[name];
    }
  });
}

test("server action uses authenticated bounded fetches and binds selected evidence", async (t) => {
  serverContext(t);
  const calls = [];
  globalThis.fetch = async (url, options) => {
    const path = new URL(url).pathname;
    calls.push({ path, options });
    assert.equal(options.headers.get("authorization"), "Bearer unit-test-session");
    assert.equal(options.cache, "no-store");
    assert.equal(options.method, "GET");
    assert.equal(options.redirect, "error");
    assert.ok(options.signal instanceof AbortSignal);
    return Response.json(path.endsWith("/evidence") ? captured.evidence[selected] : captured.comparison);
  };
  const form = new FormData();
  form.set("expectation", selected);
  assert.deepEqual(await inspectEvidenceAction(digest, { status: "idle" }, form), {
    status: "success", preview: captured.evidence[selected],
  });
  assert.deepEqual(calls.map((call) => call.path), [
    "/api/lab/comparison-preview", "/api/lab/comparison-preview/expectations/encoded-switch/evidence",
  ]);
  assert.equal(calls[0].options.signal, calls[1].options.signal);
  assert.equal((await requestExpectationEvidence("untrusted-path", digest)).status, "evidence-not-found");
  assert.equal(calls.length, 2);
  assert.equal((await requestExpectationEvidence(selected, "0".repeat(64))).status, "invalid-response");
  assert.equal(calls.length, 3);
});

test("server state maps failures distinctly and never fetches anonymously or in production", async (t) => {
  serverContext(t);
  globalThis.fetch = async () => assert.fail("Disabled or anonymous preview made a request");
  process.env.NODE_ENV = "production";
  assert.equal((await requestComparisonPreview()).status, "disabled");
  assert.equal((await requestExpectationEvidence(selected, digest)).status, "disabled");
  process.env.NODE_ENV = "development";
  delete globalThis.comparisonTestToken;
  assert.equal((await requestComparisonPreview()).status, "unauthenticated");
  assert.equal((await requestExpectationEvidence(selected, digest)).status, "unauthenticated");
  globalThis.comparisonTestToken = "unit-test-session";
  for (const [code, state] of [[401, "unauthenticated"], [403, "forbidden"], [404, "disabled"], [503, "unavailable"]]) {
    globalThis.fetch = async () => new Response("TEST_ONLY_PRIVATE_VALUE", { status: code });
    assert.deepEqual(await requestComparisonPreview(), { status: state });
  }
  globalThis.fetch = async (url) => new URL(url).pathname.endsWith("/evidence") ?
    new Response(null, { status: 404 }) : Response.json(captured.comparison);
  assert.deepEqual(await requestExpectationEvidence(selected, digest), { status: "evidence-not-found" });
  globalThis.fetch = async () => { throw new Error("TEST_ONLY_PRIVATE_VALUE"); };
  assert.deepEqual(await requestComparisonPreview(), { status: "unavailable" });
  globalThis.fetch = async () => new Response(" ".repeat(16 * 1024 + 1));
  assert.deepEqual(await requestComparisonPreview(), { status: "invalid-response" });
});

test("renders real denominators, semantic keyboard controls, and redacted evidence", () => {
  const idle = renderToStaticMarkup(createElement(Workspace, { canRun: true }));
  assert.match(idle, /type="submit"[^>]*>Run comparison/);
  assert.match(idle, /role="status" aria-live="polite"/);
  assert.doesNotMatch(idle, /labels satisfied/);
  const viewer = renderToStaticMarkup(createElement(Workspace, { canRun: false }));
  assert.doesNotMatch(viewer, /<button/);
  assert.match(viewer, /Only active analysts and administrators/);

  const comparison = parseComparison(captured.comparison);
  const html = renderToStaticMarkup(createElement(ComparisonResults, { comparison }));
  assert.match(html, /2\/3 labels satisfied/);
  assert.match(html, /3\/3 labels satisfied/);
  assert.match(html, /3 authored expectations across 3 events/);
  assert.match(html, /<th scope="col"/);
  assert.match(html, /<th scope="row"/);
  const button = html.match(/<button\b[^>]*value="encoded-switch"[^>]*>/)?.[0] ?? "";
  assert.match(button, /type="submit"/);
  assert.match(button, /name="expectation"/);
  assert.match(html, /aria-controls="comparison-evidence"/);
  assert.match(html, /tabindex="0" role="region"/i);
  assert.match(html, /False negative/);

  const evidence = parseEvidence(captured.evidence[selected], comparison, selected);
  const detail = renderToStaticMarkup(createElement(EvidenceDetails, { evidence }));
  assert.match(detail, /Expected outcome/);
  assert.match(detail, /expected_detection_missed/);
  assert.match(detail, /<summary[^>]*>Parent comparison SHA-256/);
  assert.match(detail, new RegExp(evidence.evidence_sha256));
  assert.doesNotMatch(html + detail, /command_line|pwsh\.exe| -enc |TEST_ONLY_PRIVATE_VALUE/);
});

test("browser workspace has no privileged request implementation", () => {
  const workspace = readFileSync(new URL("../src/app/lab/ComparisonWorkspace.tsx", import.meta.url), "utf8");
  assert.match(workspace, /from "\.\/actions"/);
  assert.doesNotMatch(workspace, /\bfetch\s*\(|\/api\/lab|\/lib\/api|Bearer|document\.cookie|dangerouslySetInnerHTML/);
});
