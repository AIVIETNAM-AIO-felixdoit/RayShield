import { useEffect, useRef, useState } from "react";
import Header from "./components/Header.jsx";
import WorkflowStepper from "./components/WorkflowStepper.jsx";
import RepositoryCard from "./components/RepositoryCard.jsx";
import AgentActivity from "./components/AgentActivity.jsx";
import FindingsList from "./components/FindingsList.jsx";
import FindingDetails from "./components/FindingDetails.jsx";
import { demoFindings } from "./data/demoFindings.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const initialAgentStatuses = { code: "Ready", dependency: "Ready", context: "Ready" };
const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:3001").replace(/\/$/, "");

/**
 * Workflow state machine.
 *
 * Valid transitions (sequential — no skipping):
 *   idle → detecting → analysisComplete
 *   analysisComplete → understanding → remediationProposed
 *   remediationProposed → awaitingApproval → approved | rejected
 *   approved → applying → validating → rescanning → verified | notVerified
 *   Any step → error
 */
export const WORKFLOW_STATES = {
  IDLE: "idle",
  DETECTING: "detecting",
  ANALYSIS_COMPLETE: "analysisComplete",
  UNDERSTANDING: "understanding",
  REMEDIATION_PROPOSED: "remediationProposed",
  AWAITING_APPROVAL: "awaitingApproval",
  APPROVED: "approved",
  REJECTED: "rejected",
  APPLYING: "applying",
  APPLIED: "applied",
  VALIDATING: "validating",
  RESCANNING: "rescanning",
  VERIFIED: "verified",
  NOT_VERIFIED: "notVerified",
  ERROR: "error",
};

// ---------------------------------------------------------------------------
// DEMO fallback — clearly labelled, used only when backend is unavailable
// ---------------------------------------------------------------------------

/**
 * ⚠️  DEMO DATA — not from the backend. Shown when the backend is unreachable.
 * The `rule` field mirrors the real backend finding shape.
 */
const DEMO_FALLBACK_FINDINGS = demoFindings.map((f, i) => ({
  id: f.id || `demo-${i}`,
  rule: f.name || "demo-rule",
  severity: f.severity || "High",
  file: f.file || "demo-app/src/unknown.js",
  line: f.line || 1,
  description: f.description || "No description available.",
  // UI-only extras kept for demo presentation
  _demo: true,
  _name: f.name,
  _status: "Open",
  _impact: f.impact || "Impact details unavailable.",
  _action: f.action || "Review this issue.",
  _code: f.code || "// No code snippet available.",
}));

// ---------------------------------------------------------------------------
// Normalisation helpers
// ---------------------------------------------------------------------------

/**
 * Normalise a finding from the real backend shape:
 *   { id, rule, severity, file, line, description }
 * Extra fields present in some responses are preserved under their original keys.
 */
const normalizeFinding = (finding, index) => ({
  // Core backend fields — do not rename
  id: finding?.id || finding?.findingId || `finding-${index}`,
  rule: finding?.rule || finding?.name || finding?.title || `rule-${index}`,
  severity: normalizeServerity(finding?.severity || finding?.level || "Medium"),
  file: finding?.file || finding?.path || finding?.location || "unknown",
  line: finding?.line ?? finding?.startLine ?? 1,
  description: finding?.description || finding?.summary || "No description available.",
  // Workflow tracking fields added by the frontend
  _remediationState: finding?._remediationState || null,   // { explanation, proposedFix, diff, status }
  _approvalStatus: finding?._approvalStatus || null,       // "approved" | "rejected" | null
  _validationResult: finding?._validationResult || null,   // { tests, rescan, verified }
  // Demo-mode extras (present only when _demo === true)
  _demo: finding?._demo || false,
  _name: finding?._name || finding?.rule || finding?.name || `Finding ${index + 1}`,
  _status: finding?._status || finding?.status || "Open",
  _impact: finding?._impact || finding?.impact || "",
  _action: finding?._action || finding?.action || "",
  _code: finding?._code || finding?.code || finding?.snippet || "",
});

const normalizeServerity = (value) => {
  const text = String(value ?? "Medium").trim();
  if (!text) return "Medium";
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};

const normalizeAgentStatuses = (value = {}) => ({
  code: value.code || value.codeAgent || value["Code Agent"] || "Ready",
  dependency: value.dependency || value.dependencyAgent || value["Dependency Agent"] || "Ready",
  context: value.context || value.contextAgent || value["Context Agent"] || "Ready",
});

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const payload = await response.json();
      if (payload?.message) message = payload.message;
      else if (payload?.error) message = payload.error;
    } catch {
      // keep fallback text
    }
    throw new Error(message);
  }

  const ct = response.headers.get("content-type") || "";
  if (ct.includes("application/json")) return response.json();
  return null;
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export default function App() {
  const [workflowState, setWorkflowState] = useState(WORKFLOW_STATES.IDLE);
  const [selectedFinding, setSelectedFinding] = useState(null);
  const [analysisStatus, setAnalysisStatus] = useState("Ready to analyze");
  const [agentStatuses, setAgentStatuses] = useState(initialAgentStatuses);
  const [findings, setFindings] = useState([]);
  const [reviewId, setReviewId] = useState(null);
  const [error, setError] = useState("");
  const [usingDemoData, setUsingDemoData] = useState(false);
  const pollRef = useRef(null);

  // Derived: is any async operation in flight?
  const loading =
    workflowState === WORKFLOW_STATES.DETECTING ||
    workflowState === WORKFLOW_STATES.UNDERSTANDING ||
    workflowState === WORKFLOW_STATES.APPLYING ||
    workflowState === WORKFLOW_STATES.VALIDATING ||
    workflowState === WORKFLOW_STATES.RESCANNING;

  const clearPolling = () => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => () => clearPolling(), []);

  // Auto-select first finding when list becomes non-empty
  useEffect(() => {
    if (!selectedFinding && findings.length > 0) {
      setSelectedFinding(findings[0]);
    }
  }, [selectedFinding, findings]);

  // ---------------------------------------------------------------------------
  // Review polling — triggered when reviewId changes
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!reviewId) return undefined;

    clearPolling();
    setWorkflowState(WORKFLOW_STATES.DETECTING);
    setError("");

    const pollReview = async () => {
      try {
        const reviewState = await fetchJson(
          `${API_BASE}/api/reviews/${encodeURIComponent(reviewId)}`
        );
        const status = String(reviewState?.status || "queued").toLowerCase();

        if (reviewState?.agentStatuses || reviewState?.agents) {
          setAgentStatuses(
            normalizeAgentStatuses(reviewState.agentStatuses || reviewState.agents)
          );
        }

        const mappedFindings = Array.isArray(reviewState?.findings)
          ? reviewState.findings.map(normalizeFinding)
          : [];

        if (mappedFindings.length > 0) {
          setFindings(mappedFindings);
          setSelectedFinding((cur) => {
            if (cur && mappedFindings.some((f) => f.id === cur.id)) return cur;
            return mappedFindings[0];
          });
        }

        if (
          status.includes("complete") ||
          status.includes("verified") ||
          status === "done"
        ) {
          setAnalysisStatus("Analysis complete");
          setWorkflowState(WORKFLOW_STATES.ANALYSIS_COMPLETE);
          clearPolling();
          return;
        }

        if (
          status.includes("error") ||
          status.includes("not found") ||
          status.includes("failed")
        ) {
          setError("Review not found or the backend returned an error.");
          setAnalysisStatus("Review unavailable");
          setWorkflowState(WORKFLOW_STATES.ERROR);
          clearPolling();
        }
        // else: still running — keep polling
      } catch (err) {
        setError(err.message || "Unable to fetch review state.");
        setAnalysisStatus("Backend unavailable");
        setWorkflowState(WORKFLOW_STATES.ERROR);
        clearPolling();
      }
    };

    pollReview();
    pollRef.current = window.setInterval(pollReview, 2000);

    return () => clearPolling();
  }, [reviewId]);

  // ---------------------------------------------------------------------------
  // Helpers to update a single finding in state
  // ---------------------------------------------------------------------------

  const patchFinding = (id, patch) => {
    setFindings((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
    setSelectedFinding((cur) => (cur?.id === id ? { ...cur, ...patch } : cur));
  };

  // ---------------------------------------------------------------------------
  // Workflow actions
  // ---------------------------------------------------------------------------

  /** POST /api/reviews — starts the scan and enters the detecting state */
  const analyzeRepository = async () => {
    clearPolling();
    setError("");
    setUsingDemoData(false);
    setFindings([]);
    setSelectedFinding(null);
    setAgentStatuses({ code: "Running", dependency: "Running", context: "Running" });
    setAnalysisStatus("Analysis running");
    setWorkflowState(WORKFLOW_STATES.DETECTING);

    try {
      const reviewResponse = await fetchJson(`${API_BASE}/api/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repository: "demo-app" }),
      });

      const nextReviewId = reviewResponse?.reviewId || reviewResponse?.id;
      if (!nextReviewId) throw new Error("The backend did not return a review ID.");

      setReviewId(nextReviewId);
      // Polling effect will take over from here
    } catch (err) {
      setError(err.message || "Repository analysis could not be started.");
      setAnalysisStatus("Backend unavailable — showing demo data");
      setAgentStatuses(initialAgentStatuses);
      // ⚠️ DEMO DATA FALLBACK — shown only because the backend is unreachable
      setFindings(DEMO_FALLBACK_FINDINGS.map((f) => normalizeFinding(f, 0)));
      setSelectedFinding(DEMO_FALLBACK_FINDINGS[0] ? normalizeFinding(DEMO_FALLBACK_FINDINGS[0], 0) : null);
      setUsingDemoData(true);
      setWorkflowState(WORKFLOW_STATES.ANALYSIS_COMPLETE);
      clearPolling();
    }
  };

  /**
   * POST /api/findings/:findingId/remediation
   * Called when user clicks "Understand with Bob".
   * Only allowed from analysisComplete state.
   */
  const proposeFix = async (finding) => {
    if (!finding) return;
    if (
      workflowState !== WORKFLOW_STATES.ANALYSIS_COMPLETE &&
      workflowState !== WORKFLOW_STATES.NOT_VERIFIED
    ) return;

    setWorkflowState(WORKFLOW_STATES.UNDERSTANDING);
    setError("");

    try {
      const payload = await fetchJson(
        `${API_BASE}/api/findings/${encodeURIComponent(finding.id)}/remediation`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reviewId }),
        }
      );

      const remediationState = {
        explanation: payload?.explanation || payload?.description || "",
        proposedFix: payload?.proposedFix || payload?.fix || payload?.proposal || "",
        diff: payload?.diff || "",
        status: payload?.status || "proposed",
      };

      patchFinding(finding.id, { _remediationState: remediationState, _status: "Needs review" });
      setWorkflowState(WORKFLOW_STATES.REMEDIATION_PROPOSED);
      setAnalysisStatus("Remediation proposal ready");
    } catch (err) {
      setError(err.message || "The remediation endpoint is unavailable.");
      setWorkflowState(WORKFLOW_STATES.ANALYSIS_COMPLETE);
    }
  };

  /**
   * Transition to awaiting approval — user has reviewed the proposal.
   * No API call needed here; approval is the next step.
   */
  const proceedToApproval = () => {
    if (workflowState !== WORKFLOW_STATES.REMEDIATION_PROPOSED) return;
    setWorkflowState(WORKFLOW_STATES.AWAITING_APPROVAL);
    setAnalysisStatus("Awaiting human approval");
  };

  /**
   * POST /api/findings/:findingId/approve
   * Only allowed from awaitingApproval state.
   */
  const approveFinding = async (finding, approved) => {
    if (!finding) return;
    if (workflowState !== WORKFLOW_STATES.AWAITING_APPROVAL) return;

    setError("");

    try {
      await fetchJson(
        `${API_BASE}/api/findings/${encodeURIComponent(finding.id)}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approved, reviewId }),
        }
      );

      patchFinding(finding.id, {
        _approvalStatus: approved ? "approved" : "rejected",
        _status: approved ? "Approved" : "Rejected",
      });

      if (approved) {
        setWorkflowState(WORKFLOW_STATES.APPROVED);
        setAnalysisStatus("Fix approved — ready to apply");
      } else {
        setWorkflowState(WORKFLOW_STATES.REJECTED);
        setAnalysisStatus("Fix rejected");
      }
    } catch (err) {
      setError(err.message || "Approval could not be recorded.");
    }
  };

  /**
   * POST /api/findings/:findingId/apply
   * Only allowed from approved state.
   */
  const applyFix = async (finding) => {
    if (!finding) return;
    if (workflowState !== WORKFLOW_STATES.APPROVED) return;

    setError("");
    setWorkflowState(WORKFLOW_STATES.APPLYING);
    setAnalysisStatus("Applying fix…");

    try {
      await fetchJson(
        `${API_BASE}/api/findings/${encodeURIComponent(finding.id)}/apply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reviewId }),
        }
      );

      patchFinding(finding.id, { _applyStatus: "applied", _status: "Applied" });
      setWorkflowState(WORKFLOW_STATES.APPLIED);
      setAnalysisStatus("Fix applied — ready to validate");
    } catch (err) {
      setError(err.message || "Apply endpoint is unavailable.");
      setWorkflowState(WORKFLOW_STATES.APPROVED);
      setAnalysisStatus("Apply failed");
    }
  };

  /**
   * POST /api/findings/:findingId/validate
   * Covers: test → re-scan → verify.
   * Only allowed after fix has been applied.
   */
  const runValidation = async (finding) => {
    if (!finding) return;
    if (workflowState !== WORKFLOW_STATES.APPLIED) return;

    setError("");
    setWorkflowState(WORKFLOW_STATES.VALIDATING);
    setAnalysisStatus("Running tests and security re-scan…");

    try {
      const payload = await fetchJson(
        `${API_BASE}/api/findings/${encodeURIComponent(finding.id)}/validate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reviewId }),
        }
      );

      const validationResult = {
        tests: payload?.tests || payload?.testResults || null,
        rescan: payload?.rescan || payload?.securityRescan || payload?.scanResult || null,
        verified: payload?.verified ?? false,
        message: payload?.message || payload?.status || "",
        raw: payload,
      };

      patchFinding(finding.id, { _validationResult: validationResult });

      const isVerified =
        validationResult.verified ||
        String(payload?.status || payload?.result || "").toUpperCase().includes("VERIFIED");

      setWorkflowState(isVerified ? WORKFLOW_STATES.VERIFIED : WORKFLOW_STATES.NOT_VERIFIED);
      setAnalysisStatus(isVerified ? "Fix verified ✓" : "Verification failed");
    } catch (err) {
      setError(err.message || "Validation endpoint is unavailable.");
      setWorkflowState(WORKFLOW_STATES.NOT_VERIFIED);
      setAnalysisStatus("Validation failed");
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const displayFindings = findings.length > 0 ? findings : [];

  return (
    <div className="app-shell">
      <Header />
      <main className="dashboard">
        <section className="intro-row">
          <div>
            <p className="section-kicker">Developer security workspace</p>
            <h1>Security Review</h1>
            <p className="intro-copy">Trace risk from repository signal to verified fix.</p>
          </div>
          <div className="review-id">
            <span>Review</span>
            <strong>{reviewId || "—"}</strong>
          </div>
        </section>

        <RepositoryCard status={analysisStatus} onAnalyze={analyzeRepository} />
        <WorkflowStepper workflowState={workflowState} />
        <AgentActivity statuses={agentStatuses} />

        {error && <div className="status-banner error-banner">{error}</div>}
        {loading && <div className="status-banner">Working…</div>}

        {/* ⚠️ DEMO DATA NOTICE — backend was unreachable, displaying local demo findings */}
        {usingDemoData && (
          <div className="status-banner demo-banner">
            ⚠ DEMO DATA — backend unreachable. Findings shown are local demo fixtures, not real scan results.
          </div>
        )}

        <section className="findings-layout">
          <FindingsList
            findings={displayFindings}
            selectedFinding={selectedFinding || displayFindings[0] || null}
            onSelect={setSelectedFinding}
          />
          <FindingDetails
            finding={selectedFinding || displayFindings[0] || null}
            loading={loading}
            workflowState={workflowState}
            onProposeFix={() => proposeFix(selectedFinding || displayFindings[0])}
            onProceedToApproval={proceedToApproval}
            onApproveFix={() => approveFinding(selectedFinding || displayFindings[0], true)}
            onRejectFix={() => approveFinding(selectedFinding || displayFindings[0], false)}
            onApplyFix={() => applyFix(selectedFinding || displayFindings[0])}
            onRunValidation={() => runValidation(selectedFinding || displayFindings[0])}
          />
        </section>
      </main>
    </div>
  );
}
