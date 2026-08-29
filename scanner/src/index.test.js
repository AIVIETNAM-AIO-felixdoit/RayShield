import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { writeFile, mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { scanProject } from "./index.js";

// ── Temp directory fixture ───────────────────────────────────────────────────

let tmpDir;

before(async () => {
  tmpDir = join(tmpdir(), `rayshield-scanner-test-${Date.now()}`);
  await mkdir(tmpDir, { recursive: true });

  // Vulnerable file 1: SQL injection
  await writeFile(
    join(tmpDir, "db.js"),
    'export function getUser(id) { return db.query(`SELECT * FROM users WHERE id = ${id}`); }\n'
  );

  // Vulnerable file 2: XSS
  await writeFile(
    join(tmpDir, "routes.js"),
    'app.get("/search", (req, res) => { res.send(`<p>Results for: ${req.query.q}</p>`); });\n'
  );

  // Vulnerable file 3: hardcoded value (name avoids bobignore patterns in the file path)
  await writeFile(
    join(tmpDir, "setup.js"),
    'const JWT_SECRET = "s3cr3t-demo-key-do-not-use";\n'
  );
});

after(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

// ── Return shape ─────────────────────────────────────────────────────────────

test("scanProject returns the required envelope shape", async () => {
  const result = await scanProject({ projectPath: tmpDir });
  assert.ok("projectPath" in result, "must have projectPath");
  assert.ok("scannedAt" in result, "must have scannedAt");
  assert.ok(Array.isArray(result.findings), "findings must be an array");
  assert.equal(result.projectPath, tmpDir);
  assert.match(result.scannedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("scanProject detects all three vulnerability types", async () => {
  const { findings } = await scanProject({ projectPath: tmpDir });
  const rules = findings.map((f) => f.rule);
  assert.ok(rules.includes("sql-injection"), "must detect sql-injection");
  assert.ok(rules.includes("xss-reflected"), "must detect xss-reflected");
  assert.ok(rules.includes("hardcoded-secret"), "must detect hardcoded-secret");
});

test("every finding has all required fields", async () => {
  const { findings } = await scanProject({ projectPath: tmpDir });
  assert.ok(findings.length > 0, "must have at least one finding");
  for (const f of findings) {
    assert.ok(f.id, "finding.id must be present");
    assert.ok(f.rule, "finding.rule must be present");
    assert.ok(f.severity, "finding.severity must be present");
    assert.ok(f.file, "finding.file must be present");
    assert.ok(typeof f.line === "number", "finding.line must be a number");
    assert.ok(f.description, "finding.description must be present");
  }
});

// ── Resilience ───────────────────────────────────────────────────────────────

test("scanProject returns empty findings for nonexistent path", async () => {
  const result = await scanProject({ projectPath: "/nonexistent/path/xyz-999" });
  assert.ok(Array.isArray(result.findings));
  assert.equal(result.findings.length, 0);
});

test("scanProject throws for falsy projectPath", async () => {
  await assert.rejects(
    () => scanProject({ projectPath: "" }),
    /projectPath is required/
  );
});

test("scanProject skips node_modules directory", async () => {
  // Create a node_modules dir with a vulnerable file inside — should NOT be found
  const nmDir = join(tmpDir, "node_modules");
  await mkdir(nmDir, { recursive: true });
  await writeFile(
    join(nmDir, "vuln.js"),
    'const q = `SELECT * FROM x WHERE id = ${evil}`;'
  );
  const { findings } = await scanProject({ projectPath: tmpDir });
  const fromNm = findings.filter((f) => f.file.includes("node_modules"));
  assert.equal(fromNm.length, 0, "node_modules must not be scanned");
});
