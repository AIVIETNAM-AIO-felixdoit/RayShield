# Phase 1 Plan: Scanner + Backend — Repository → Security Findings

## Overview

Implement the first complete RayShield AI milestone:
**scan `demo-app/` → detect SQL Injection, XSS, Hardcoded Secrets → return structured findings via the backend API.**

Scope: `scanner/` and `backend/` only.  
Do NOT touch: `demo-app/`, `tests/`, `frontend/`, `validator/`, `agents/`.  
Do NOT implement remediation, approval, or validation.

---

## Constraints (apply to every sub-task)

- ESM only — no `require()`, no `module.exports`
- `node --test` + `node:test` + `node:assert` — no Jest, Vitest, Mocha
- Scanner stateless — no module-level mutable state inside `scanner/`
- `scanProject` return shape **unchanged**: `{ projectPath, scannedAt, findings[] }`
- Backend port = `process.env.PORT || 3001` — never hardcode
- No cross-boundary imports between `scanner/`, `validator/`, `agents/`
- No new production npm dependencies
- Findings must come from real pattern analysis, never hardcoded arrays

---

## Finding shape (all three rules return this per match)

```json
{
  "id":          "<crypto.randomUUID()>",
  "rule":        "sql-injection | xss-reflected | hardcoded-secret",
  "severity":    "critical | high",
  "file":        "relative/path/to/file.js",
  "line":        12,
  "description": "One sentence explaining the risk."
}
```

`crypto.randomUUID()` is a global in Node ≥ 20 — no import needed.

---

## Sub-Task 1 — Three isolated scanner rule functions

**Intent:** Create one pure function per vulnerability type. Each rule receives
`(content: string, filePath: string)` and returns `Finding[]`.
Rules are synchronous, stateless, regex-based. No file I/O. No imports beyond the
finding shape (which is a plain object).

**Expected Outcomes:**
- `scanner/src/rules/sql-injection.js` exports `detectSqlInjection(content, filePath)`
  - rule: `"sql-injection"`, severity: `"critical"`
  - Fires on: SQL keyword (`SELECT|INSERT|UPDATE|DELETE|FROM|WHERE`) on same line as
    a template literal expression `${...}` or string concat with a variable operand
  - Does NOT fire on a plain string literal `"SELECT * FROM users WHERE id = ?"` (parameterised)
- `scanner/src/rules/xss.js` exports `detectXss(content, filePath)`
  - rule: `"xss-reflected"`, severity: `"high"`
  - Fires on: `res.send(` / `res.write(` / `res.end(` containing `req.query.`, `req.params.`, or `req.body.` inside a template `${...}` or concat
  - Does NOT fire on `res.send("static string")`
- `scanner/src/rules/hardcoded-secret.js` exports `detectHardcodedSecret(content, filePath)`
  - rule: `"hardcoded-secret"`, severity: `"high"`
  - Fires on: identifier matching `/secret|key|token|password|passwd|credential/i` assigned a non-empty string literal (min 4 chars), where the line does NOT contain `process.env`
  - Does NOT fire on `const jwtSecret = process.env.JWT_SECRET`

**Todo List:**
1. Create `scanner/src/rules/` directory.
2. Implement `sql-injection.js` — iterate lines, regex match, push finding with all required fields.
3. Implement `xss.js` — same pattern.
4. Implement `hardcoded-secret.js` — same pattern.

**Relevant Context:**
- `scanner/src/index.js` — rules are called from here in Sub-Task 2.
- `scanner/package.json` — zero dependencies; do not add any.
- `crypto.randomUUID()` is global in Node ≥ 20.

**Status:** [ ] pending

---

## Sub-Task 2 — Wire rules into scanProject

**Intent:** Update `scanner/src/index.js` to walk `.js` files under `projectPath`
recursively, run all three rules on each file, and aggregate the findings array.
The outer return shape must not change.

**Expected Outcomes:**
- `scanProject({ projectPath })` resolves with all findings from all three rules.
- Function remains `async`, remains stateless.
- File walker skips `node_modules`, `.git`, `bob_sessions`.
- A missing or nonexistent `projectPath` returns `{ projectPath, scannedAt, findings: [] }`
  with no thrown error (the existing throw-on-falsy guard is replaced with a graceful
  empty-findings return for paths that do not exist on disk).
- Only Node.js built-ins used: `fs/promises`, `path`.

**Design note on the existing throw:**
The current stub throws when `projectPath` is falsy. This should be preserved for the
falsy case (empty string, null, undefined) but extended to handle paths that are valid
strings yet do not exist on disk — those should return empty findings, not throw.

**Todo List:**
1. Import `fs/promises` and `path` from Node built-ins.
2. Import the three rule functions from `./rules/`.
3. Add an async helper `walkJs(dir)` that yields `.js` file paths, skipping excluded dirs.
4. Wrap the walk in a try/catch — non-existent path returns `findings: []`.
5. For each file: `readFile` → run all three rules → push results.
6. Return `{ projectPath, scannedAt: new Date().toISOString(), findings }`.

**Relevant Context:**
- `scanner/src/index.js` — file to modify.
- AGENTS.md — preserve exact return contract; scanner must stay stateless.

**Status:** [ ] pending

---

## Sub-Task 3 — Scanner unit tests

**Intent:** Write `node --test` tests proving each rule fires on vulnerable code and
does NOT fire on safe equivalents. Also test `scanProject` with a temporary directory
and with a nonexistent path.

**Critical note:** `demo-app/` has no `.js` files yet (Rabeesa has not committed them).
All test fixtures must be **inline strings** or **temp files written by the test itself**.
Tests must never depend on `demo-app/` content.

**Expected Outcomes:**
- `scanner/src/rules/sql-injection.test.js` — true-positive + true-negative cases; all required fields present on each finding.
- `scanner/src/rules/xss.test.js` — same.
- `scanner/src/rules/hardcoded-secret.test.js` — same.
- `scanner/src/index.test.js` — writes two temp `.js` files into `os.tmpdir()`, calls `scanProject`, asserts shape and ≥1 finding per rule; also calls with nonexistent path and asserts no throw + empty findings array.
- `npm --workspace scanner run test` passes with zero failures.

**Todo List:**
1. Create `scanner/src/rules/sql-injection.test.js` using `node:test` and `node:assert`.
2. Create `scanner/src/rules/xss.test.js`.
3. Create `scanner/src/rules/hardcoded-secret.test.js`.
4. Create `scanner/src/index.test.js` using `os.tmpdir()` + `fs/promises.writeFile` fixtures.
5. Run `npm --workspace scanner run test` and fix any failures before proceeding.

**Relevant Context:**
- AGENTS.md — `node --test`, auto-discovers test files in workspace directory.
- Sub-Task 1 rule functions — the import targets for rule-level tests.
- Sub-Task 2 `scanProject` — the import target for the integration test.

**Status:** [ ] pending

---

## Sub-Task 4 — Backend wiring: in-memory store + new routes

**Intent:** Update `backend/src/index.js` to:
1. Import `scanProject` from `@rayshield/scanner` (workspace sibling — no install needed).
2. Hold review state in a module-level `Map` (`const reviews = new Map()`).
   This is coordinator state, not scanner state — the constraint is on `scanner/`, not `backend/`.
3. Make `POST /api/reviews` async: run `scanProject({ projectPath: "demo-app" })`, store
   the result keyed by `reviewId`, respond 202 with `{ reviewId, status: "scanned", findings }`.
4. Add `GET /api/reviews/:reviewId`: look up the map, return 200 + the stored record,
   or 404 `{ error: "not found" }`.
5. Export the `app` object (not the server instance) so the test file can create its own server.

**Expected Outcomes:**
- `POST /api/reviews` → 202, body: `{ reviewId, status: "scanned", findings[] }`.
- `GET /api/reviews/:reviewId` with valid id → 200, body: `{ reviewId, status, findings[] }`.
- `GET /api/reviews/unknown-id` → 404, body: `{ error: "not found" }`.
- `GET /health` still returns `{ service: "rayshield-api", status: "ok" }`.
- Port stays `process.env.PORT || 3001` — the `app.listen` call is unchanged for production.

**Design note on testability:**
To let the test start the server on an ephemeral port, split the file into:
- Named `export { app }` so tests can do `app.listen(0, ...)` on a random port.
- `app.listen(port, ...)` remains in the same file but guarded by
  `if (process.env.NODE_ENV !== "test")` — OR the test simply imports `app` and
  calls `.listen(0)` itself without touching the production listener.
The simplest approach: export `app` and let the existing `app.listen` run only when the
file is the main entry point (`import.meta.url` check).

**Todo List:**
1. Add `import { scanProject } from "@rayshield/scanner"` at the top.
2. Declare `const reviews = new Map()` at module scope.
3. Make `POST /api/reviews` handler `async`, call `scanProject`, store + respond.
4. Add `GET /api/reviews/:reviewId` handler.
5. Export `app` for tests; guard `app.listen` behind `import.meta.url` main-module check.

**Relevant Context:**
- `backend/src/index.js` — file to modify.
- `backend/package.json` — `@rayshield/scanner` is a workspace sibling.
- AGENTS.md — unused params use `_` prefix; keep this convention.

**Status:** [ ] pending

---

## Sub-Task 5 — Backend route tests

**Intent:** Write `node --test` tests for the three route scenarios using a real Express
server started inside the test file on an ephemeral port (`listen(0)`), with the global
`fetch` (Node ≥ 18 built-in). Close the server in `after()`.

**Expected Outcomes:**
- `backend/src/index.test.js` covers:
  - `POST /api/reviews` → 202 + `reviewId` present + `status === "scanned"`.
  - `GET /api/reviews/:reviewId` with the id from above → 200 + `findings` is an array.
  - `GET /api/reviews/nonexistent-id` → 404.
- `npm --workspace backend run test` passes with zero failures.

**Todo List:**
1. Create `backend/src/index.test.js` using `node:test`, `node:assert`.
2. In `before()`: import `app`, call `app.listen(0)`, derive the ephemeral port.
3. Call all three route scenarios with `fetch`.
4. In `after()`: close the server.
5. Run `npm --workspace backend run test` and fix any failures.

**Relevant Context:**
- `backend/src/index.js` — must export `app` (Sub-Task 4).
- AGENTS.md — `node --test`, `node:test` + `node:assert`, global `fetch` available.
- `demo-app/` has no code yet; `POST /api/reviews` will return `findings: []` until
  Rabeesa commits the vulnerable files. Tests must assert shape, not a specific findings count.

**Status:** [ ] pending

---

## Notes for the frontend team (after implementation)

Two endpoints will be available:

```
POST /api/reviews
  Body: (none required for now — scans demo-app/ automatically)
  Response 202: { reviewId, status: "scanned", findings[] }

GET /api/reviews/:reviewId
  Response 200: { reviewId, status, findings[] }
  Response 404: { error: "not found" }
```

Finding object shape:
```json
{
  "id":          "uuid",
  "rule":        "sql-injection | xss-reflected | hardcoded-secret",
  "severity":    "critical | high",
  "file":        "relative/path.js",
  "line":        12,
  "description": "..."
}
```

Findings will be empty (`[]`) until Rabeesa commits the `demo-app/` vulnerability files.
Once she does, no frontend or backend changes are required — the scanner will pick them
up automatically on the next `POST /api/reviews`.
