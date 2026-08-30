/**
 * In-memory store for the MVP workflow.
 * Holds reviews, findings, remediation proposals, approval state, and validation results.
 * All data is lost on server restart — acceptable for the hackathon MVP.
 */

/** @type {Map<string, Review>} */
export const reviews = new Map();

/**
 * @typedef {Object} Finding
 * @property {string} id
 * @property {string} rule
 * @property {string} severity
 * @property {string} file
 * @property {number} line
 * @property {string} description
 * @property {string} source          - which agent produced this finding
 * @property {string} reviewId
 */

/**
 * @typedef {Object} Proposal
 * @property {string} status
 * @property {string} findingId
 * @property {string} explanation
 * @property {string} diff
 */

/**
 * @typedef {Object} Review
 * @property {string} reviewId
 * @property {string} projectPath
 * @property {string} status          - "queued" | "scanning" | "complete" | "error"
 * @property {string} createdAt
 * @property {string|null} completedAt
 * @property {Finding[]} findings
 * @property {Record<string, string>} agentStatuses   - agent name → "running"|"complete"|"error"
 * @property {string} contextSummary
 * @property {Record<string, string>} agentSummaries  - agent name → human-readable summary
 * @property {Record<string, Proposal>} proposals     - findingId → proposal
 * @property {Record<string, boolean>} approvals      - findingId → true if approved
 * @property {Record<string, string>} rejections      - findingId → rejection reason
 * @property {Record<string, string>} applied         - findingId → ISO timestamp of apply
 * @property {Record<string, object>} validations     - findingId → validation result
 */

/**
 * Create a new review record and add it to the store.
 * @param {string} reviewId
 * @param {string} projectPath
 * @returns {Review}
 */
export function createReview(reviewId, projectPath) {
  const review = {
    reviewId,
    projectPath,
    status: "queued",
    createdAt: new Date().toISOString(),
    completedAt: null,
    findings: [],
    agentStatuses: {},
    contextSummary: "",
    agentSummaries: {},
    proposals: {},
    approvals: {},
    rejections: {},
    applied: {},
    validations: {},
  };
  reviews.set(reviewId, review);
  return review;
}
