import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { app } from "./index.js";

let server;
let base;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      base = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

// ── POST /api/reviews ────────────────────────────────────────────────────────

test("POST /api/reviews returns 202 with reviewId and status", async () => {
  const res = await fetch(`${base}/api/reviews`, { method: "POST" });
  assert.equal(res.status, 202);
  const body = await res.json();
  assert.ok(body.reviewId, "must have reviewId");
  assert.equal(body.status, "scanned");
  assert.ok(Array.isArray(body.findings), "findings must be an array");
});

// ── GET /api/reviews/:reviewId ───────────────────────────────────────────────

test("GET /api/reviews/:reviewId returns 200 with findings for a valid id", async () => {
  // Create a review first
  const postRes = await fetch(`${base}/api/reviews`, { method: "POST" });
  const { reviewId } = await postRes.json();

  const res = await fetch(`${base}/api/reviews/${reviewId}`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.reviewId, reviewId);
  assert.ok(Array.isArray(body.findings), "findings must be an array");
  assert.ok(body.status, "must have status");
});

test("GET /api/reviews/:reviewId returns 404 for unknown id", async () => {
  const res = await fetch(`${base}/api/reviews/does-not-exist-xyz`);
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.ok(body.error, "must have error field");
});

// ── GET /health ──────────────────────────────────────────────────────────────

test("GET /health still returns ok", async () => {
  const res = await fetch(`${base}/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.service, "rayshield-api");
  assert.equal(body.status, "ok");
});
