import "dotenv/config";
import cors from "cors";
import express from "express";
import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { summarizeValidation } from "../../validator/src/index.js";
import { scanProject } from "../../scanner/src/index.js";
import { createReview, reviews } from "./store.js";
import { runOrchestrator } from "./orchestrator.js";
import { buildProposal } from "./remediationProvider.js";

const app = express();
const port = process.env.PORT || 3001;

// Default scan target — can be overridden via POST body or env var
const DEFAULT_PROJECT_PATH = resolve(process.env.PROJECT_PATH ?? join(process.cwd(), "demo-app"));

app.use(cors());
app.use(express.json());

// ── Health ────────────────────────────────────────────────────────────────────

app.get("/health", (_request, response) => {
  response.json({ service: "rayshield-api", status: "ok" });
});

// ── POST /api/reviews ─────────────────────────────────────────────────────────
// Start a security review.  Orchestration runs asynchronously so the HTTP
// response returns immediately with reviewId and "queued" status.
//
// Response shape:
// {
//   reviewId: string,
//   status:   "queued",
//   nextStep: "scan"
// }

app.post("/api/reviews", (request, response) => {
  const reviewId = crypto.randomUUID();
  const projectPath = request.body?.projectPath ?? DEFAULT_PROJECT_PATH;

  createReview(reviewId, projectPath);

  // Fire-and-forget — orchestrator updates the store in the background.
  runOrchestrator(reviewId, projectPath).catch((err) => {
    const review = reviews.get(reviewId);
    if (review) {
      review.status = "error";
      review.agentSummaries.orchestrator = `Orchestrator error: ${err.message}`;
    }
  });

  response.status(202).json({
    reviewId,
    status: "queued",
    nextStep: "scan",
  });
});

// ── GET /api/reviews/:reviewId ────────────────────────────────────────────────
// Return the current state of a review.
//
// Response shape:
// {
//   reviewId:       string,
//   status:         "queued" | "scanning" | "complete" | "error",
//   findings:       Finding[],
//   agentStatuses:  Record<string, string>,
//   contextSummary: string,
//   agentSummaries: Record<string, string>
// }

app.get("/api/reviews/:reviewId", (request, response) => {
  const review = reviews.get(request.params.reviewId);
  if (!review) {
    return response.status(404).json({ error: "Review not found." });
  }

  response.json({
    reviewId: review.reviewId,
    status: review.status,
    findings: review.findings,
    agentStatuses: review.agentStatuses,
    contextSummary: review.contextSummary,
    agentSummaries: review.agentSummaries,
  });
});

// ── POST /api/findings/:findingId/remediation ─────────────────────────────────
// Generate a remediation proposal for a specific finding.
// Reads the source file, runs the deterministic provider, stores the proposal.
// Does NOT modify any file — proposal only.
//
// Integration point: replace buildProposal() with Bob/AI call when available.
//
// Response shape:
// {
//   findingId:   string,
//   status:      "proposed" | "no-fix-available",
//   explanation: string,
//   diff:        string
// }

app.post("/api/findings/:findingId/remediation", async (request, response) => {
  const { findingId } = request.params;
  const { reviewId } = request.body ?? {};

  if (!reviewId) {
    return response.status(400).json({ error: "reviewId is required in the request body." });
  }

  const review = reviews.get(reviewId);
  if (!review) {
    return response.status(404).json({ error: "Review not found." });
  }

  const finding = review.findings.find((f) => f.id === findingId);
  if (!finding) {
    return response.status(404).json({ error: "Finding not found in this review." });
  }

  // Read the source file for context and diff generation.
  // finding.file is relative to the project path (e.g. "src\db\queries.js"),
  // so we must resolve it against review.projectPath to get the absolute path.
  const absFilePath = resolve(review.projectPath, finding.file);
  let source = "";
  try {
    source = await readFile(absFilePath, "utf8");
  } catch {
    source = `[source file not readable: ${absFilePath}]`;
  }

  // Try the deterministic provider first
  const proposal = buildProposal(finding, source);

  if (proposal) {
    review.proposals[findingId] = proposal;
    return response.json({
      findingId,
      status: proposal.status,
      explanation: proposal.explanation,
      diff: proposal.diff,
    });
  }

  // No deterministic fix available — store a stub so the approval gate works
  // and the Bob/AI layer can replace it later.
  const fallback = {
    status: "no-fix-available",
    findingId,
    explanation: `No deterministic fix is available for rule "${finding.rule}". ` +
      "Connect the Bob/AI reasoning layer to generate a proposal for this finding.",
    diff: "",
    fixedSource: "",
  };
  review.proposals[findingId] = fallback;

  response.json({
    findingId,
    status: fallback.status,
    explanation: fallback.explanation,
    diff: fallback.diff,
  });
});

// ── POST /api/findings/:findingId/approve ─────────────────────────────────────
// Explicit human approval gate.  Must be called before apply or validate.
// Approval is never automatic.
//
// Response shape:
// {
//   findingId: string,
//   approved:  true,
//   message:   string
// }

app.post("/api/findings/:findingId/approve", (request, response) => {
  const { findingId } = request.params;
  const { reviewId } = request.body ?? {};

  if (!reviewId) {
    return response.status(400).json({ error: "reviewId is required in the request body." });
  }

  const review = reviews.get(reviewId);
  if (!review) {
    return response.status(404).json({ error: "Review not found." });
  }

  const finding = review.findings.find((f) => f.id === findingId);
  if (!finding) {
    return response.status(404).json({ error: "Finding not found in this review." });
  }

  if (!review.proposals[findingId]) {
    return response.status(409).json({
      error: "No remediation proposal exists for this finding. Generate one first via POST /api/findings/:findingId/remediation.",
    });
  }

  if (review.rejections[findingId]) {
    return response.status(409).json({
      error: "This finding's proposal was previously rejected. Generate a new proposal before approving.",
    });
  }

  review.approvals[findingId] = true;

  response.json({
    findingId,
    approved: true,
    message: "Finding approved. Call POST /api/findings/:findingId/apply to apply the fix, then POST /api/findings/:findingId/validate to verify.",
  });
});

// ── POST /api/findings/:findingId/reject ──────────────────────────────────────
// Reject a remediation proposal.  Clears the approval state.
// A new remediation proposal must be generated before approving again.
//
// Response shape:
// {
//   findingId: string,
//   rejected:  true,
//   reason:    string
// }

app.post("/api/findings/:findingId/reject", (request, response) => {
  const { findingId } = request.params;
  const { reviewId, reason } = request.body ?? {};

  if (!reviewId) {
    return response.status(400).json({ error: "reviewId is required in the request body." });
  }

  const review = reviews.get(reviewId);
  if (!review) {
    return response.status(404).json({ error: "Review not found." });
  }

  const finding = review.findings.find((f) => f.id === findingId);
  if (!finding) {
    return response.status(404).json({ error: "Finding not found in this review." });
  }

  if (!review.proposals[findingId]) {
    return response.status(409).json({
      error: "No proposal exists for this finding. Nothing to reject.",
    });
  }

  // Clear approval, record rejection
  delete review.approvals[findingId];
  review.rejections[findingId] = reason ?? "Rejected by reviewer.";

  response.json({
    findingId,
    rejected: true,
    reason: review.rejections[findingId],
  });
});

// ── POST /api/findings/:findingId/apply ───────────────────────────────────────
// Apply an approved remediation fix to the source file on disk.
// Requires prior explicit approval — will NOT apply if only proposed.
// Sequence enforced: PROPOSE → APPROVE → APPLY
//
// Response shape:
// {
//   findingId:  string,
//   applied:    true,
//   appliedAt:  string (ISO timestamp),
//   file:       string
// }

app.post("/api/findings/:findingId/apply", async (request, response) => {
  const { findingId } = request.params;
  const { reviewId } = request.body ?? {};

  if (!reviewId) {
    return response.status(400).json({ error: "reviewId is required in the request body." });
  }

  const review = reviews.get(reviewId);
  if (!review) {
    return response.status(404).json({ error: "Review not found." });
  }

  const finding = review.findings.find((f) => f.id === findingId);
  if (!finding) {
    return response.status(404).json({ error: "Finding not found in this review." });
  }

  // Hard gate 1: must have a proposal
  const proposal = review.proposals[findingId];
  if (!proposal) {
    return response.status(409).json({
      error: "No remediation proposal exists. Call POST /api/findings/:findingId/remediation first.",
    });
  }

  // Hard gate 2: must be approved
  if (!review.approvals[findingId]) {
    return response.status(409).json({
      error: "Fix has not been approved. Call POST /api/findings/:findingId/approve first.",
    });
  }

  // Hard gate 3: must have actual fixed source content
  if (!proposal.fixedSource || proposal.fixedSource.trim().length === 0) {
    return response.status(409).json({
      error: "The current proposal has no fixed source content to apply. " +
        "This happens when no deterministic fix is available for the rule. " +
        "Connect the Bob/AI reasoning layer to produce a fix for this finding.",
    });
  }

  // Already applied — idempotent
  if (review.applied[findingId]) {
    return response.json({
      findingId,
      applied: true,
      appliedAt: review.applied[findingId],
      file: finding.file,
      message: "Fix was already applied.",
    });
  }

  // Write the fixed source to disk.
  // Resolve finding.file relative to the project path (same logic as readFile above).
  const absApplyPath = resolve(review.projectPath, finding.file);
  try {
    await writeFile(absApplyPath, proposal.fixedSource, "utf8");
  } catch (err) {
    return response.status(500).json({
      error: `Failed to write fix to ${absApplyPath}: ${err.message}`,
    });
  }

  const appliedAt = new Date().toISOString();
  review.applied[findingId] = appliedAt;

  response.json({
    findingId,
    applied: true,
    appliedAt,
    file: finding.file,
  });
});

// ── POST /api/findings/:findingId/validate ────────────────────────────────────
// Validate a remediation: verify fix was applied, re-scan, summarize.
// Full workflow: APPLY → RE-SCAN → SUMMARIZE → FIX VERIFIED / NOT VERIFIED
//
// Requires: proposal → approval → apply (in that order).
//
// Response shape:
// {
//   findingId:      string,
//   checks:         Check[],
//   status:         "FIX VERIFIED" | "NOT VERIFIED",
//   rescanFindings: Finding[]
// }

app.post("/api/findings/:findingId/validate", async (request, response) => {
  const { findingId } = request.params;
  const { reviewId } = request.body ?? {};

  if (!reviewId) {
    return response.status(400).json({ error: "reviewId is required in the request body." });
  }

  const review = reviews.get(reviewId);
  if (!review) {
    return response.status(404).json({ error: "Review not found." });
  }

  const finding = review.findings.find((f) => f.id === findingId);
  if (!finding) {
    return response.status(404).json({ error: "Finding not found in this review." });
  }

  // Hard gate 1: approval is mandatory
  if (!review.approvals[findingId]) {
    return response.status(409).json({
      error: "Finding has not been approved. Call POST /api/findings/:findingId/approve first.",
    });
  }

  // ── Check 1: Was the fix actually applied? ─────────────────────────────────
  const wasApplied = Boolean(review.applied[findingId]);
  const applyCheck = {
    name: "fix-applied",
    status: wasApplied ? "passed" : "failed",
    detail: wasApplied
      ? `Fix was applied to ${finding.file} at ${review.applied[findingId]}.`
      : `Fix has not been applied yet. Call POST /api/findings/:findingId/apply first.`,
  };

  // ── Check 2: Syntax check the fixed file ──────────────────────────────────
  // Run `node --check <file>` to verify the applied fix is syntactically valid JS.
  // Only meaningful for .js files; skip gracefully for other file types.
  // Resolve finding.file against projectPath for the syntax check (same as readFile/writeFile above).
  const absSyntaxPath = resolve(review.projectPath, finding.file);
  const syntaxCheck = await new Promise((resolveCheck) => {
    if (!wasApplied || !finding.file.endsWith(".js")) {
      resolveCheck({
        name: "syntax-check",
        status: wasApplied ? "passed" : "failed",
        detail: wasApplied
          ? `Syntax check skipped — not a .js file.`
          : `Syntax check skipped — fix has not been applied yet.`,
      });
      return;
    }
    execFile(process.execPath, ["--check", absSyntaxPath], (err) => {
      if (err) {
        resolveCheck({
          name: "syntax-check",
          status: "failed",
          detail: `Syntax error in ${finding.file}: ${err.message.split("\n")[0]}`,
        });
      } else {
        resolveCheck({
          name: "syntax-check",
          status: "passed",
          detail: `${finding.file} passed Node.js syntax check (node --check).`,
        });
      }
    });
  });

  // ── Check 3: Re-scan the project ───────────────────────────────────────────
  let rescanFindings = [];
  let rescanCheck = { name: "re-scan", status: "failed", detail: "Re-scan not performed." };

  try {
    const rescanResult = await scanProject({ projectPath: review.projectPath });
    rescanFindings = rescanResult.findings ?? [];

    const stillPresent = rescanFindings.some(
      (f) => f.rule === finding.rule && f.file === finding.file
    );

    rescanCheck = {
      name: "re-scan",
      status: stillPresent ? "failed" : "passed",
      detail: stillPresent
        ? `Rule "${finding.rule}" still detected in ${finding.file} after fix was applied.`
        : `Rule "${finding.rule}" no longer detected in ${finding.file} — vulnerability resolved.`,
    };
  } catch (err) {
    rescanCheck = { name: "re-scan", status: "failed", detail: `Re-scan error: ${err.message}` };
  }

  // ── Summarize via validator ────────────────────────────────────────────────
  const checks = [applyCheck, syntaxCheck, rescanCheck];
  const validation = summarizeValidation(checks);
  review.validations[findingId] = { checks, ...validation, rescanFindings };

  response.json({
    findingId,
    checks,
    status: validation.status,
    rescanFindings,
  });
});

app.listen(port, () => {
  console.log(`RayShield API listening on http://localhost:${port}`);
});

// Export app for testing
export { app };
