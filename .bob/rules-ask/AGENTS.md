# Project Documentation Rules (Non-Obvious Only)

- The workspace root is `RayShield/`, not the repo root (`hackathon/`). All npm commands must be run from `RayShield/`.
- `demo-app/` is intentionally empty — it is the **scan target**, not a working app yet.
- `tests/` contains only a README; no tests exist yet. The first required test is a before/after SQL-injection detection proof.
- `agents/remediation/` is described as "Bob-powered" but is currently a stub with no AI integration wired.
- Architecture doc (`docs/architecture.md`) lists the API contract that has not yet been implemented — only `GET /health` and `POST /api/reviews` exist.
- `bob_sessions/` folder is **required for project submission** per `.gitignore` comments — do not delete it.
- `.bobignore` prevents Bob from reading files matching credential patterns, including `*config*` and `*secret*` — mention this if asked why Bob can't see a file.
