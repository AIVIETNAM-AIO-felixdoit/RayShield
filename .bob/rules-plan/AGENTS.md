# Project Architecture Rules (Non-Obvious Only)

- The workflow is strictly linear and approval-gated: scan → propose → **human approves** → validate. No step can be skipped or automated end-to-end.
- `validator/src/index.js` is the single source of truth for the final status. `"FIX VERIFIED"` requires ALL checks passed AND `checks.length > 0`. Design verification flows accordingly.
- Each workspace package is a stub awaiting real implementation. Plan incremental integration: wire SQL-injection scenario end-to-end first before adding XSS or hardcoded-secret scenarios.
- The backend (`backend/src/index.js`) is the **sole workflow coordinator** — scanner, remediation agent, and validator are called by the backend, never by each other or the frontend directly.
- API endpoints in `docs/architecture.md` define the contract; implement them in order (reviews → findings → remediation → approve → validate).
- `demo-app/` is scoped to controlled, isolated vulnerabilities only. Do not grow it into a real application.
- IBM Cloud credential exposure causes **immediate account suspension** — plan credential handling via env vars from day one; never hardcode even temporarily.
