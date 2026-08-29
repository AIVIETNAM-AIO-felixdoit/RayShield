/**
 * Hardcoded credentials detection rule.
 *
 * Detects variables whose names suggest they hold a sensitive value
 * (secret, key, token, password, passwd, credential) when assigned a
 * non-empty string literal — rather than reading from process.env.
 *
 * Pure function — no I/O, no side-effects, fully stateless.
 *
 * @param {string} content   Full text of the source file.
 * @param {string} filePath  Relative path used in the returned finding.
 * @returns {Finding[]}
 */
export function detectHardcodedCredential(content, filePath) {
  const findings = [];
  const lines = content.split("\n");

  // Identifier contains a sensitive keyword (case-insensitive).
  // Uses a lookahead rather than \b so it also matches camelCase names like
  // accessToken, apiKey, jwtSecret, etc.
  const SENSITIVE_NAME =
    /(?:secret|key|token|password|passwd|credential|api_key|apikey)/i;
  // Assigned a string literal of at least 4 characters
  const STRING_LITERAL = /=\s*(?:'[^']{4,}'|"[^"]{4,}"|`[^`]{4,}`)/;
  // Assignment comes from an environment variable — safe, skip
  const ENV_LOOKUP = /process\.env\./;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (
      SENSITIVE_NAME.test(line) &&
      STRING_LITERAL.test(line) &&
      !ENV_LOOKUP.test(line)
    ) {
      findings.push({
        id: crypto.randomUUID(),
        rule: "hardcoded-secret",
        severity: "high",
        file: filePath,
        line: i + 1,
        description:
          "A sensitive variable appears to hold a hardcoded string literal. Use environment variables (process.env.*) instead."
      });
    }
  }

  return findings;
}
