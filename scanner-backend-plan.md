# Scanner + Backend Plan: Repository → Security Analysis → Findings

## Overview

Implement the first complete slice of the RayShield AI workflow:
**scan a repository → detect vulnerabilities → return structured findings to the frontend.**

Scope is limited to three vulnerability types (SQL Injection, XSS, Hardcoded Secrets) against a controlled
demo application. The existing `scanProject` return shape is preserved exactly. The backend wires the
scanner into the review lifecycle and adds an endpoint to retrieve findings.

Everything stays within the `scanner/` and `backend/` workspaces. No cross-boundary imports between
scanner, validator, or agents packages.

---

## Sub-Task 1 — Build the controlled demo-app targets

**Intent:** Create three small JavaScript files in `demo-app/` containing one intentional,
isolated vulnerability each. These are the only files the scanner will be tested against.
They must be realistic enough to trigger regex rules but must not contain real secrets or
production data.

**Expected Outcomes:**
- `demo-app/db.js` — SQL injection via string concatenation or template literal
- `demo-app/render.js` — XSS via `innerHTML` assignment from a variable
- `demo-app/config.js` — Hardcoded secret (API key / password as a string literal, not `process.env`)

**Todo List:**
1. Create `demo-app/db.js` with a function that builds a SQL query by concatenating a user-supplied parameter.
2. Create `demo-app/render.js` with a function that assigns user data to `innerHTML`.
3. Create `demo-app/config.js` with a variable named `apiKey` (or similar) set to a non-empty string literal.

**Relevant Context:**
- `demo-app/README.md` — guidance on scope; no real secrets, no production data.
- Files should be realistic Node.js/JS patterns so regex rules fire naturally.

**Status:** [ ] pending

---

## Sub-Task 2 — Implement the three scanner rules

**Intent:** Create one pure rule function per vulnerability type. Each rule accepts
`(fileContent: string, filePath: string)` and returns a `Finding[]`. Rules are stateless,
synchronous, and regex-based — no file I/O, no external tools.

**Expected Outcomes:**
- `scanner/src/rules/sql-injection.js` — exports `detectSqlInjection(content, filePath)`
- `scanner/src/rules/xss.js` — exports `detectXss(content, filePath)`
- `scanner/src/rules/hardcoded-secret.js` — exports `detectHardcodedSecret(content, filePath)`
- Each finding object has exactly these fields:
  ```
  {
    id,           // crypto.randomUUID()
    ruleId,       // "sql-injection" | "xss" | "hardcoded-secret"
    severity,     // "high" | "high" | "medium"  (respectively)
    title,        // short human label
    description,  // one sentence explaining the risk
    file,         // filePath argument (relative path from caller)
    line,         // 1-based line number of the matching line
    snippet       // the matching source line, trimmed
  }
  ```

**Detection approaches:**

| Rule | Regex/Pattern target |
|---|---|
| SQL Injection | Line contains a query-like call (`query(`, `.execute(`, `.run(`, `SELECT`/`INSERT`/`UPDATE`/`DELETE` as a string) AND the same line or an adjacent assignment uses string concatenation (`+`) or template literals with a variable reference |
| XSS | Line assigns to `innerHTML`, `outerHTML`, `document.write(`, or `insertAdjacentHTML(` with a non-literal value (i.e., not a bare quoted string) |
| Hardcoded Secret | Line has an identifier matching `/api.?key|secret|password|token|credential/i` assigned a non-empty string literal that is not `process.env.*` |

**Todo List:**
1. Create `scanner/src/rules/` directory.
2. Implement `sql-injection.js`: iterate lines, apply regex, return matching findings with correct fields.
3. Implement `xss.js`: iterate lines, apply regex, return matching findings.
4. Implement `hardcoded-secret.js`: iterate lines, apply regex, return matching findings.
5. Use `crypto.randomUUID()` for `id` (global in Node ≥ 20, no import needed).

**Relevant Context:**
- `scanner/src/index.js` — existing stub; rules will be called from here in Sub-Task 3.
- `scanner/package.json` — ESM, zero dependencies; do not add any.
- AGENTS.md — `"type": "module"`, named exports, throw `Error` for bad input.

**Status:** [ ] pending

---

## Sub-Task 3 — Wire rules into scanProject

**Intent:** Update `scanner/src/index.js` to read every `.js` file under `projectPath` recursively,
run each rule against each file's content, and aggregate findings. The outer return shape
`{ projectPath, scannedAt, findings[] }` must remain unchanged.

**Expected Outcomes:**
- `scanProject({ projectPath })` resolves with all findings from all three rules across all `.js` files under `projectPath`.
- Function remains `async`, remains stateless (no module-level variables).
- Only Node.js built-ins used (`fs/promises`, `path`); no new dependencies.

**Todo List:**
1. Import `fs/promises` and `path` (built-ins).
2. Import the three rule functions from `./rules/`.
3. Add a helper to recursively list `.js` files under a directory.
4. For each file: read content, run all three rules, collect findings.
5. Return `{ projectPath, scannedAt: new Date().toISOString(), findings }`.

**Relevant Context:**
- `scanner/src/index.js` — existing stub to modify.
- AGENTS.md — preserve exact return contract; scanner must stay stateless.
- No cross-boundary imports; scanner imports only its own rules and Node built-ins.

**Status:** [ ] pending

---

## Sub-Task 4 — Unit-test the scanner rules and scanProject

**Intent:** Write `node --test` unit tests that prove each rule fires on the demo-app
fixtures and does not fire on clean code. Also test `scanProject` end-to-end against
the `demo-app/` directory.

**Expected Outcomes:**
- `scanner/src/rules/sql-injection.test.js` — tests for true-positive and true-negative cases.
- `scanner/src/rules/xss.test.js` — same.
- `scanner/src/rules/hardcoded-secret.test.js` — same.
- `scanner/src/index.test.js` — calls `scanProject` with `demo-app/` path; asserts `findings.length >= 3` and each finding has all required fields.
- `npm --workspace scanner run test` passes with no failures.

**Todo List:**
1. Create `scanner/src/rules/sql-injection.test.js` using `node:test` and `node:assert`.
2. Create `scanner/src/rules/xss.test.js`.
3. Create `scanner/src/rules/hardcoded-secret.test.js`.
4. Create `scanner/src/index.test.js` for the integration case.

**Relevant Context:**
- AGENTS.md — `node --test`, use `node:test` + `node:assert` imports.
- Test files auto-discovered by `node --test` when run from `scanner/` directory.
- Demo-app files created in Sub-Task 1 are the positive-case fixtures.

**Status:** [ ] pending

---

## Sub-Task 5 — Backend: in-memory review store and wiring scanProject

**Intent:** Update `backend/src/index.js` to:
1. Import `scanProject` from the scanner workspace package.
2. On `POST /api/reviews`, actually run the scan (async), store the result in a
   module-level `Map`, and return the existing 202 shape.
3. Add `GET /api/reviews/:reviewId` that returns the stored review (findings included)
   or 404 if not found.

Port, middleware, and existing endpoint behaviour must not change.

**Expected Outcomes:**
- `POST /api/reviews` triggers a real scan of `demo-app/` and stores findings.
- `GET /api/reviews/:reviewId` returns `{ reviewId, status, findings[] }`.
- `GET /health` still returns `{ service: "rayshield-api", status: "ok" }`.
- Port remains `process.env.PORT || 3001`.
- No new npm dependencies added to backend.

**Design note on the in-memory store:**
A module-level `Map` (e.g. `const reviews = new Map()`) is acceptable for this MVP.
It does not violate the stateless-scanner constraint — the *scanner* stays stateless;
the *backend* is the coordinator and is allowed to hold workflow state.

**Todo List:**
1. Add `import { scanProject } from "@rayshield/scanner"` at top of `backend/src/index.js`.
2. Declare `const reviews = new Map()` at module level (coordinator state, not scanner state).
3. Update `POST /api/reviews` handler: make async, call `scanProject`, set `status: "scanned"` with findings, store in map, respond 202.
4. Add `GET /api/reviews/:reviewId` handler: look up map, return 200 with full record or 404.

**Relevant Context:**
- `backend/src/index.js` — existing file to modify.
- `backend/package.json` — `@rayshield/scanner` is a workspace sibling; no install needed.
- AGENTS.md — backend is the sole workflow coordinator; scanner is called from here only.
- AGENTS.md — unused params use `_` prefix; keep this convention.

**Status:** [ ] pending

---

## Sub-Task 6 — Backend: route tests

**Intent:** Write `node --test` tests for the two modified/new backend routes using a
real Express server started inside the test file plus the global `fetch` (Node ≥ 18 built-in).
Zero new dependencies required.

**Expected Outcomes:**
- `backend/src/index.test.js` tests:
  - `POST /api/reviews` → 202, body has `reviewId` and `status`.
  - `GET /api/reviews/:reviewId` with valid id → 200, body has `findings` array.
  - `GET /api/reviews/:unknownId` → 404.
- `npm --workspace backend run test` passes.

**Design decision (confirmed):** Start the real Express server in the test file, use
global `fetch` (Node ≥ 18 built-in) to call live routes, close server in `after` hook.
No supertest, no mocks, no new dependencies.

**Todo List:**
1. Create `backend/src/index.test.js` using `node:test` and `node:assert`.
2. In `before` hook: import and start the Express app on a test port.
3. Use `fetch` to call the three cases; assert status codes and body shapes.
4. In `after` hook: close the server.

**Relevant Context:**
- `backend/src/index.js` — routes to test.
- AGENTS.md — `node --test`, `node:test` + `node:assert`.

**Status:** [ ] pending

---

## Constraints (apply to all sub-tasks)

- ESM only — no `require()`, no `module.exports`.
- `node --test` only — no Jest, Vitest, Mocha.
- Scanner stays stateless — no module-level state inside `scanner/`.
- Outer return shape of `scanProject` never changes.
- Backend port = `process.env.PORT || 3001` — untouched.
- No imports across scanner / validator / agents package boundaries.
- No new production npm dependencies in scanner or backend (devDependencies acceptable
  only if unavoidable for testing).
- Findings detected must come from real pattern analysis, not hardcoded return values.
