# Remediation Patterns

Safe fix patterns for each vulnerability type Bob may encounter in the
RayShield demo-app. Consult this file during Step 6 (Propose Fix).

**Core constraint for every fix:**
Make the smallest change that eliminates the vulnerability.
Do not rename variables, refactor surrounding code, add new abstractions,
change function signatures, or touch any file other than `finding.file`.

---

## sql-injection

**Rule id:** `sql-injection`

**Vulnerable pattern (to remove):**
Any user-supplied value interpolated or concatenated into a SQL string.

```js
// String template interpolation — VULNERABLE
const query = `SELECT * FROM users WHERE id = ${userId}`;

// String concatenation — VULNERABLE
const q = "SELECT * FROM products WHERE name = '" + term + "'";
```

**Safe replacement:**
Use a parameterized query. Pass the value as a bound parameter, never
as part of the SQL string itself.

```js
// Parameterized — placeholder style (e.g. node-postgres, mysql2)
const query = "SELECT * FROM users WHERE id = $1";
const result = await db.query(query, [userId]);

// Parameterized — ? placeholder style (e.g. mysql, sqlite3)
const query = "SELECT * FROM products WHERE name = ?";
const result = await db.query(query, [term]);
```

**What changes:** Only the query construction line and the corresponding
`db.query()` call. Do not change table names, column names, error handling,
or surrounding logic.

**What does NOT change:** imports, function signatures, return values,
error handling, any other file.

---

## xss-reflected

**Rule id:** `xss-reflected`

**Vulnerable pattern (to remove):**
User-controlled request values (e.g. `req.query.*`, `req.params.*`,
`req.body.*`) rendered directly into an HTML response without escaping.

```js
// Direct interpolation into HTML — VULNERABLE
res.send(`<h1>Results for ${req.query.q}</h1>`);

// Concatenation into HTML — VULNERABLE
res.send("<p>" + req.query.q + "</p>");
```

**Safe replacement:**
Escape the value before inserting it into HTML. Use a minimal inline
escape function if no library is available, or a library already present
in the project's `package.json`.

```js
// Minimal inline escape (no new dependency)
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
res.send(`<h1>Results for ${escapeHtml(req.query.q)}</h1>`);
```

If the project already uses a sanitization library (check `package.json`),
use that instead of adding an inline function.

**What changes:** Only the response construction expression, and the
addition of the escape call or helper. Do not change routing, middleware,
or any other response path.

---

## hardcoded-secret

**Rule id:** `hardcoded-secret`

**Vulnerable pattern (to remove):**
A secret value (API key, password, JWT signing key, connection string
with credentials) stored as a string literal in source code.

```js
// String literal API key — VULNERABLE
const apiKey = "sk_live_demo_9f3a1c";

// Hardcoded JWT secret — VULNERABLE
const JWT_SECRET = "super-secret-jwt-key-do-not-share";

// Hardcoded DB password in connection string — VULNERABLE
const connStr = "postgres://admin:p@ssw0rd@localhost/appdb";
```

**Safe replacement:**
Read the value from the runtime environment using `process.env`.

```js
// Environment variable
const apiKey = process.env.API_KEY;

const JWT_SECRET = process.env.JWT_SECRET;

const connStr = process.env.DATABASE_URL;
```

**Additional step — always note to the developer:**
> "The hardcoded value in this diff has been replaced with an environment
> variable reference. The actual secret must be rotated (invalidated and
> reissued) because it has already been committed to version control.
> Add the variable name to `.env.example` so other developers know it is
> required."

**What changes:** Only the assignment line — the string literal becomes
`process.env.VARIABLE_NAME`. Do not change how the value is used downstream.
Do not add `dotenv` imports — `import "dotenv/config"` is already at the
backend entry point per project convention.

---

## General constraints (all types)

- One fix per finding. Do not bundle multiple vulnerability fixes in one diff.
- Do not add comments explaining what the old code did.
- Do not update unrelated imports.
- Do not change indentation of untouched lines.
- If the fix requires a new helper function, add it immediately before its
  first use in the same file — do not create a new file.
