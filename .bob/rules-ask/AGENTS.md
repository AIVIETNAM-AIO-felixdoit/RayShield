# Project Documentation Rules (Non-Obvious Only)

- `agents/remediation/` is described as "Bob-powered" — it is the boundary where the IBM Bob AI assistant is integrated, not a generic AI library.
- `demo-app/` is intentionally vulnerable; findings reported against it are expected and correct.
- `tests/` currently contains only a `README.md` — no actual test files exist yet. Cross-component integration tests go here when created.
- `docs/architecture.md` lists the full API contract (5 endpoints) that is **not yet implemented** — only `GET /health` and a stub `POST /api/reviews` currently exist.
- The `"FIX VERIFIED"` / `"NOT VERIFIED"` status strings are **exact literals** used as the final output of `validator/src/index.js` — treat them as an API contract.
- Frontend has a placeholder `test` script that just echoes a message — no frontend tests exist.
