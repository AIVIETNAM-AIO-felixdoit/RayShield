/**
 * FindingDetails — displays a single finding with state-gated workflow actions.
 *
 * Button availability enforces the sequential workflow:
 *   "Understand with Bob"   → only when analysisComplete or notVerified
 *   "Review & Approve"      → only when remediationProposed
 *   "Approve" / "Reject"    → only when awaitingApproval
 *   "Apply Fix"             → only when approved
 *   "Test & Security Re-scan" → only when applied
 *
 * Props:
 *   finding             – normalised finding object (see App.jsx normalizeFinding)
 *   workflowState       – current WORKFLOW_STATES value
 *   loading             – boolean (derived from workflow state in App)
 *   onProposeFix        – () => void
 *   onProceedToApproval – () => void
 *   onApproveFix        – () => void
 *   onRejectFix         – () => void
 *   onApplyFix          – () => void
 *   onRunValidation     – () => void
 */
export default function FindingDetails({
  finding,
  workflowState,
  loading,
  onProposeFix,
  onProceedToApproval,
  onApproveFix,
  onRejectFix,
  onApplyFix,
  onRunValidation,
}) {
  if (!finding) {
    return (
      <aside className="details-panel panel">
        Select a finding to inspect it.
      </aside>
    );
  }

  const ws = workflowState || "idle";

  // Derive display name — demo findings use _name, real findings use rule
  const displayName = finding._name || finding.rule || finding.id;
  const displayStatus = finding._status || "Open";
  const displayImpact = finding._impact || "";
  const displayAction = finding._action || "";
  const displayCode = finding._code || "";
  const isDemo = finding._demo === true;

  // Remediation from the backend (set after "Understand with Bob")
  const rem = finding._remediationState;

  // Validation result (set after Apply & Validate)
  const val = finding._validationResult;

  // Determine the outcome label
  let verificationLabel = null;
  if (ws === "verified") verificationLabel = "FIX VERIFIED";
  else if (ws === "notVerified") verificationLabel = "NOT VERIFIED";
  else if (val) {
    verificationLabel = val.verified ? "FIX VERIFIED" : "NOT VERIFIED";
  }

  return (
    <aside className="details-panel panel">
      {/* ── Header ── */}
      <div className="details-header">
        <div>
          <p className="section-kicker">Finding detail{isDemo ? " · DEMO" : ""}</p>
          <h2>{displayName}</h2>
        </div>
        <span className={`severity severity-${String(finding.severity).toLowerCase()}`}>
          {finding.severity}
        </span>
      </div>

      {/* ── Metadata ── */}
      <dl className="finding-meta">
        <div>
          <dt>File</dt>
          <dd>{finding.file}</dd>
        </div>
        <div>
          <dt>Line</dt>
          <dd>{finding.line}</dd>
        </div>
        <div>
          <dt>Rule</dt>
          <dd>{finding.rule}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd><span className="mini-dot" /> {displayStatus}</dd>
        </div>
      </dl>

      {/* ── Description ── */}
      <div className="detail-copy">
        <div>
          <h3>Description</h3>
          <p>{finding.description}</p>
        </div>
        {displayImpact && (
          <div>
            <h3>Potential impact</h3>
            <p>{displayImpact}</p>
          </div>
        )}
        {displayAction && (
          <div>
            <h3>Recommended action</h3>
            <p>{displayAction}</p>
          </div>
        )}
      </div>

      {/* ── Vulnerable code (demo or real snippet) ── */}
      {displayCode && (
        <div className="code-block">
          <div className="code-header">
            <span>Code snippet</span>
            <span>{finding.file?.split(".").pop()?.toUpperCase() || "CODE"}</span>
          </div>
          <pre><code>
            <span className="line-number">{finding.line}</span>{displayCode}
          </code></pre>
        </div>
      )}

      {/* ── Remediation proposal (visible after "Understand with Bob") ── */}
      {rem && (
        <div className="remediation-box">
          {rem.explanation && (
            <>
              <h3>Explanation</h3>
              <p className="remediation-text">{rem.explanation}</p>
            </>
          )}
          {rem.proposedFix && (
            <>
              <h3>Proposed fix</h3>
              <p className="remediation-text">{rem.proposedFix}</p>
            </>
          )}
          {rem.diff && (
            <>
              <h3>Diff</h3>
              <pre className="remediation-diff">{rem.diff}</pre>
            </>
          )}
          {rem.status && (
            <p className="remediation-status">Status: {rem.status}</p>
          )}
        </div>
      )}

      {/* ── Validation results (visible after Apply & Validate) ── */}
      {val && (
        <div className="remediation-box validation-results">
          <h3>Validation results</h3>
          {val.tests && (
            <div className="val-section">
              <p className="val-label">Test results</p>
              <pre className="remediation-diff">
                {typeof val.tests === "string" ? val.tests : JSON.stringify(val.tests, null, 2)}
              </pre>
            </div>
          )}
          {val.rescan && (
            <div className="val-section">
              <p className="val-label">Security re-scan</p>
              <pre className="remediation-diff">
                {typeof val.rescan === "string" ? val.rescan : JSON.stringify(val.rescan, null, 2)}
              </pre>
            </div>
          )}
          {val.message && (
            <p className="remediation-status">{val.message}</p>
          )}
        </div>
      )}

      {/* ── Workflow actions (state-gated) ── */}
      <div className="detail-actions">
        {/* Step 1 — Understand: only available from analysisComplete or notVerified */}
        {(ws === "analysisComplete" || ws === "notVerified") && (
          <button
            className="secondary-button"
            onClick={onProposeFix}
            disabled={loading}
          >
            {loading ? "Contacting Bob…" : "Understand with Bob"}
          </button>
        )}

        {/* Step 2 — Review proposal: advance to approval gate */}
        {ws === "remediationProposed" && (
          <div className="action-row">
            <button
              className="action-button"
              onClick={onProceedToApproval}
              disabled={loading}
            >
              Review &amp; Approve
            </button>
          </div>
        )}

        {/* Step 3 — Human approval gate */}
        {ws === "awaitingApproval" && (
          <div className="action-row">
            <button
              className="action-button approve"
              onClick={onApproveFix}
              disabled={loading}
            >
              ✓ Approve
            </button>
            <button
              className="action-button reject"
              onClick={onRejectFix}
              disabled={loading}
            >
              ✗ Reject
            </button>
          </div>
        )}

        {/* Rejected state — allow re-proposing */}
        {ws === "rejected" && (
          <p className="workflow-gate-notice">Fix rejected. Select another finding or start over.</p>
        )}

        {/* Step 4 — Apply fix: only available after approval */}
        {ws === "approved" && (
          <button
            className="secondary-button"
            onClick={onApplyFix}
            disabled={loading}
          >
            {loading ? "Applying…" : "Apply Fix"}
          </button>
        )}

        {/* Step 5 — Validate: only available after fix has been applied */}
        {ws === "applied" && (
          <button
            className="secondary-button"
            onClick={onRunValidation}
            disabled={loading}
          >
            Test &amp; Security Re-scan
          </button>
        )}

        {/* Loading indicators for intermediate states */}
        {ws === "understanding" && (
          <p className="workflow-gate-notice">Bob is analysing the finding…</p>
        )}
        {ws === "applying" && (
          <p className="workflow-gate-notice">Applying fix…</p>
        )}
        {(ws === "validating" || ws === "rescanning") && (
          <p className="workflow-gate-notice">Running tests and security re-scan…</p>
        )}

        {/* States where no action is needed */}
        {ws === "detecting" && (
          <p className="workflow-gate-notice">Scan in progress — waiting for findings…</p>
        )}
        {ws === "idle" && (
          <p className="workflow-gate-notice">Run "Analyze Repository" to begin.</p>
        )}
        {ws === "error" && (
          <p className="workflow-gate-notice">An error occurred. Re-run the analysis to try again.</p>
        )}
      </div>

      {/* ── Verification banner ── */}
      {verificationLabel && (
        <div
          className={`validation-banner ${verificationLabel === "FIX VERIFIED" ? "verified" : "not-verified"}`}
        >
          {verificationLabel}
        </div>
      )}
    </aside>
  );
}
