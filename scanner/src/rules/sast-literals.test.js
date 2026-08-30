import { test } from "node:test";
import assert from "node:assert/strict";
import { detectHardcodedCredential } from "../rules/sast-literals.js";

// ── Positive cases ──────────────────────────────────────────────────────────

test("detects hardcoded JWT value assignment", () => {
  const code = 'const JWT_SECRET = "s3cr3t-demo-key-do-not-use";';
  const findings = detectHardcodedCredential(code, "config.js");
  assert.equal(findings.length, 1);
  assert.equal(findings[0].rule, "hardcoded-secret");
  assert.equal(findings[0].severity, "high");
  assert.equal(findings[0].file, "config.js");
  assert.equal(findings[0].line, 1);
  assert.ok(findings[0].id, "finding must have an id");
  assert.ok(findings[0].description, "finding must have a description");
});

test("detects hardcoded API value with key in name", () => {
  const code = 'const apiKey = "abc-123-xyz-real-value";';
  const findings = detectHardcodedCredential(code, "config.js");
  assert.equal(findings.length, 1);
  assert.equal(findings[0].rule, "hardcoded-secret");
});

test("detects hardcoded access value with token in name", () => {
  const code = 'const accessToken = "Bearer eyJhbGciOiJIUzI1NiJ9";';
  const findings = detectHardcodedCredential(code, "config.js");
  assert.equal(findings.length, 1);
});

// ── Negative cases ───────────────────────────────────────────────────────────

test("does NOT flag process.env assignment", () => {
  const code = 'const jwtValue = process.env.JWT_SECRET;';
  const findings = detectHardcodedCredential(code, "config.js");
  assert.equal(findings.length, 0);
});

test("does NOT flag short string (under 4 chars)", () => {
  const code = 'const myKey = "abc";';
  const findings = detectHardcodedCredential(code, "config.js");
  assert.equal(findings.length, 0);
});

test("does NOT flag empty string assignment", () => {
  const code = 'const myToken = "";';
  const findings = detectHardcodedCredential(code, "config.js");
  assert.equal(findings.length, 0);
});

test("returns empty array for empty content", () => {
  const findings = detectHardcodedCredential("", "config.js");
  assert.equal(findings.length, 0);
});
