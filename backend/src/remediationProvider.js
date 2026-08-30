/**
 * Deterministic remediation provider for the three known demo-app vulnerabilities.
 *
 * This is NOT IBM Bob runtime AI. It is a rule-based provider that produces
 * known-correct fixes for the specific patterns RayShield detects in demo-app/.
 *
 * Integration point: when the Bob/AI reasoning layer is ready, replace the
 * body of `buildProposal()` with a call to the AI backend while keeping the
 * same return shape: { status, findingId, explanation, diff, fixedSource }.
 */

/**
 * @typedef {Object} RemediationProposal
 * @property {string} status        - "proposed"
 * @property {string} findingId
 * @property {string} explanation   - human-readable description of the fix
 * @property {string} diff          - unified diff string (--- / +++ lines)
 * @property {string} fixedSource   - full fixed file content (used by applyFix)
 */

/**
 * Build a remediation proposal for a known finding + source combination.
 * Returns null if no deterministic fix is known for this rule.
 *
 * @param {{ id: string, rule: string, file: string, line: number }} finding
 * @param {string} source - raw content of the file containing the finding
 * @returns {RemediationProposal | null}
 */
export function buildProposal(finding, source) {
  switch (finding.rule) {
    case "sql-injection":
      return fixSqlInjection(finding, source);
    case "xss-reflected":
      return fixXssReflected(finding, source);
    case "hardcoded-secret":
      return fixHardcodedSecret(finding, source);
    default:
      return null;
  }
}

// ── SQL Injection ─────────────────────────────────────────────────────────────
// Pattern: template literal SQL with interpolated variable
// Fix:     replace with parameterised query placeholder

function fixSqlInjection(finding, source) {
  // Match: `SELECT * FROM users WHERE id = ${id}` or similar template-literal SQL.
  // Replacement preserves text after the interpolation and produces valid JS:
  //   db.query(`SELECT ... ${id}`)  →  db.query("SELECT ... ?", [id])
  // The backtick template literal is replaced in-place; the surrounding call is untouched.
  const fixed = source.replace(
    /`([^`]*SELECT[^`]*)\$\{(\w+)\}([^`]*)`/gi,
    (_match, before, varName, after) =>
      `"${before}?${after}", [${varName}]`
  );

  if (fixed === source) {
    return null; // pattern not found — do not guess
  }

  return {
    status: "proposed",
    findingId: finding.id,
    explanation:
      "SQL injection detected: user input is interpolated directly into a SQL string. " +
      "Fix: replace the template literal with a parameterised query using a placeholder (?) " +
      "and pass the value as a separate array argument. This prevents the database driver " +
      "from treating user input as SQL syntax.",
    diff: makeDiff(finding.file, source, fixed),
    fixedSource: fixed,
  };
}

// ── XSS Reflected ─────────────────────────────────────────────────────────────
// Pattern: res.send(`...${req.query.q}...`) — unescaped user input in HTML response
// Fix:     wrap with escapeHtml() helper and inject helper at top of file

function fixXssReflected(finding, source) {
  const escapeHelper =
    "function escapeHtml(str) {\n" +
    '  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;")\n' +
    '    .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/\'/g,"&#39;");\n' +
    "}\n\n";

  // Replace unescaped req.query.q (or req.query[any]) in template literals
  let fixed = source.replace(/\$\{req\.query\.(\w+)\}/g, (_m, name) => `\${escapeHtml(req.query.${name})}`);

  if (fixed === source) {
    return null;
  }

  // Prepend helper only if not already present
  if (!fixed.includes("function escapeHtml")) {
    fixed = escapeHelper + fixed;
  }

  return {
    status: "proposed",
    findingId: finding.id,
    explanation:
      "Reflected XSS detected: a request query parameter is embedded in an HTML response " +
      "without escaping. An attacker can inject arbitrary HTML or JavaScript via the URL. " +
      "Fix: HTML-encode the value before embedding using an escapeHtml() helper that " +
      "replaces the five dangerous characters (&, <, >, \", ').",
    diff: makeDiff(finding.file, source, fixed),
    fixedSource: fixed,
  };
}

// ── Hardcoded Secret ──────────────────────────────────────────────────────────
// Pattern: export const JWT_SECRET = "literal-string"
// Fix:     replace with process.env.JWT_SECRET (no fallback)

function fixHardcodedSecret(finding, source) {
  // Match: const/let/var NAME = "..." or NAME = '...' where name contains SECRET/KEY/TOKEN/PASSWORD
  const fixed = source.replace(
    /((?:const|let|var)\s+(\w*(?:SECRET|KEY|TOKEN|PASSWORD)\w*)\s*=\s*)["'][^"']*["']/gi,
    (_match, prefix, name) => `${prefix}process.env.${name}`
  );

  if (fixed === source) {
    return null;
  }

  return {
    status: "proposed",
    findingId: finding.id,
    explanation:
      "Hardcoded secret detected: a sensitive value (secret key, token, or password) is " +
      "assigned as a string literal in source code. This exposes the secret to anyone who " +
      "can read the code (version control history, build artifacts, logs). " +
      "Fix: replace the literal with process.env.<VARIABLE_NAME> and store the real value " +
      "in a .env file that is excluded from version control.",
    diff: makeDiff(finding.file, source, fixed),
    fixedSource: fixed,
  };
}

// ── Unified diff builder ──────────────────────────────────────────────────────

/**
 * Produce a minimal unified diff string.
 * @param {string} filePath
 * @param {string} original
 * @param {string} fixed
 * @returns {string}
 */
function makeDiff(filePath, original, fixed) {
  const origLines = original.split("\n");
  const fixedLines = fixed.split("\n");

  const hunks = [];
  let i = 0;
  let j = 0;

  while (i < origLines.length || j < fixedLines.length) {
    if (origLines[i] === fixedLines[j]) {
      i++;
      j++;
      continue;
    }

    const hunkStart = i + 1; // 1-based
    const removals = [];
    const additions = [];

    // Collect consecutive differing lines
    while (i < origLines.length || j < fixedLines.length) {
      if (origLines[i] === fixedLines[j]) break;
      if (i < origLines.length) removals.push(`-${origLines[i++]}`);
      if (j < fixedLines.length) additions.push(`+${fixedLines[j++]}`);
    }

    hunks.push(
      `@@ -${hunkStart},${removals.length} +${hunkStart},${additions.length} @@\n` +
        [...removals, ...additions].join("\n")
    );
  }

  if (hunks.length === 0) return "";

  return (
    `--- a/${filePath}\n` +
    `+++ b/${filePath}\n` +
    hunks.join("\n")
  );
}
