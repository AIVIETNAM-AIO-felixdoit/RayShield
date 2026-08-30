# Project Coding Rules (Non-Obvious Only)

- All packages are `"type": "module"` — always use `import`/`export`. CJS `require()` will throw.
- Tests use `node --test` (Node.js built-in). Do NOT add vitest, jest, or mocha; no test framework is installed.
- Run tests per-workspace: `npm --workspace <name> run test` (e.g., `scanner`, `validator`, `backend`, `agents/remediation`).
- `validator/src/index.js` `summarizeValidation(checks)` returns `"NOT VERIFIED"` when `checks` is empty — the guard is `checks.length > 0 && checks.every(...)`. New checks must push a result object with `{ status: "passed" | "failed" }`.
- `agents/remediation/src/index.js` `proposeRemediation` must return `{ status, findingId, explanation, diff }` — callers destructure all four fields.
- `scanner/src/index.js` `scanProject` must return `{ projectPath, scannedAt, findings[] }` — the backend expects this exact shape.
- `demo-app/` is the intentional-vulnerability target. Never introduce real vulnerabilities into `RayShield/` source.
- Backend port defaults to `process.env.PORT || 3001`. Do not hard-code 3001 anywhere else.
- Never read or write `.env` files in code — use `import "dotenv/config"` once at the backend entry point.
- `.bobignore` blocks files matching `*config*`, `*secret*`, `*credentials*` from Bob's context — do not name utility files with those words.
