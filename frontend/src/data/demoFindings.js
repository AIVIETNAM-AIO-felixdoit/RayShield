/**
 * ⚠️  DEMO FALLBACK DATA — used only when the backend is unreachable.
 * Expected real findings: 2 SQL Injection, 1 Reflected XSS, 3 Hardcoded Secrets.
 * These match the file paths and line numbers the scanner will report.
 */
export const demoFindings = [
  // SQL Injection ×2
  {
    id: "sql-injection-1",
    severity: "Critical",
    name: "SQL Injection",
    file: "demo-app/src/db/queries.js",
    line: 8,
    description: "User-controlled input is directly incorporated into a SQL query via string interpolation.",
    status: "Open",
    impact: "An attacker could read, modify, or delete any data by manipulating the query input.",
    action: "Use parameterized queries or a prepared-statement API. Never interpolate user input into SQL.",
    code: "const query = `SELECT * FROM users WHERE id = ${userId}`;",
  },
  {
    id: "sql-injection-2",
    severity: "Critical",
    name: "SQL Injection",
    file: "demo-app/src/db/queries.js",
    line: 21,
    description: "User-supplied search term is concatenated directly into a SQL WHERE clause.",
    status: "Open",
    impact: "An attacker could exfiltrate or corrupt any table accessible to the database user.",
    action: "Replace string concatenation with a parameterized query placeholder.",
    code: "const q = 'SELECT * FROM products WHERE name = \\'' + term + '\\'';",
  },
  // Reflected XSS ×1
  {
    id: "xss",
    severity: "High",
    name: "Reflected XSS",
    file: "demo-app/src/routes/search.js",
    line: 12,
    description: "Search input is reflected back to the browser without escaping or output encoding.",
    status: "Open",
    impact: "Malicious scripts can run in another user's browser session, stealing cookies or credentials.",
    action: "Escape all rendered output. Use a trusted sanitization library or a templating engine that auto-escapes.",
    code: "return res.send(`<h1>Results for ${req.query.q}</h1>`);",
  },
  // Hardcoded Secrets ×3
  {
    id: "hardcoded-secret-1",
    severity: "High",
    name: "Hardcoded Secret",
    file: "demo-app/src/config.js",
    line: 3,
    description: "A live API key is stored as a string literal in a tracked source file.",
    status: "Open",
    impact: "Anyone with repository read access can use the exposed credential immediately.",
    action: "Rotate the key and load it from the runtime environment via process.env.",
    code: "const apiKey = \"sk_live_demo_9f3a1c\";",
  },
  {
    id: "hardcoded-secret-2",
    severity: "High",
    name: "Hardcoded Secret",
    file: "demo-app/src/auth/jwt.js",
    line: 5,
    description: "The JWT signing secret is hardcoded, making all tokens forgeable if the source is exposed.",
    status: "Open",
    impact: "Any party that reads this file can sign arbitrary JWTs and impersonate any user.",
    action: "Load JWT_SECRET from the environment. Rotate all existing tokens after the secret is changed.",
    code: "const JWT_SECRET = \"super-secret-jwt-key-do-not-share\";",
  },
  {
    id: "hardcoded-secret-3",
    severity: "High",
    name: "Hardcoded Secret",
    file: "demo-app/src/db/connection.js",
    line: 4,
    description: "Database password is embedded directly in the connection string literal.",
    status: "Open",
    impact: "The database is accessible to anyone who can read the source code or build artifacts.",
    action: "Use environment variables for all connection credentials. Never commit connection strings with passwords.",
    code: "const connStr = \"postgres://admin:p@ssw0rd@localhost/appdb\";",
  },
];
