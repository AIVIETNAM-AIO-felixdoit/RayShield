/**
 * Orchestrator — coordinates the three agents in parallel, then merges,
 * prioritizes, and persists the review state.
 * Fully deterministic — no LLM in this phase.
 */
import { codeAgent } from "./agents/codeAgent.js";
import { dependencyAgent } from "./agents/dependencyAgent.js";
import { contextAgent } from "./agents/contextAgent.js";
import { mergeAnalysis } from "./mergeAnalysis.js";
import { prioritize } from "./prioritize.js";
import { reviews } from "./store.js";

/**
 * Run the full analysis workflow for a review.
 * Updates the review record in place as work progresses.
 *
 * @param {string} reviewId
 * @param {string} projectPath
 * @returns {Promise<void>}
 */
export async function runOrchestrator(reviewId, projectPath) {
  const review = reviews.get(reviewId);
  if (!review) return;

  review.status = "scanning";
  review.agentStatuses = {
    codeAgent: "running",
    dependencyAgent: "running",
    contextAgent: "running",
  };

  // Run independent agents concurrently
  const [codeResult, depResult, ctxResult] = await Promise.allSettled([
    codeAgent(projectPath),
    dependencyAgent(projectPath),
    contextAgent(projectPath),
  ]);

  // Process codeAgent result
  let codeFindings = [];
  if (codeResult.status === "fulfilled") {
    codeFindings = codeResult.value.findings;
    review.agentStatuses.codeAgent = "complete";
    review.agentSummaries.codeAgent = codeResult.value.summary;
  } else {
    review.agentStatuses.codeAgent = "error";
    review.agentSummaries.codeAgent = `codeAgent error: ${codeResult.reason?.message ?? String(codeResult.reason)}`;
  }

  // Process dependencyAgent result
  let depFindings = [];
  if (depResult.status === "fulfilled") {
    depFindings = depResult.value.findings;
    review.agentStatuses.dependencyAgent = "complete";
    review.agentSummaries.dependencyAgent = depResult.value.summary;
  } else {
    review.agentStatuses.dependencyAgent = "error";
    review.agentSummaries.dependencyAgent = `dependencyAgent error: ${depResult.reason?.message ?? String(depResult.reason)}`;
  }

  // Process contextAgent result
  if (ctxResult.status === "fulfilled") {
    review.agentStatuses.contextAgent = "complete";
    review.agentSummaries.contextAgent = ctxResult.value.summary;
    review.contextSummary = ctxResult.value.contextSummary;
  } else {
    review.agentStatuses.contextAgent = "error";
    review.agentSummaries.contextAgent = `contextAgent error: ${ctxResult.reason?.message ?? String(ctxResult.reason)}`;
    review.contextSummary = "Context unavailable.";
  }

  // Merge, deduplicate, and sort
  const merged = mergeAnalysis([
    { findings: codeFindings },
    { findings: depFindings },
  ]);
  review.findings = prioritize(merged);
  review.status = "complete";
  review.completedAt = new Date().toISOString();
}
