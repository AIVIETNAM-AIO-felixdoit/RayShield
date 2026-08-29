import { useEffect, useRef, useState } from "react";
import Header from "./components/Header.jsx";
import WorkflowStepper from "./components/WorkflowStepper.jsx";
import RepositoryCard from "./components/RepositoryCard.jsx";
import AgentActivity from "./components/AgentActivity.jsx";
import FindingsList from "./components/FindingsList.jsx";
import FindingDetails from "./components/FindingDetails.jsx";
import { demoFindings } from "./data/demoFindings.js";

const initialAgentStatuses = { code: "Ready", dependency: "Ready", context: "Ready" };
const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:3001").replace(/\/$/, "");

const fallbackFindings = demoFindings.map((finding, index) => ({
  id: finding.id || `fallback-${index}`,
  severity: finding.severity || "High",
  name: finding.name || "Security Finding",
  file: finding.file || "demo-app/src/unknown.js",
  line: finding.line || 1,
  description: finding.description || "No description available.",
  status: finding.status || "Open",
  impact: finding.impact || "Impact details unavailable.",
  action: finding.action || "Review this issue.",
  code: finding.code || "// No code snippet available.",
  remediation: "",
}));

const normalizeSeverity = (value) => {
  const text = String(value ?? "Medium").trim();
  if (!text) return "Medium";
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const normalizeFinding = (finding, index) => ({
  id: finding?.findingId || finding?.id || `finding-${index}`,
  severity: normalizeSeverity(finding?.severity || finding?.level || "Medium"),
  name: finding?.name || finding?.title || `Finding ${index + 1}`,
  file: finding?.file || finding?.path || finding?.location || "unknown-file",
  line: finding?.line ?? finding?.startLine ?? 1,
  description: finding?.description || finding?.summary || "No description available.",
  status: finding?.status || "Open",
  impact: finding?.impact || "Impact details unavailable.",
  action: finding?.action || "Review the recommended remediation.",
  code: finding?.code || finding?.snippet || "// No code snippet available.",
  remediation: finding?.remediation || finding?.diff || finding?.proposal || "",
  approved: Boolean(finding?.approved),
});

const normalizeAgentStatuses = (value = {}) => ({
  code: value.code || value.codeAgent || value["Code Agent"] || "Ready",
  dependency: value.dependency || value.dependencyAgent || value["Dependency Agent"] || "Ready",
  context: value.context || value.contextAgent || value["Context Agent"] || "Ready",
});

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
      if (payload?.message) {
        message = payload.message;
      } else if (payload?.error) {
        message = payload.error;
      }
    } catch {
      // ignore parse errors and keep the fallback text
    }
    throw new Error(message);
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  return null;
}

export default function App() {
  const [currentWorkflowStage, setCurrentWorkflowStage] = useState("Detect");
  const [selectedFinding, setSelectedFinding] = useState(null);
  const [analysisStatus, setAnalysisStatus] = useState("Ready to analyze");
  const [agentStatuses, setAgentStatuses] = useState(initialAgentStatuses);
  const [findings, setFindings] = useState([]);
  const [reviewId, setReviewId] = useState(null);
  const [validationState, setValidationState] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const pollRef = useRef(null);

  const clearPolling = () => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => {
    return () => clearPolling();
  }, []);

  useEffect(() => {
    if (!selectedFinding && findings.length > 0) {
      setSelectedFinding(findings[0]);
    }
  }, [selectedFinding, findings]);

  useEffect(() => {
    if (!reviewId) return undefined;

    clearPolling();
    setLoading(true);
    setError("");

    const pollReview = async () => {
      try {
        const reviewState = await fetchJson(`${API_BASE}/api/reviews/${encodeURIComponent(reviewId)}`);
        const status = String(reviewState?.status || "queued").toLowerCase();

        if (reviewState?.agentStatuses || reviewState?.agents) {
          setAgentStatuses(normalizeAgentStatuses(reviewState.agentStatuses || reviewState.agents));
        }

        const mappedFindings = Array.isArray(reviewState?.findings)
          ? reviewState.findings.map(normalizeFinding)
          : [];

        if (mappedFindings.length > 0) {
          setFindings(mappedFindings);
          setSelectedFinding((current) => {
            if (current && mappedFindings.some((finding) => finding.id === current.id)) {
              return current;
            }
            return mappedFindings[0];
          });
        }

        if (status.includes("complete") || status.includes("verified") || status === "done") {
          setAnalysisStatus("Analysis complete");
          setCurrentWorkflowStage("Understand");
          setLoading(false);
          clearPolling();
          return;
        }

        if (status.includes("queued") || status.includes("running") || status.includes("processing") || status.includes("scan")) {
          setAnalysisStatus("Analysis running");
          setCurrentWorkflowStage("Detect");
          setLoading(true);
          return;
        }

        if (status.includes("error") || status.includes("not found")) {
          setError("Review not found or the backend returned an error.");
          setAnalysisStatus("Review unavailable");
          setLoading(false);
          clearPolling();
        }
      } catch (err) {
        setError(err.message || "Unable to fetch review state.");
        setAnalysisStatus("Backend unavailable");
        setLoading(false);
        clearPolling();
      }
    };

    pollReview();
    pollRef.current = window.setInterval(pollReview, 900);

    return () => clearPolling();
  }, [reviewId]);

  const applyReviewState = (reviewState) => {
    const mappedFindings = Array.isArray(reviewState?.findings)
      ? reviewState.findings.map(normalizeFinding)
      : [];

    setFindings(mappedFindings);
    setSelectedFinding(mappedFindings[0] || null);
    if (reviewState?.agentStatuses || reviewState?.agents) {
      setAgentStatuses(normalizeAgentStatuses(reviewState.agentStatuses || reviewState.agents));
    }

    const status = String(reviewState?.status || "queued").toLowerCase();
    if (status.includes("complete") || status.includes("verified") || status === "done") {
      setAnalysisStatus("Analysis complete");
      setCurrentWorkflowStage("Understand");
    } else if (status.includes("queued") || status.includes("running") || status.includes("processing") || status.includes("scan")) {
      setAnalysisStatus("Analysis running");
      setCurrentWorkflowStage("Detect");
    }
  };

  const analyzeRepository = async () => {
    clearPolling();
    setLoading(true);
    setError("");
    setValidationState("");
    setAnalysisStatus("Analysis running");
    setCurrentWorkflowStage("Detect");
    setAgentStatuses({ code: "Running", dependency: "Running", context: "Running" });

    try {
      const reviewResponse = await fetchJson(`${API_BASE}/api/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repository: "demo-app" }),
      });

      const nextReviewId = reviewResponse?.reviewId || reviewResponse?.id;
      if (!nextReviewId) {
        throw new Error("The backend did not return a review ID.");
      }

      setReviewId(nextReviewId);
      applyReviewState(reviewResponse);
    } catch (err) {
      setError(err.message || "Repository analysis could not be started.");
      setAnalysisStatus("Backend unavailable");
      setAgentStatuses(initialAgentStatuses);
      setFindings(fallbackFindings);
      setSelectedFinding(fallbackFindings[0] || null);
      setLoading(false);
      clearPolling();
    }
  };

  const proposeFix = async (finding) => {
    if (!finding) return;

    setLoading(true);
    setError("");

    try {
      const payload = await fetchJson(`${API_BASE}/api/findings/${encodeURIComponent(finding.id)}/remediation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId, action: "propose_fix" }),
      });

      const proposal = payload?.proposal || payload?.diff || payload?.remediation || payload?.content || "No remediation was returned by the backend.";
      const updatedFindings = findings.map((item) => (item.id === finding.id ? { ...item, remediation: proposal, status: "Needs review" } : item));
      setFindings(updatedFindings);
      setSelectedFinding({ ...finding, remediation: proposal, status: "Needs review" });
      setCurrentWorkflowStage("Fix");
      setAnalysisStatus("Remediation proposal ready");
    } catch (err) {
      setError(err.message || "The remediation endpoint is unavailable.");
    } finally {
      setLoading(false);
    }
  };

  const approveFinding = async (finding, approved) => {
    if (!finding) return;

    setLoading(true);
    setError("");

    try {
      await fetchJson(`${API_BASE}/api/findings/${encodeURIComponent(finding.id)}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved, reviewId }),
      });

      const updatedFindings = findings.map((item) =>
        item.id === finding.id
          ? { ...item, approved, status: approved ? "Approved" : "Rejected" }
          : item,
      );
      setFindings(updatedFindings);
      setSelectedFinding({ ...finding, approved, status: approved ? "Approved" : "Rejected" });
      setAnalysisStatus(approved ? "Human approval recorded" : "Fix rejected");
      setCurrentWorkflowStage(approved ? "Fix" : "Fix");
    } catch (err) {
      setError(err.message || "Approval could not be recorded.");
    } finally {
      setLoading(false);
    }
  };

  const runValidation = async (action = "apply") => {
    const currentFinding = selectedFinding || findings[0];
    if (!currentFinding) return;

    setLoading(true);
    setError("");

    try {
      const payload = await fetchJson(`${API_BASE}/api/findings/${encodeURIComponent(currentFinding.id)}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reviewId, approved: currentFinding.approved || false }),
      });

      const backendStatus = payload?.status || payload?.result || payload?.message || "NOT VERIFIED";
      const outcome = String(backendStatus).toUpperCase().includes("VERIFIED") ? "FIX VERIFIED" : "NOT VERIFIED";
      setValidationState(outcome);
      setAnalysisStatus(outcome === "FIX VERIFIED" ? "Validation passed" : "Validation failed");
      setCurrentWorkflowStage(outcome === "FIX VERIFIED" ? "Verify" : "Test");
    } catch (err) {
      setError(err.message || "Validation endpoint is unavailable.");
      setValidationState("NOT VERIFIED");
      setCurrentWorkflowStage("Test");
    } finally {
      setLoading(false);
    }
  };

  const displayFindings = findings.length > 0 ? findings : fallbackFindings;

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
          <div className="review-id"><span>Review</span><strong>{reviewId || "RS-2048"}</strong></div>
        </section>

        <RepositoryCard status={analysisStatus} onAnalyze={analyzeRepository} />
        <WorkflowStepper currentStage={currentWorkflowStage} />
        <AgentActivity statuses={agentStatuses} />

        {error && <div className="status-banner error-banner">{error}</div>}
        {loading && <div className="status-banner">Loading…</div>}

        <section className="findings-layout">
          <FindingsList
            findings={displayFindings}
            selectedFinding={selectedFinding || displayFindings[0] || null}
            onSelect={setSelectedFinding}
          />
          <FindingDetails
            finding={selectedFinding || displayFindings[0] || null}
            loading={loading}
            validationState={validationState}
            onProposeFix={proposeFix}
            onApproveFix={(approved) => approveFinding(selectedFinding || displayFindings[0], approved)}
            onRejectFix={(approved) => approveFinding(selectedFinding || displayFindings[0], approved)}
            onRunValidation={runValidation}
          />
        </section>
      </main>
    </div>
  );
}
