/**
 * Reflected XSS rule.
 *
 * Detects user-controlled request data (req.query.*, req.params.*, req.body.*)
 * being embedded directly into an HTTP response (res.send / res.write / res.end)
 * without escaping — via template literals or concatenation.
 *
 * Pure function — no I/O, no side-effects, fully stateless.
 *
 * @param {string} content   Full text of the source file.
 * @param {string} filePath  Relative path used in the returned finding.
 * @returns {Finding[]}
 */
export function detectXss(content, filePath) {
  const findings = [];
  const lines = content.split("\n");

  // Server-side response sink
  const RESPONSE_SINK = /res\.(send|write|end)\s*\(/;
  // req.* source inside a template expression or adjacent to a concat operator
  const REQUEST_SOURCE_TEMPLATE = /\$\{[^}]*req\.[a-zA-Z_.[\]"']+[^}]*\}/;
  const REQUEST_SOURCE_CONCAT = /req\.[a-zA-Z_.[\]"']+\s*\+|[+]\s*req\.[a-zA-Z_.[\]"']+/;

  // Client-side DOM sinks
  const DOM_SINK =
    /(?:\.innerHTML|\.outerHTML|document\.write\s*\(|insertAdjacentHTML\s*\()/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const isServerXss =
      RESPONSE_SINK.test(line) &&
      (REQUEST_SOURCE_TEMPLATE.test(line) || REQUEST_SOURCE_CONCAT.test(line));

    const isClientXss = DOM_SINK.test(line) && /\$\{[^}]+\}/.test(line);

    if (isServerXss || isClientXss) {
      findings.push({
        id: crypto.randomUUID(),
        rule: "xss-reflected",
        severity: "high",
        file: filePath,
        line: i + 1,
        description:
          "User-controlled data is embedded into HTML output without escaping. Sanitise or encode output before rendering."
      });
    }
  }

  return findings;
}
