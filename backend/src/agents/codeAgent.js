/**
 * Code agent — delegates to the scanner package.
 * DO NOT modify Felix's scanner implementation.
 * Only calls the public scanProject() API and reshapes the result.
 */
import { scanProject } from "../../../scanner/src/index.js";

/**
 * @param {string} projectPath
 * @returns {Promise<{ findings: import('../store.js').Finding[], summary: string }>}
 */
export async function codeAgent(projectPath) {
  const result = await scanProject({ projectPath });

  const findings = (result.findings ?? []).map((f) => ({
    ...f,
    source: "code",
  }));

  const summary =
    findings.length === 0
      ? "No code vulnerabilities detected."
      : `Detected ${findings.length} code finding(s): ${[...new Set(findings.map((f) => f.rule))].join(", ")}.`;

  return { findings, summary };
}
