/**
 * Deterministic severity/confidence prioritization.
 * No LLM involved.
 */

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

/**
 * Sort findings by severity (most severe first), then alphabetically by rule.
 * @param {import('./store.js').Finding[]} findings
 * @returns {import('./store.js').Finding[]}
 */
export function prioritize(findings) {
  return [...findings].sort((a, b) => {
    const aSev = SEVERITY_ORDER[a.severity?.toLowerCase()] ?? 5;
    const bSev = SEVERITY_ORDER[b.severity?.toLowerCase()] ?? 5;
    if (aSev !== bSev) return aSev - bSev;
    return (a.rule ?? "").localeCompare(b.rule ?? "");
  });
}
