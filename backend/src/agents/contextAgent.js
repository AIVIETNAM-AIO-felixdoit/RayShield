/**
 * Context agent — reads README/architecture/package metadata to produce
 * a contextual summary for the review. MUST NOT invent security findings.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Attempt to read a file and return its content, or null if missing.
 * @param {string} filePath
 * @returns {Promise<string|null>}
 */
async function tryRead(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

/**
 * @param {string} projectPath
 * @returns {Promise<{ findings: [], summary: string, contextSummary: string }>}
 */
export async function contextAgent(projectPath) {
  const [readme, pkgRaw, archMd] = await Promise.all([
    tryRead(join(projectPath, "README.md")),
    tryRead(join(projectPath, "package.json")),
    tryRead(join(process.cwd(), "docs", "architecture.md")),
  ]);

  const parts = [];

  if (readme) {
    const firstLine = readme.split("\n").find((l) => l.trim().length > 0) ?? "";
    parts.push(`Project README: ${firstLine.replace(/^#+\s*/, "").trim()}`);
  }

  if (pkgRaw) {
    try {
      const pkg = JSON.parse(pkgRaw);
      const depCount = Object.keys(pkg.dependencies ?? {}).length;
      parts.push(`Package: ${pkg.name ?? "unknown"} v${pkg.version ?? "unknown"} (${depCount} dependencies)`);
    } catch {
      // malformed package.json — skip silently
    }
  }

  if (archMd) {
    parts.push("Architecture documentation available.");
  }

  const contextSummary =
    parts.length > 0
      ? parts.join(" | ")
      : "No additional context metadata found for this project.";

  return {
    findings: [], // context agent never produces security findings
    summary: `Context gathered: ${parts.length} metadata source(s) read.`,
    contextSummary,
  };
}
