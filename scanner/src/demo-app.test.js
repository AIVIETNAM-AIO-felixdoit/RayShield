/**
 * End-to-end demo-app scan test + fixed-fixture regression tests.
 *
 * Proves:
 *   1. Real demo-app scan returns exactly the expected finding counts.
 *   2. Fixed variants return 0 findings for each rule.
 *   3. All findings satisfy the contract shape.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "fs/promises";
import { join } from "path";
import { scanProject } from "./index.js";
import { detectSqlInjection } from "./rules/sql-injection.js";
import { detectXss } from "./rules/xss.js";
import { detectHardcodedCredential } from "./rules/sast-literals.js";

// Path to demo-app relative to the repo root (where `node --test` is invoked
// from, i.e. the scanner/ workspace directory → process.cwd() = scanner/).
// But when called from npm --workspace scanner run test, cwd is the repo root.
// Use import.meta.url to find the fixtures directory reliably.
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const SCANNER_SRC = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCANNER_SRC, "../..");
const DEMO_APP = join(REPO_ROOT, "demo-app");
const FIXTURES = join(SCANNER_SRC, "fixtures");

// ── Demo-app end-to-end scan ─────────────────────────────────────────────────

test("demo-app scan: sql-injection detected (2 findings)", async () => {
  const result = await scanProject({ projectPath: DEMO_APP });
  const sqlFindings = result.findings.filter((f) => f.rule === "sql-injection");
  assert.equal(sqlFindings.length, 2, `Expected 2 sql-injection findings, got ${sqlFindings.length}`);
  for (const f of sqlFindings) assert.equal(f.severity, "critical");
});

test("demo-app scan: xss-reflected detected (1 finding)", async () => {
  const result = await scanProject({ projectPath: DEMO_APP });
  const xssFindings = result.findings.filter((f) => f.rule === "xss-reflected");
  assert.equal(xssFindings.length, 1, `Expected 1 xss-reflected finding, got ${xssFindings.length}`);
  for (const f of xssFindings) assert.equal(f.severity, "high");
});

test("demo-app scan: hardcoded-secret detected (3 findings)", async () => {
  const result = await scanProject({ projectPath: DEMO_APP });
  const hcFindings = result.findings.filter((f) => f.rule === "hardcoded-secret");
  assert.equal(hcFindings.length, 3, `Expected 3 hardcoded-secret findings, got ${hcFindings.length}`);
  for (const f of hcFindings) assert.equal(f.severity, "high");
});

test("demo-app scan: total findings is 6", async () => {
  const result = await scanProject({ projectPath: DEMO_APP });
  assert.equal(result.findings.length, 6);
});

test("demo-app scan: all findings satisfy the contract shape", async () => {
  const result = await scanProject({ projectPath: DEMO_APP });
  const required = ["id", "rule", "severity", "file", "line", "description"];
  for (const f of result.findings) {
    for (const field of required) {
      assert.ok(f[field] !== undefined && f[field] !== null && f[field] !== "",
        `finding missing or empty field '${field}'`);
    }
    assert.ok(typeof f.line === "number", "line must be a number");
  }
});

test("demo-app scan: safe process.env line in config.js is NOT flagged", async () => {
  const result = await scanProject({ projectPath: DEMO_APP });
  // Line 23 of config.js: process.env.JWT_VALUE — must not appear in findings
  const configFindings = result.findings.filter(
    (f) => f.file.includes("config") && f.rule === "hardcoded-secret"
  );
  // Only 3 lines should fire (lines 14, 17, 20); line 23 (process.env) must not
  assert.equal(configFindings.length, 3);
  const lines = configFindings.map((f) => f.line);
  assert.ok(!lines.includes(23), "process.env line must NOT be flagged");
});

// ── Fixed-fixture regression: rules go silent after fix ──────────────────────

test("fixed db-queries.js: sql-injection rule produces 0 findings", async () => {
  const content = await readFile(join(FIXTURES, "fixed-db-queries.js"), "utf8");
  const findings = detectSqlInjection(content, "fixed-db-queries.js");
  assert.equal(findings.length, 0, "Fixed SQL file must not trigger sql-injection");
});

test("fixed search-routes.js: xss-reflected rule produces 0 findings", async () => {
  const content = await readFile(join(FIXTURES, "fixed-search-routes.js"), "utf8");
  const findings = detectXss(content, "fixed-search-routes.js");
  assert.equal(findings.length, 0, "Fixed XSS file must not trigger xss-reflected");
});

test("fixed config.js: hardcoded-secret rule produces 0 findings", async () => {
  const content = await readFile(join(FIXTURES, "fixed-config.js"), "utf8");
  const findings = detectHardcodedCredential(content, "fixed-config.js");
  assert.equal(findings.length, 0, "Fixed config file must not trigger hardcoded-secret");
});
