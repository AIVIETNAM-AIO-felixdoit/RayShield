/**
 * Dependency agent — lightweight, deterministic dependency heuristics.
 * Reads demo-app/package.json if present.
 * No external vulnerability database, no new production dependencies.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** Known risky package names and a brief description of their risk. */
const RISKY_PACKAGES = {
  eval: "Uses eval — arbitrary code execution risk.",
  serialize: "Serialization can enable remote code execution if untrusted input is deserialized.",
  "node-serialize": "Known RCE vulnerability (GHSA) — do not deserialize untrusted data.",
  vm2: "Sandbox escape vulnerabilities reported in multiple versions.",
};

/**
 * @param {string} projectPath
 * @returns {Promise<{ findings: import('../store.js').Finding[], summary: string }>}
 */
export async function dependencyAgent(projectPath) {
  const pkgPath = join(projectPath, "package.json");

  let pkg;
  try {
    const raw = await readFile(pkgPath, "utf8");
    pkg = JSON.parse(raw);
  } catch {
    // demo-app/package.json does not exist yet — this is Felix's work. Graceful skip.
    return {
      findings: [],
      summary: "No package.json found in project path — dependency analysis skipped.",
    };
  }

  const allDeps = {
    ...((pkg.dependencies) ?? {}),
    ...((pkg.devDependencies) ?? {}),
  };

  const findings = [];
  for (const [name] of Object.entries(allDeps)) {
    if (RISKY_PACKAGES[name]) {
      findings.push({
        id: crypto.randomUUID(),
        rule: "risky-dependency",
        severity: "high",
        file: "package.json",
        line: 0,
        description: `Dependency "${name}": ${RISKY_PACKAGES[name]}`,
        source: "dependency",
      });
    }
  }

  const summary =
    findings.length === 0
      ? `Scanned ${Object.keys(allDeps).length} dependencies — no known risky packages found.`
      : `Found ${findings.length} risky dependency finding(s).`;

  return { findings, summary };
}
