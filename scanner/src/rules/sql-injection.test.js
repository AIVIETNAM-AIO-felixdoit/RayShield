import { test } from "node:test";
import assert from "node:assert/strict";
import { detectSqlInjection } from "../rules/sql-injection.js";

// ── Positive cases ──────────────────────────────────────────────────────────

test("detects SQL injection via template literal", () => {
  const code = 'const q = `SELECT * FROM users WHERE id = ${id}`;';
  const findings = detectSqlInjection(code, "db.js");
  assert.equal(findings.length, 1);
  assert.equal(findings[0].rule, "sql-injection");
  assert.equal(findings[0].severity, "critical");
  assert.equal(findings[0].file, "db.js");
  assert.equal(findings[0].line, 1);
  assert.ok(findings[0].id, "finding must have an id");
  assert.ok(findings[0].description, "finding must have a description");
});

test("detects SQL injection via string concatenation", () => {
  const code = 'const q = "SELECT * FROM users WHERE name = " + name;';
  const findings = detectSqlInjection(code, "db.js");
  assert.equal(findings.length, 1);
  assert.equal(findings[0].rule, "sql-injection");
});

test("detects SQL injection using DELETE", () => {
  const code = 'db.run(`DELETE FROM sessions WHERE id = ${sessionId}`);';
  const findings = detectSqlInjection(code, "db.js");
  assert.equal(findings.length, 1);
});

// ── Negative cases ───────────────────────────────────────────────────────────

test("does NOT flag parameterised query with placeholder", () => {
  const code = 'db.query("SELECT * FROM users WHERE id = ?", [id]);';
  const findings = detectSqlInjection(code, "db.js");
  assert.equal(findings.length, 0);
});

test("does NOT flag plain SQL string without interpolation", () => {
  const code = 'const q = "SELECT * FROM users";';
  const findings = detectSqlInjection(code, "db.js");
  assert.equal(findings.length, 0);
});

test("returns empty array for empty content", () => {
  const findings = detectSqlInjection("", "db.js");
  assert.equal(findings.length, 0);
});
