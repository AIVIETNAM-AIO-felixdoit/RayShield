/**
 * Integration tests for the RayShield backend API.
 * Uses Node's built-in test runner only (node:test + node:assert).
 * No Jest, Vitest, or Mocha.
 *
 * Scanner is still a stub on this branch (Felix's work) — tests never assert
 * on specific scanner rule names or finding counts. The re-scan check always
 * passes (rule not found) because the stub returns [].
 *
 * The apply endpoint writes to disk. Tests that exercise apply use a temp file
 * inside os.tmpdir() so demo-app/ is never modified by the test suite.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { cp, mkdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

// ── Helpers ───────────────────────────────────────────────────────────────────

const BASE = "http://localhost:3099";

/**
 * Make an HTTP request and parse the JSON body.
 * @param {string} method
 * @param {string} path
 * @param {object|null} body
 * @returns {Promise<{ status: number, body: unknown }>}
 */
function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: {
        "Content-Type": "application/json",
        ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
      },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/** Wait for the review to leave "queued"/"scanning" and reach a terminal state. */
async function waitForComplete(reviewId, maxAttempts = 20, intervalMs = 100) {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await request("GET", `/api/reviews/${reviewId}`);
    if (res.body.status === "complete" || res.body.status === "error") {
      return res.body;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Review ${reviewId} did not complete within timeout`);
}

/**
 * Create a review with a synthetic finding injected directly into the store.
 * Used to test endpoints that require a finding without depending on Felix's scanner.
 *
 * @param {object} opts
 * @param {string} [opts.rule]
 * @param {string} [opts.file]     - path to a real/temp file for apply tests
 * @param {string} [opts.severity]
 * @returns {Promise<{ reviewId: string, findingId: string }>}
 */
async function createReviewWithFinding({ rule = "test-rule", file = "f.js", severity = "high" } = {}) {
  const { createReview } = await import("../store.js");
  const reviewId = crypto.randomUUID();
  const review = createReview(reviewId, "demo-app");
  review.status = "complete";
  const findingId = crypto.randomUUID();
  review.findings.push({
    id: findingId,
    rule,
    severity,
    file,
    line: 1,
    description: "Synthetic test finding",
    source: "code",
  });
  return { reviewId, findingId };
}

// ── Server lifecycle ──────────────────────────────────────────────────────────

let server;

before(async () => {
  const { app } = await import("../index.js");
  await new Promise((resolve) => {
    server = app.listen(3099, resolve);
  });
});

after(async () => {
  await new Promise((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve()))
  );
});

// ── GET /health ───────────────────────────────────────────────────────────────

describe("GET /health", () => {
  it("returns service ok", async () => {
    const res = await request("GET", "/health");
    assert.equal(res.status, 200);
    assert.equal(res.body.service, "rayshield-api");
    assert.equal(res.body.status, "ok");
  });
});

// ── POST /api/reviews ─────────────────────────────────────────────────────────

describe("POST /api/reviews", () => {
  it("creates a review and returns reviewId, status queued, nextStep scan", async () => {
    const res = await request("POST", "/api/reviews", {});
    assert.equal(res.status, 202);
    assert.ok(res.body.reviewId, "reviewId should be present");
    assert.equal(res.body.status, "queued");
    assert.equal(res.body.nextStep, "scan");
  });
});

// ── GET /api/reviews/:reviewId ────────────────────────────────────────────────

describe("GET /api/reviews/:reviewId", () => {
  it("returns 404 for an unknown reviewId", async () => {
    const res = await request("GET", "/api/reviews/00000000-0000-0000-0000-000000000000");
    assert.equal(res.status, 404);
    assert.ok(res.body.error, "error message should be present");
  });

  it("returns the review and reaches complete status", async () => {
    const createRes = await request("POST", "/api/reviews", {});
    assert.equal(createRes.status, 202);
    const { reviewId } = createRes.body;

    const review = await waitForComplete(reviewId);
    assert.equal(review.reviewId, reviewId);
    assert.ok(
      review.status === "complete" || review.status === "error",
      `expected complete or error, got: ${review.status}`
    );
  });

  it("returns findings array (may be empty with stub scanner)", async () => {
    const createRes = await request("POST", "/api/reviews", {});
    const review = await waitForComplete(createRes.body.reviewId);
    assert.ok(Array.isArray(review.findings), "findings should be an array");
  });

  it("returns agentStatuses for all three agents", async () => {
    const createRes = await request("POST", "/api/reviews", {});
    const review = await waitForComplete(createRes.body.reviewId);
    assert.ok(typeof review.agentStatuses === "object", "agentStatuses should be present");
    assert.ok("codeAgent" in review.agentStatuses, "codeAgent status should be present");
    assert.ok("dependencyAgent" in review.agentStatuses, "dependencyAgent status should be present");
    assert.ok("contextAgent" in review.agentStatuses, "contextAgent status should be present");
  });

  it("returns agentSummaries and contextSummary", async () => {
    const createRes = await request("POST", "/api/reviews", {});
    const review = await waitForComplete(createRes.body.reviewId);
    assert.ok(typeof review.agentSummaries === "object", "agentSummaries should be present");
    assert.ok(typeof review.contextSummary === "string", "contextSummary should be a string");
  });
});

// ── POST /api/findings/:findingId/remediation ─────────────────────────────────

describe("POST /api/findings/:findingId/remediation", () => {
  it("returns 400 when reviewId is missing", async () => {
    const res = await request("POST", "/api/findings/any-id/remediation", {});
    assert.equal(res.status, 400);
    assert.ok(res.body.error);
  });

  it("returns 404 for unknown review", async () => {
    const res = await request("POST", "/api/findings/any-id/remediation", {
      reviewId: "00000000-0000-0000-0000-000000000000",
    });
    assert.equal(res.status, 404);
  });

  it("returns 404 for unknown findingId in a known review", async () => {
    const createRes = await request("POST", "/api/reviews", {});
    await waitForComplete(createRes.body.reviewId);
    const res = await request("POST", "/api/findings/nonexistent-finding/remediation", {
      reviewId: createRes.body.reviewId,
    });
    assert.equal(res.status, 404);
  });

  it("returns a proposal with no-fix-available for an unknown rule (no real source file)", async () => {
    const { reviewId, findingId } = await createReviewWithFinding({ rule: "unknown-rule", file: "nonexistent.js" });
    const res = await request("POST", `/api/findings/${findingId}/remediation`, { reviewId });
    assert.equal(res.status, 200);
    assert.equal(res.body.findingId, findingId);
    assert.equal(res.body.status, "no-fix-available");
    assert.ok(typeof res.body.explanation === "string");
    assert.equal(res.body.diff, "");
  });

  it("returns a proposed fix with real diff for a sql-injection finding when source matches", async () => {
    // Write a temp file that looks like the vulnerable queries.js
    const tmpFile = join(tmpdir(), `rayshield-test-sql-${crypto.randomUUID()}.js`);
    await writeFile(
      tmpFile,
      "export function getUserById(id) {\n" +
        "  return db.query(`SELECT * FROM users WHERE id = ${id}`);\n" +
        "}\n",
      "utf8"
    );

    try {
      const { reviewId, findingId } = await createReviewWithFinding({
        rule: "sql-injection",
        file: tmpFile,
      });
      const res = await request("POST", `/api/findings/${findingId}/remediation`, { reviewId });
      assert.equal(res.status, 200);
      assert.equal(res.body.findingId, findingId);
      assert.equal(res.body.status, "proposed");
      assert.ok(res.body.explanation.includes("SQL injection"), "explanation should mention SQL injection");
      assert.ok(res.body.diff.length > 0, "diff should be non-empty");
      assert.ok(res.body.diff.includes("---"), "diff should have removal lines");
      assert.ok(res.body.diff.includes("+++"), "diff should have addition lines");
    } finally {
      await unlink(tmpFile).catch(() => {});
    }
  });

  it("returns a proposed fix for xss-reflected when source contains unescaped req.query", async () => {
    const tmpFile = join(tmpdir(), `rayshield-test-xss-${crypto.randomUUID()}.js`);
    await writeFile(
      tmpFile,
      'export function searchHandler(req, res) {\n' +
        '  res.send(`<p>Results for: ${req.query.q}</p>`);\n' +
        '}\n',
      "utf8"
    );

    try {
      const { reviewId, findingId } = await createReviewWithFinding({
        rule: "xss-reflected",
        file: tmpFile,
      });
      const res = await request("POST", `/api/findings/${findingId}/remediation`, { reviewId });
      assert.equal(res.status, 200);
      assert.equal(res.body.status, "proposed");
      assert.ok(res.body.explanation.includes("XSS"), "explanation should mention XSS");
      assert.ok(res.body.diff.length > 0, "diff should be non-empty");
    } finally {
      await unlink(tmpFile).catch(() => {});
    }
  });

  it("returns a proposed fix for hardcoded-secret when source contains literal assignment", async () => {
    const tmpFile = join(tmpdir(), `rayshield-test-secret-${crypto.randomUUID()}.js`);
    await writeFile(
      tmpFile,
      'export const JWT_SECRET = "s3cr3t-demo-key-do-not-use";\n',
      "utf8"
    );

    try {
      const { reviewId, findingId } = await createReviewWithFinding({
        rule: "hardcoded-secret",
        file: tmpFile,
      });
      const res = await request("POST", `/api/findings/${findingId}/remediation`, { reviewId });
      assert.equal(res.status, 200);
      assert.equal(res.body.status, "proposed");
      assert.ok(res.body.explanation.includes("secret") || res.body.explanation.includes("Secret"), "explanation should mention secret");
      assert.ok(res.body.diff.length > 0, "diff should be non-empty");
    } finally {
      await unlink(tmpFile).catch(() => {});
    }
  });
});

// ── POST /api/findings/:findingId/approve ─────────────────────────────────────

describe("POST /api/findings/:findingId/approve", () => {
  it("returns 400 when reviewId is missing", async () => {
    const res = await request("POST", "/api/findings/any-id/approve", {});
    assert.equal(res.status, 400);
  });

  it("returns 404 for unknown review", async () => {
    const res = await request("POST", "/api/findings/any-id/approve", {
      reviewId: "00000000-0000-0000-0000-000000000000",
    });
    assert.equal(res.status, 404);
  });

  it("returns 404 for unknown findingId", async () => {
    const createRes = await request("POST", "/api/reviews", {});
    await waitForComplete(createRes.body.reviewId);
    const res = await request("POST", "/api/findings/no-such-finding/approve", {
      reviewId: createRes.body.reviewId,
    });
    assert.equal(res.status, 404);
  });

  it("returns 409 if no proposal exists yet", async () => {
    const { reviewId, findingId } = await createReviewWithFinding();
    const res = await request("POST", `/api/findings/${findingId}/approve`, { reviewId });
    assert.equal(res.status, 409);
  });

  it("approves a finding after a proposal exists", async () => {
    const { reviewId, findingId } = await createReviewWithFinding();
    await request("POST", `/api/findings/${findingId}/remediation`, { reviewId });
    const res = await request("POST", `/api/findings/${findingId}/approve`, { reviewId });
    assert.equal(res.status, 200);
    assert.equal(res.body.findingId, findingId);
    assert.equal(res.body.approved, true);
    assert.ok(typeof res.body.message === "string");
  });

  it("returns 409 when trying to approve a previously rejected proposal", async () => {
    const { reviewId, findingId } = await createReviewWithFinding();
    await request("POST", `/api/findings/${findingId}/remediation`, { reviewId });
    await request("POST", `/api/findings/${findingId}/reject`, { reviewId, reason: "Not good enough." });
    const res = await request("POST", `/api/findings/${findingId}/approve`, { reviewId });
    assert.equal(res.status, 409);
    assert.ok(res.body.error.includes("rejected"));
  });
});

// ── POST /api/findings/:findingId/reject ──────────────────────────────────────

describe("POST /api/findings/:findingId/reject", () => {
  it("returns 400 when reviewId is missing", async () => {
    const res = await request("POST", "/api/findings/any-id/reject", {});
    assert.equal(res.status, 400);
  });

  it("returns 404 for unknown review", async () => {
    const res = await request("POST", "/api/findings/any-id/reject", {
      reviewId: "00000000-0000-0000-0000-000000000000",
    });
    assert.equal(res.status, 404);
  });

  it("returns 404 for unknown findingId", async () => {
    const { reviewId } = await createReviewWithFinding();
    const res = await request("POST", `/api/findings/no-such-finding/reject`, { reviewId });
    assert.equal(res.status, 404);
  });

  it("returns 409 when no proposal exists", async () => {
    const { reviewId, findingId } = await createReviewWithFinding();
    const res = await request("POST", `/api/findings/${findingId}/reject`, { reviewId });
    assert.equal(res.status, 409);
    assert.ok(res.body.error.includes("No proposal"));
  });

  it("rejects a proposal and returns rejected:true with the reason", async () => {
    const { reviewId, findingId } = await createReviewWithFinding();
    await request("POST", `/api/findings/${findingId}/remediation`, { reviewId });
    const res = await request("POST", `/api/findings/${findingId}/reject`, {
      reviewId,
      reason: "Diff looks wrong.",
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.findingId, findingId);
    assert.equal(res.body.rejected, true);
    assert.equal(res.body.reason, "Diff looks wrong.");
  });

  it("a rejected proposal cannot be applied", async () => {
    const { reviewId, findingId } = await createReviewWithFinding();
    await request("POST", `/api/findings/${findingId}/remediation`, { reviewId });
    await request("POST", `/api/findings/${findingId}/reject`, { reviewId });
    // Manually inject approval to ensure reject blocks apply independently of approve gate
    const { reviews } = await import("../store.js");
    const review = reviews.get(reviewId);
    review.approvals[findingId] = true; // force past approve gate
    const applyRes = await request("POST", `/api/findings/${findingId}/apply`, { reviewId });
    // apply requires fixedSource — stub has none, so 409 for that reason
    // The important thing is it does NOT apply
    assert.notEqual(applyRes.status, 200, "rejected proposal should not produce a successful apply");
  });
});

// ── POST /api/findings/:findingId/apply ───────────────────────────────────────

describe("POST /api/findings/:findingId/apply", () => {
  it("returns 400 when reviewId is missing", async () => {
    const res = await request("POST", "/api/findings/any-id/apply", {});
    assert.equal(res.status, 400);
  });

  it("returns 404 for unknown review", async () => {
    const res = await request("POST", "/api/findings/any-id/apply", {
      reviewId: "00000000-0000-0000-0000-000000000000",
    });
    assert.equal(res.status, 404);
  });

  it("returns 404 for unknown findingId", async () => {
    const { reviewId } = await createReviewWithFinding();
    const res = await request("POST", `/api/findings/no-such-finding/apply`, { reviewId });
    assert.equal(res.status, 404);
  });

  it("returns 409 when no proposal exists", async () => {
    const { reviewId, findingId } = await createReviewWithFinding();
    const res = await request("POST", `/api/findings/${findingId}/apply`, { reviewId });
    assert.equal(res.status, 409);
    assert.ok(res.body.error.includes("No remediation proposal"));
  });

  it("returns 409 when proposal exists but not approved", async () => {
    const { reviewId, findingId } = await createReviewWithFinding();
    await request("POST", `/api/findings/${findingId}/remediation`, { reviewId });
    const res = await request("POST", `/api/findings/${findingId}/apply`, { reviewId });
    assert.equal(res.status, 409);
    assert.ok(res.body.error.includes("approved"));
  });

  it("returns 409 when proposal has no fixedSource (no-fix-available rule)", async () => {
    const { reviewId, findingId } = await createReviewWithFinding({ rule: "unknown-rule", file: "f.js" });
    await request("POST", `/api/findings/${findingId}/remediation`, { reviewId });
    await request("POST", `/api/findings/${findingId}/approve`, { reviewId });
    const res = await request("POST", `/api/findings/${findingId}/apply`, { reviewId });
    assert.equal(res.status, 409);
    assert.ok(res.body.error.includes("no fixed source content"));
  });

  it("applies an approved sql-injection fix to a temp file on disk", async () => {
    const originalSource =
      "export function getUserById(id) {\n" +
      "  return db.query(`SELECT * FROM users WHERE id = ${id}`);\n" +
      "}\n";
    const tmpFile = join(tmpdir(), `rayshield-apply-sql-${crypto.randomUUID()}.js`);
    await writeFile(tmpFile, originalSource, "utf8");

    try {
      const { reviewId, findingId } = await createReviewWithFinding({
        rule: "sql-injection",
        file: tmpFile,
      });

      // propose → approve → apply
      const propRes = await request("POST", `/api/findings/${findingId}/remediation`, { reviewId });
      assert.equal(propRes.body.status, "proposed", "should have a proposed fix");

      await request("POST", `/api/findings/${findingId}/approve`, { reviewId });

      const applyRes = await request("POST", `/api/findings/${findingId}/apply`, { reviewId });
      assert.equal(applyRes.status, 200);
      assert.equal(applyRes.body.findingId, findingId);
      assert.equal(applyRes.body.applied, true);
      assert.ok(typeof applyRes.body.appliedAt === "string", "appliedAt should be an ISO string");
      assert.equal(applyRes.body.file, tmpFile);

      // Verify the file was actually modified on disk
      const newSource = await readFile(tmpFile, "utf8");
      assert.notEqual(newSource, originalSource, "file content should have changed");
      assert.ok(!newSource.includes("${id}"), "interpolated variable should be gone from fixed file");
    } finally {
      await unlink(tmpFile).catch(() => {});
    }
  });

  it("apply is idempotent — calling twice returns the same appliedAt", async () => {
    const tmpFile = join(tmpdir(), `rayshield-idempotent-${crypto.randomUUID()}.js`);
    await writeFile(
      tmpFile,
      "export function getUserById(id) {\n" +
        "  return db.query(`SELECT * FROM users WHERE id = ${id}`);\n" +
        "}\n",
      "utf8"
    );

    try {
      const { reviewId, findingId } = await createReviewWithFinding({ rule: "sql-injection", file: tmpFile });
      await request("POST", `/api/findings/${findingId}/remediation`, { reviewId });
      await request("POST", `/api/findings/${findingId}/approve`, { reviewId });

      const first = await request("POST", `/api/findings/${findingId}/apply`, { reviewId });
      const second = await request("POST", `/api/findings/${findingId}/apply`, { reviewId });

      assert.equal(first.status, 200);
      assert.equal(second.status, 200);
      assert.equal(first.body.appliedAt, second.body.appliedAt, "appliedAt should be identical on second call");
    } finally {
      await unlink(tmpFile).catch(() => {});
    }
  });
});

// ── POST /api/findings/:findingId/validate ────────────────────────────────────

describe("POST /api/findings/:findingId/validate", () => {
  it("returns 409 when not yet approved", async () => {
    const { reviewId, findingId } = await createReviewWithFinding();
    const { reviews } = await import("../store.js");
    const review = reviews.get(reviewId);
    review.proposals[findingId] = { status: "proposal-pending", findingId, explanation: "", diff: "", fixedSource: "" };

    const res = await request("POST", `/api/findings/${findingId}/validate`, { reviewId });
    assert.equal(res.status, 409);
    assert.ok(res.body.error);
  });

  it("returns NOT VERIFIED when approved but fix not yet applied", async () => {
    const { reviewId, findingId } = await createReviewWithFinding();
    const { reviews } = await import("../store.js");
    const review = reviews.get(reviewId);
    // Inject a proposal and approval but no apply
    review.proposals[findingId] = { status: "proposed", findingId, explanation: "e", diff: "d", fixedSource: "x" };
    review.approvals[findingId] = true;

    const res = await request("POST", `/api/findings/${findingId}/validate`, { reviewId });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "NOT VERIFIED");
    assert.ok(Array.isArray(res.body.checks));
    assert.ok(res.body.checks.length > 0, "checks must not be empty");
    // The fix-applied check must be failed
    const applyCheck = res.body.checks.find((c) => c.name === "fix-applied");
    assert.ok(applyCheck, "fix-applied check must be present");
    assert.equal(applyCheck.status, "failed");
  });

  it("returns NOT VERIFIED with empty checks blocked by validator contract", () => {
    // Verify that summarizeValidation([]) === NOT VERIFIED per the contract
    // (tested here without HTTP to confirm the contract is not broken)
    import("../../../validator/src/index.js").then(({ summarizeValidation }) => {
      const result = summarizeValidation([]);
      assert.equal(result.status, "NOT VERIFIED");
    });
  });

  it("returns 400 when reviewId is missing", async () => {
    const res = await request("POST", "/api/findings/any-id/validate", {});
    assert.equal(res.status, 400);
  });

  it("returns 404 for unknown review", async () => {
    const res = await request("POST", "/api/findings/any-id/validate", {
      reviewId: "00000000-0000-0000-0000-000000000000",
    });
    assert.equal(res.status, 404);
  });

  it("returns FIX VERIFIED when fix is applied and re-scan finds no matching rule", async () => {
    // With the stub scanner (always returns []), the re-scan check always passes
    // (rule not found in rescan = vulnerability resolved). We just need the
    // fix-applied check to also pass.
    const tmpFile = join(tmpdir(), `rayshield-verify-${crypto.randomUUID()}.js`);
    await writeFile(
      tmpFile,
      "export function getUserById(id) {\n" +
        "  return db.query(`SELECT * FROM users WHERE id = ${id}`);\n" +
        "}\n",
      "utf8"
    );

    try {
      const { reviewId, findingId } = await createReviewWithFinding({
        rule: "sql-injection",
        file: tmpFile,
      });

      // Full workflow: propose → approve → apply → validate
      await request("POST", `/api/findings/${findingId}/remediation`, { reviewId });
      await request("POST", `/api/findings/${findingId}/approve`, { reviewId });
      await request("POST", `/api/findings/${findingId}/apply`, { reviewId });

      const res = await request("POST", `/api/findings/${findingId}/validate`, { reviewId });
      assert.equal(res.status, 200);
      assert.equal(res.body.findingId, findingId);
      assert.ok(Array.isArray(res.body.checks), "checks should be an array");
      assert.ok(res.body.checks.length > 0, "checks must not be empty");
      assert.ok(Array.isArray(res.body.rescanFindings), "rescanFindings should be an array");

      // With stub scanner finding nothing and fix applied: FIX VERIFIED
      assert.equal(res.body.status, "FIX VERIFIED", "should be FIX VERIFIED when fix is applied and rule is absent in re-scan");

      const applyCheck = res.body.checks.find((c) => c.name === "fix-applied");
      assert.equal(applyCheck.status, "passed");
      const rescanCheck = res.body.checks.find((c) => c.name === "re-scan");
      assert.equal(rescanCheck.status, "passed");
    } finally {
      await unlink(tmpFile).catch(() => {});
    }
  });

  it("re-scan returns an array of findings (may be empty with stub scanner)", async () => {
    const { reviewId, findingId } = await createReviewWithFinding();
    const { reviews } = await import("../store.js");
    const review = reviews.get(reviewId);
    review.proposals[findingId] = { status: "proposed", findingId, explanation: "e", diff: "d", fixedSource: "x" };
    review.approvals[findingId] = true;
    review.applied[findingId] = new Date().toISOString();

    const res = await request("POST", `/api/findings/${findingId}/validate`, { reviewId });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.rescanFindings), "rescanFindings must be an array");
  });
});

// ── End-to-end workflow: propose → approve → apply → validate → FIX VERIFIED ──

describe("End-to-end: full workflow with sql-injection finding", () => {
  it("completes propose → approve → apply → validate → FIX VERIFIED", async () => {
    const originalSource =
      "export function getUserById(id) {\n" +
      "  return db.query(`SELECT * FROM users WHERE id = ${id}`);\n" +
      "}\n";
    const tmpFile = join(tmpdir(), `rayshield-e2e-${crypto.randomUUID()}.js`);
    await writeFile(tmpFile, originalSource, "utf8");

    try {
      const { reviewId, findingId } = await createReviewWithFinding({
        rule: "sql-injection",
        file: tmpFile,
      });

      // Step 1: Propose
      const propRes = await request("POST", `/api/findings/${findingId}/remediation`, { reviewId });
      assert.equal(propRes.status, 200);
      assert.equal(propRes.body.status, "proposed");
      assert.ok(propRes.body.diff.length > 0, "diff must be present");

      // Step 2: Approve
      const approveRes = await request("POST", `/api/findings/${findingId}/approve`, { reviewId });
      assert.equal(approveRes.status, 200);
      assert.equal(approveRes.body.approved, true);

      // Step 3: Apply
      const applyRes = await request("POST", `/api/findings/${findingId}/apply`, { reviewId });
      assert.equal(applyRes.status, 200);
      assert.equal(applyRes.body.applied, true);

      // Verify file changed on disk
      const fixedContent = await readFile(tmpFile, "utf8");
      assert.notEqual(fixedContent, originalSource);

      // Step 4: Validate
      const validateRes = await request("POST", `/api/findings/${findingId}/validate`, { reviewId });
      assert.equal(validateRes.status, 200);
      assert.equal(validateRes.body.status, "FIX VERIFIED");

      // Both checks passed
      for (const check of validateRes.body.checks) {
        assert.equal(check.status, "passed", `check "${check.name}" should have passed`);
      }
    } finally {
      await unlink(tmpFile).catch(() => {});
    }
  });

  it("rejected fix cannot be applied — does not reach FIX VERIFIED without new proposal", async () => {
    const { reviewId, findingId } = await createReviewWithFinding();

    await request("POST", `/api/findings/${findingId}/remediation`, { reviewId });
    await request("POST", `/api/findings/${findingId}/reject`, { reviewId, reason: "Too risky." });

    // Approve should fail because proposal was rejected
    const approveRes = await request("POST", `/api/findings/${findingId}/approve`, { reviewId });
    assert.equal(approveRes.status, 409, "approve should be blocked after rejection");

    // Validate without approval should also fail
    const validateRes = await request("POST", `/api/findings/${findingId}/validate`, { reviewId });
    assert.equal(validateRes.status, 409, "validate should be blocked without approval");
  });
});

// ── REAL VERTICAL SLICE: SQL Injection end-to-end with real scanner ───────────
//
// This test suite exercises the complete RayShield workflow using:
//   - A temporary copy of demo-app/src/ (real vulnerable source files)
//   - The real scanner rules (sql-injection, xss-reflected, hardcoded-secret)
//   - The deterministic remediation provider
//   - The full approve → apply → validate → FIX VERIFIED chain
//
// A temp directory copy is used so the real demo-app files are never modified
// by the test runner.

const __dirname_test = fileURLToPath(new URL(".", import.meta.url));
// Workspace root is 3 directories up from backend/src/test/
const WORKSPACE_ROOT = resolve(__dirname_test, "../../..");
const DEMO_APP_SRC = join(WORKSPACE_ROOT, "demo-app", "src");

describe("Real vertical slice: SQL injection end-to-end with real scanner", () => {
  // Each test in this suite gets its own isolated temp directory containing
  // a copy of demo-app/src/ so tests don't interfere with each other or
  // permanently modify the demo application.

  /**
   * Create an isolated temp copy of demo-app/src/ for one test.
   * @returns {Promise<{ tmpProjectDir: string, cleanup: () => Promise<void> }>}
   */
  async function makeTempProject() {
    const tmpProjectDir = join(tmpdir(), `rayshield-real-${crypto.randomUUID()}`);
    await mkdir(tmpProjectDir, { recursive: true });
    // Copy demo-app/src/ into the temp dir so the scanner walks a real copy
    try {
      await cp(DEMO_APP_SRC, join(tmpProjectDir, "src"), { recursive: true });
    } catch {
      // demo-app/src may not exist on this run — let the test handle it gracefully
    }
    return {
      tmpProjectDir,
      cleanup: () => rm(tmpProjectDir, { recursive: true, force: true }),
    };
  }

  it("real scanner detects sql-injection in demo-app/src/db/queries.js copy", async () => {
    const { tmpProjectDir, cleanup } = await makeTempProject();
    try {
      // Start a review pointed at the temp project
      const createRes = await request("POST", "/api/reviews", { projectPath: tmpProjectDir });
      assert.equal(createRes.status, 202, "POST /api/reviews should return 202");
      const { reviewId } = createRes.body;

      // Wait for orchestration to complete
      const review = await waitForComplete(reviewId);
      assert.ok(
        review.status === "complete" || review.status === "error",
        `Review should reach terminal state, got: ${review.status}`
      );

      // Verify real findings are returned
      assert.ok(Array.isArray(review.findings), "findings should be an array");
      assert.ok(review.findings.length > 0, `Expected at least 1 real finding, got: ${review.findings.length}`);

      const sqlFindings = review.findings.filter((f) => f.rule === "sql-injection");
      assert.ok(sqlFindings.length > 0, `Expected at least 1 sql-injection finding, got: ${sqlFindings.length}`);

      // Verify finding shape
      const f = sqlFindings[0];
      assert.ok(typeof f.id === "string" && f.id.length > 0, "finding.id must be a non-empty string");
      assert.equal(f.rule, "sql-injection");
      assert.equal(f.severity, "critical");
      assert.ok(typeof f.file === "string" && f.file.length > 0, "finding.file must be set");
      assert.ok(typeof f.line === "number" && f.line > 0, "finding.line must be a positive integer");
      assert.ok(typeof f.description === "string" && f.description.length > 0);
    } finally {
      await cleanup();
    }
  });

  it("real scan returns 6 findings total (2 sql-injection, 1 xss-reflected, 3 hardcoded-secret)", async () => {
    const { tmpProjectDir, cleanup } = await makeTempProject();
    try {
      const createRes = await request("POST", "/api/reviews", { projectPath: tmpProjectDir });
      const review = await waitForComplete(createRes.body.reviewId);

      const byRule = {};
      for (const f of review.findings) {
        byRule[f.rule] = (byRule[f.rule] ?? 0) + 1;
      }

      assert.equal(byRule["sql-injection"] ?? 0, 2, `Expected 2 sql-injection findings, got ${byRule["sql-injection"] ?? 0}`);
      assert.equal(byRule["xss-reflected"] ?? 0, 1, `Expected 1 xss-reflected finding, got ${byRule["xss-reflected"] ?? 0}`);
      assert.equal(byRule["hardcoded-secret"] ?? 0, 3, `Expected 3 hardcoded-secret findings, got ${byRule["hardcoded-secret"] ?? 0}`);
      assert.equal(review.findings.length, 6, `Expected 6 total findings, got ${review.findings.length}`);
    } finally {
      await cleanup();
    }
  });

  it("sql-injection findings are prioritized as critical before high findings", async () => {
    const { tmpProjectDir, cleanup } = await makeTempProject();
    try {
      const createRes = await request("POST", "/api/reviews", { projectPath: tmpProjectDir });
      const review = await waitForComplete(createRes.body.reviewId);

      assert.ok(review.findings.length > 1, "Need at least 2 findings to test ordering");
      // First finding must be critical (sql-injection)
      assert.equal(review.findings[0].severity, "critical", "First finding should be critical severity");
      assert.equal(review.findings[0].rule, "sql-injection", "First finding should be sql-injection");
    } finally {
      await cleanup();
    }
  });

  it("FULL SQL INJECTION VERTICAL SLICE: scan → remediation → approval enforced → apply → re-scan → FIX VERIFIED", async () => {
    const { tmpProjectDir, cleanup } = await makeTempProject();
    try {
      // ── Step 1: Start review and scan ─────────────────────────────────────
      const createRes = await request("POST", "/api/reviews", { projectPath: tmpProjectDir });
      assert.equal(createRes.status, 202);
      const { reviewId } = createRes.body;
      assert.ok(reviewId, "reviewId must be present");

      const review = await waitForComplete(reviewId);
      assert.equal(review.status, "complete", `Review should be complete, got: ${review.status}`);
      assert.ok(review.findings.length > 0, "Review must have at least one real finding");

      // ── Step 2: Obtain SQL injection finding ──────────────────────────────
      const sqlFinding = review.findings.find((f) => f.rule === "sql-injection");
      assert.ok(sqlFinding, "Must have at least one sql-injection finding from the real scanner");
      const findingId = sqlFinding.id;

      // ── Step 3: Request remediation proposal ──────────────────────────────
      const propRes = await request("POST", `/api/findings/${findingId}/remediation`, { reviewId });
      assert.equal(propRes.status, 200, "Remediation endpoint must return 200");
      assert.equal(propRes.body.findingId, findingId);
      assert.equal(propRes.body.status, "proposed", `Expected 'proposed', got: '${propRes.body.status}'`);
      assert.ok(propRes.body.explanation.includes("SQL injection"), "Explanation must mention SQL injection");
      assert.ok(propRes.body.diff.length > 0, "Diff must be non-empty");
      assert.ok(propRes.body.diff.includes("---"), "Diff must have removal lines");
      assert.ok(propRes.body.diff.includes("+++"), "Diff must have addition lines");

      // ── Step 4: Attempt apply BEFORE approval — must be rejected ──────────
      const earlyApplyRes = await request("POST", `/api/findings/${findingId}/apply`, { reviewId });
      assert.equal(
        earlyApplyRes.status, 409,
        `Apply before approval must return 409, got: ${earlyApplyRes.status}`
      );
      assert.ok(
        earlyApplyRes.body.error.includes("approved"),
        "Error message must say fix is not approved"
      );

      // ── Step 5: Approve ───────────────────────────────────────────────────
      const approveRes = await request("POST", `/api/findings/${findingId}/approve`, { reviewId });
      assert.equal(approveRes.status, 200, "Approve must return 200");
      assert.equal(approveRes.body.findingId, findingId);
      assert.equal(approveRes.body.approved, true);

      // ── Step 6: Apply fix ─────────────────────────────────────────────────
      const applyRes = await request("POST", `/api/findings/${findingId}/apply`, { reviewId });
      assert.equal(applyRes.status, 200, "Apply must return 200 after approval");
      assert.equal(applyRes.body.findingId, findingId);
      assert.equal(applyRes.body.applied, true);
      assert.ok(typeof applyRes.body.appliedAt === "string", "appliedAt must be an ISO string");
      assert.equal(applyRes.body.file, sqlFinding.file, "Apply must report the correct file path");

      // ── Step 7: Confirm source file actually changed on disk ──────────────
      const fixedSource = await readFile(sqlFinding.file, "utf8");
      // The interpolated ${...} must be gone from the SQL query line
      const sqlLineVulnerable = fixedSource
        .split("\n")
        .some((line) =>
          /`[^`]*\bSELECT\b[^`]*\$\{[^}]+\}[^`]*`/i.test(line)
        );
      assert.ok(
        !sqlLineVulnerable,
        "After fix is applied, no interpolated SQL template literal should remain in the file"
      );

      // ── Step 8: Re-scan — sql-injection must be absent from the fixed file ─
      const { scanProject } = await import("../../../scanner/src/index.js");
      const rescan = await scanProject({ projectPath: tmpProjectDir });
      const stillVulnerable = rescan.findings.some(
        (f) => f.rule === "sql-injection" && f.file === sqlFinding.file
      );
      assert.ok(
        !stillVulnerable,
        `sql-injection should no longer be detected in ${sqlFinding.file} after fix is applied`
      );

      // ── Step 9: Validate → FIX VERIFIED ──────────────────────────────────
      const validateRes = await request("POST", `/api/findings/${findingId}/validate`, { reviewId });
      assert.equal(validateRes.status, 200, "Validate must return 200");
      assert.equal(validateRes.body.findingId, findingId);

      // checks must be non-empty (summarizeValidation([]) contract)
      assert.ok(Array.isArray(validateRes.body.checks), "checks must be an array");
      assert.ok(validateRes.body.checks.length > 0, "checks must not be empty");
      assert.ok(Array.isArray(validateRes.body.rescanFindings), "rescanFindings must be an array");

      // Both checks must pass
      const applyCheck = validateRes.body.checks.find((c) => c.name === "fix-applied");
      assert.ok(applyCheck, "fix-applied check must be present");
      assert.equal(applyCheck.status, "passed", "fix-applied check must be passed");

      const rescanCheck = validateRes.body.checks.find((c) => c.name === "re-scan");
      assert.ok(rescanCheck, "re-scan check must be present");
      assert.equal(rescanCheck.status, "passed", "re-scan check must be passed — rule no longer detected");

      // Final verdict
      assert.equal(
        validateRes.body.status,
        "FIX VERIFIED",
        `Expected FIX VERIFIED, got: ${validateRes.body.status}`
      );
    } finally {
      await cleanup();
    }
  });
});
