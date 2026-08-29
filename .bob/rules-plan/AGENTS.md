# Project Architecture Rules (Non-Obvious Only)

- Human approval gate is a hard architectural requirement — `POST /api/findings/:findingId/approve` must be a separate endpoint, not a flag on remediation or validation.
- `FIX VERIFIED` status is only reachable through `summarizeValidation` in `validator/`; the backend must not short-circuit or compute this string independently.
- Workflow is strictly sequential: scan → propose → approve → validate. Steps cannot be skipped or merged.
- The scanner boundary is intentionally tool-agnostic (Semgrep, ESLint, custom AST). The adapter contract is `scanProject({ projectPath }) → { projectPath, scannedAt, findings[] }` — design integrations around this interface.
- `demo-app/` vulnerabilities must be reproducible and isolated; the test in `tests/` must prove detection before remediation and absence after.
- First milestone is one SQL-injection scenario end-to-end. Do not design for XSS or hardcoded-secret until that loop is verified.
- All packages are stateless ES modules with no shared in-process state — the backend is the only workflow coordinator; do not add cross-package imports between scanner/validator/agents.
