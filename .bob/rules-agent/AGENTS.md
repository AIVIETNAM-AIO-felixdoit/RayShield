# Project Coding Rules (Non-Obvious Only)

- All packages are **ESM only** (`"type": "module"`). Never use `require()` or `module.exports`.
- Tests use **`node --test`** (Node built-in) — no test framework package needed. Test files must be discoverable by `node --test` from the workspace directory.
- The three core boundary modules (`scanner`, `remediation`, `validator`) each expose exactly **one named export** from `src/index.js`. Keep that contract; the backend will call these directly.
- `validator/src/index.js` `summarizeValidation(checks)` returns `"NOT VERIFIED"` when `checks` is empty — never treat an empty-pass as verified.
- Unused Express request parameters must be prefixed `_` (e.g., `_request`) — this is the established pattern in `backend/src/index.js`.
- `demo-app/` must contain **intentional vulnerabilities only**; never reference RayShield's own source as the scan target.
- Never auto-apply a remediation diff. `proposeRemediation` produces a proposal; a separate human-approval step is required before patching.
- `.bobignore` is a security file — do not remove or modify its patterns.
