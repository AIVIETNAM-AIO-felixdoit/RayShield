# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Project

RayShield AI — agentic security remediation workflow (hackathon MVP). Workflow: Detect → Understand → Fix → Test → Verify.

## Stack

- **npm workspaces** monorepo: `frontend`, `backend`, `scanner`, `agents/remediation`, `validator`
- All packages use `"type": "module"` (ESM only — no `require()`)
- Node.js ≥ 20 required
- Backend: Express on port `3001` (configurable via `PORT` env var)
- Frontend: React + Vite

## Commands

```bash
npm install                        # install all workspaces at once from root
npm run dev:backend                # starts backend with --watch (hot reload)
npm run dev:frontend               # starts Vite dev server
npm run test                       # runs tests in all workspaces
npm run lint                       # lints all workspaces

# Single workspace test (run from repo root):
npm --workspace backend run test
npm --workspace scanner run test
npm --workspace validator run test
npm --workspace agents/remediation run test

# Per-workspace (from workspace directory):
node --test                        # backend / scanner / validator / remediation
```

Tests use **Node.js built-in test runner** (`node --test`) — not Jest, Vitest, or Mocha.

## Architecture: key boundaries

Each package exposes a single stub function that **must** be the integration point:

| File | Export | Contract |
|---|---|---|
| `scanner/src/index.js` | `scanProject({ projectPath })` | Returns `{ projectPath, scannedAt, findings[] }` |
| `agents/remediation/src/index.js` | `proposeRemediation({ finding, source })` | Returns `{ status, findingId, explanation, diff }` |
| `validator/src/index.js` | `summarizeValidation(checks)` | Returns `"FIX VERIFIED"` only when ALL checks pass and `checks.length > 0` |

- The validator returns `"NOT VERIFIED"` for an **empty** `checks` array — a zero-length pass is never verified.
- `proposeRemediation` requires **human approval** before any patch is applied; never auto-apply.
- Scanner findings must come from real analysis (Semgrep / ESLint security rules); stub returns `[]`.

## API endpoints (to implement)

Documented in [`docs/architecture.md`](docs/architecture.md). Currently only `GET /health` and `POST /api/reviews` (stub 202) exist.

## demo-app

Contains **intentional vulnerabilities** for scanning. Never scan RayShield's own source. Start with SQL injection; add XSS / hardcoded-secret only after the first loop is working.

## Security (critical)

- **Never commit `.env` files or credentials.** Accidental commit = immediate IBM Cloud account suspension.
- **Never paste credentials in AI prompts** — Bob logs session history.
- Always use `process.env.VARIABLE_NAME` via `dotenv`. Copy `.env.example` → `.env` locally.
- `.bobignore` patterns must not be removed or modified.

## Code style

- ESM imports only (`import` / `export`); no CommonJS.
- Named exports preferred (see all `src/index.js` stubs).
- Unused parameters prefixed with `_` (e.g. `_request` in Express handlers).
- Throw plain `Error` with descriptive messages for missing required args.
