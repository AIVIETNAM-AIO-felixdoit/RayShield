import { readdir, readFile, stat } from "fs/promises";
import { join, relative, extname } from "path";
import { detectSqlInjection } from "./rules/sql-injection.js";
import { detectXss } from "./rules/xss.js";
import { detectHardcodedCredential } from "./rules/sast-literals.js";

/** Directories that are never scanned. */
const SKIP_DIRS = new Set(["node_modules", ".git", "bob_sessions"]);

/**
 * Recursively collect all .js files under `dir`, skipping SKIP_DIRS.
 *
 * @param {string} dir   Absolute or relative directory to walk.
 * @returns {Promise<string[]>}  Array of file paths.
 */
async function walkJs(dir) {
  const results = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return results; // Unreadable directory — return empty
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const sub = await walkJs(join(dir, entry.name));
      results.push(...sub);
    } else if (entry.isFile() && extname(entry.name) === ".js") {
      results.push(join(dir, entry.name));
    }
  }
  return results;
}

/**
 * Scan a project directory for security vulnerabilities.
 *
 * Preserves the exact boundary contract:
 *   { projectPath, scannedAt, findings[] }
 *
 * @param {{ projectPath: string }} options
 * @returns {Promise<{ projectPath: string, scannedAt: string, findings: object[] }>}
 */
export async function scanProject({ projectPath }) {
  if (!projectPath) throw new Error("projectPath is required");

  const findings = [];

  // Gracefully handle non-existent or inaccessible paths.
  try {
    await stat(projectPath);
  } catch {
    return { projectPath, scannedAt: new Date().toISOString(), findings };
  }

  const files = await walkJs(projectPath);

  for (const absPath of files) {
    let content;
    try {
      content = await readFile(absPath, "utf8");
    } catch {
      continue; // Skip unreadable files
    }

    // Use a path relative to projectPath for cleaner finding output.
    const relPath = relative(projectPath, absPath);

    findings.push(
      ...detectSqlInjection(content, relPath),
      ...detectXss(content, relPath),
      ...detectHardcodedCredential(content, relPath)
    );
  }

  return {
    projectPath,
    scannedAt: new Date().toISOString(),
    findings
  };
}
