import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  canRunReplay,
  parseReplayPreview,
  replayFailure,
  replayPreviewEnabled,
} from "../src/lib/replay-preview-contract.ts";

const manifest = JSON.parse(readFileSync(new URL(
  "../../backend/app/replay_assets/encoded_powershell.manifest.json",
  import.meta.url,
), "utf8"));

function backendResponse() {
  return { manifest: structuredClone(manifest), verification: { status: "verified", reason: null } };
}

test("requires the exact server flag in development and stays disabled in production", () => {
  assert.equal(replayPreviewEnabled("development", "true"), true);
  for (const [environment, flag] of [
    ["development", undefined], ["development", "TRUE"], ["development", "true "],
    ["production", "true"], ["test", "true"], [undefined, "true"],
  ]) {
    assert.equal(replayPreviewEnabled(environment, flag), false);
  }
});

test("only analysts and administrators receive execution access", () => {
  assert.equal(canRunReplay("analyst"), true);
  assert.equal(canRunReplay("administrator"), true);
  assert.equal(canRunReplay("viewer"), false);
  assert.equal(canRunReplay("unknown"), false);
});

test("maps HTTP failures distinctly without consuming upstream error details", () => {
  assert.equal(replayFailure(401), "unauthenticated");
  assert.equal(replayFailure(403), "forbidden");
  assert.equal(replayFailure(404), "disabled");
  assert.equal(replayFailure(503), "unavailable");
  assert.equal(replayFailure(500), "unavailable");
  assert.equal(replayFailure(422), "invalid-response");
});

test("maps the backend manifest and preserves replay order and evidence", () => {
  const response = backendResponse();
  const result = parseReplayPreview(response);
  assert.deepEqual(result, response);
  assert.deepEqual(result.manifest.results.map(({ ordinal }) => ordinal), [1, 2, 0]);
});

test("drops fields outside the UI contract", () => {
  const response = backendResponse();
  response.private = "ignored";
  response.manifest.results[0].command_line = "ignored";
  assert.deepEqual(parseReplayPreview(response), backendResponse());
});

test("rejects missing, failed, unverified, malformed or inconsistent evidence", () => {
  assert.equal(parseReplayPreview(null), null);
  for (const mutate of [
    (response) => { response.manifest.results = []; },
    (response) => { response.manifest.status = "failed"; },
    (response) => { response.verification.status = "mismatch"; },
    (response) => { response.manifest.provenance.source = null; },
    (response) => { response.manifest.output_sha256 = "not-a-hash"; },
    (response) => { response.manifest.match_count = 2; },
    (response) => { response.manifest.results[0].ordinal = 2; },
    (response) => { response.manifest.results.reverse(); },
  ]) {
    const response = backendResponse();
    mutate(response);
    assert.equal(parseReplayPreview(response), null);
  }
});

test("rejects a completed response that contains evaluation errors even when its counts agree", () => {
  const response = backendResponse();
  response.manifest.results[0].outcome = "error";
  response.manifest.results[0].error = { code: "missing_field", field: "event_type" };
  response.manifest.error_count = 1;
  response.manifest.match_count = 0;
  assert.equal(parseReplayPreview(response), null);
});
