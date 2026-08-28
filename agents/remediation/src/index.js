/**
 * Boundary for the Bob-backed remediation flow. It must return a proposed
 * patch and explanation; applying a patch requires explicit human approval.
 */
export async function proposeRemediation({ finding, source }) {
  if (!finding || !source) throw new Error("finding and source are required");

  return {
    status: "proposal-pending",
    findingId: finding.id,
    explanation: "Remediation provider has not been connected yet.",
    diff: ""
  };
}
