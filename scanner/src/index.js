/**
 * Scanner adapter boundary. Replace this stub with Semgrep, ESLint security
 * rules, or a custom AST check. Findings must originate from real analysis.
 */
export async function scanProject({ projectPath }) {
  if (!projectPath) throw new Error("projectPath is required");

  return {
    projectPath,
    scannedAt: new Date().toISOString(),
    findings: []
  };
}
