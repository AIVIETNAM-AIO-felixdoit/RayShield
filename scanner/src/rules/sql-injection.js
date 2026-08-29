/**
 * SQL Injection rule.
 *
 * Detects unsafe SQL construction where user-controlled values are directly
 * interpolated (template literals) or concatenated (+) into a SQL query string.
 *
 * Pure function — no I/O, no side-effects, fully stateless.
 *
 * @param {string} content   Full text of the source file.
 * @param {string} filePath  Relative path used in the returned finding.
 * @returns {Finding[]}
 */
export function detectSqlInjection(content, filePath) {
  const findings = [];
  const lines = content.split("\n");

  // SQL keyword present in the line
  const SQL_KEYWORD = /\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE)\b/i;
  // Template literal expression: ${ anything }
  const TEMPLATE_EXPR = /\$\{[^}]+\}/;
  // String concat where right-hand operand is NOT a quoted literal:
  //   "some sql " + variable   (not "some sql " + "literal")
  const CONCAT_VAR = /[`"'][^`"']*[`"']\s*\+\s*(?!['"`])/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (
      SQL_KEYWORD.test(line) &&
      (TEMPLATE_EXPR.test(line) || CONCAT_VAR.test(line))
    ) {
      findings.push({
        id: crypto.randomUUID(),
        rule: "sql-injection",
        severity: "critical",
        file: filePath,
        line: i + 1,
        description:
          "User-controlled value is directly interpolated or concatenated into a SQL query. Use parameterised queries instead."
      });
    }
  }

  return findings;
}
