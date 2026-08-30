/**
 * Merge findings from multiple agents.
 * Deduplicates by (rule + file + line) composite key.
 */

/**
 * @param {Array<{ findings: import('./store.js').Finding[] }>} agentResults
 * @returns {import('./store.js').Finding[]}
 */
export function mergeAnalysis(agentResults) {
  const seen = new Set();
  const merged = [];

  for (const result of agentResults) {
    for (const finding of result.findings ?? []) {
      // Ensure every merged finding has an id
      if (!finding.id) {
        finding.id = crypto.randomUUID();
      }

      const key = `${finding.rule}::${finding.file}::${finding.line}`;
      if (seen.has(key)) {
        continue; // duplicate — skip
      }
      seen.add(key);
      merged.push(finding);
    }
  }

  return merged;
}
