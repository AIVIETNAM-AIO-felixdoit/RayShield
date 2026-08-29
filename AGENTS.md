# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Project

RayShield AI — hackathon MVP. Agentic security remediation: Detect → Understand → Fix → Test → Verify. All packages live under `RayShield/` (the workspace root). All commands must be run from `RayShield/`.

## Commands

```bash
# Install (once, from RayShield/)
npm install

# Dev servers (separate terminals)
npm run dev:backend    # Express API on port 3001
npm run dev:frontend   # Vite/React

# Test all workspaces
npm test

# Test a single workspace (uses Node.js built-in test runner — no vitest/jest)
npm --workspace backend run test
npm --workspace scanner run test
npm --workspace validator run test
npm --workspace agents/remediation run test

# Lint all
npm run lint
```

## Architecture

```
Frontend (React/Vite)
  → Backend API (Express, port 3001)  ← workflow coordinator
      → scanner/          scanProject({ projectPath }) → { findings[] }
      → agents/remediation/  proposeRemediation({ finding, source }) → { diff, explanation }
      → Human approval gate (explicit POST /api/findings/:id/approve required)
      → validator/        summarizeValidation(checks) → "FIX VERIFIED" | "NOT VERIFIED"
```

**`FIX VERIFIED` is emitted only when `checks.length > 0` AND every check has `status: "passed"`** — an empty checks array returns `"NOT VERIFIED"`.

## Key contracts

- `POST /api/reviews` → `{ reviewId, status: "queued", nextStep: "scan" }` (202)
- `GET /health` → `{ service: "rayshield-api", status: "ok" }` (200)
- Unimplemented API endpoints are defined in `docs/architecture.md`.
- `demo-app/` is the **scan target** — intentional vulnerabilities go there, not in RayShield source.
- First scenario: SQL injection. XSS and hardcoded-secret scenarios only after the first loop works.

## Code style

- All packages use `"type": "module"` — use `import`/`export`, never `require`.
- No TypeScript; plain `.js` / `.jsx`.
- No test framework installed — tests use `node --test` (Node.js built-in).
- Backend: `import "dotenv/config"` at top; read config via `process.env.*`.
- Boundary modules (scanner, remediation agent, validator) export a single named function; keep them stateless stubs until the real implementation is wired.

## Security (critical)

- **Never commit `.env`** — copy `.env.example` to `.env` locally.
- **Never share credentials in AI prompts** — Bob logs session history; `.bobignore` blocks known patterns but does not protect against manual pasting.
- `.gitignore` blocks `config.json`, `secrets.*`, `credentials.*` — do not use those filenames for unrelated files.
- IBM Cloud credential exposure triggers immediate account suspension.
