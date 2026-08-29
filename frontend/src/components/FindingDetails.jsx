export default function FindingDetails({
  finding,
  onProposeFix,
  onApproveFix,
  onRejectFix,
  onRunValidation,
  validationState,
  loading,
}) {
  if (!finding) {
    return <aside className="details-panel panel">Select a finding to inspect it.</aside>;
  }

  return (
    <aside className="details-panel panel">
      <div className="details-header">
        <div>
          <p className="section-kicker">Finding detail</p>
          <h2>{finding.name}</h2>
        </div>
        <span className={`severity severity-${String(finding.severity).toLowerCase()}`}>{finding.severity}</span>
      </div>

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
          <dt>Status</dt>
          <dd><span className="mini-dot" /> {finding.status}</dd>
        </div>
      </dl>

      <div className="detail-copy">
        <div>
          <h3>Why it matters</h3>
          <p>{finding.description}</p>
        </div>
        <div>
          <h3>Potential impact</h3>
          <p>{finding.impact}</p>
        </div>
        <div>
          <h3>Recommended action</h3>
          <p>{finding.action}</p>
        </div>
      </div>

      <div className="code-block">
        <div className="code-header">
          <span>Vulnerable code</span>
          <span>JS</span>
        </div>
        <pre><code><span className="line-number">{finding.line}</span>{finding.code}</code></pre>
      </div>

      {finding.remediation && (
        <div className="remediation-box">
          <h3>Remediation proposal</h3>
          <pre>{finding.remediation}</pre>
        </div>
      )}

      <div className="detail-actions">
        <button className="secondary-button" onClick={() => onProposeFix?.(finding)} disabled={loading}>
          {loading ? "Working..." : "Understand with Bob"}
        </button>
        <div className="action-row">
          <button className="action-button approve" onClick={() => onApproveFix?.(true)} disabled={loading}>Approve</button>
          <button className="action-button reject" onClick={() => onRejectFix?.(false)} disabled={loading}>Reject</button>
        </div>
        <div className="action-row">
          <button className="action-button" onClick={() => onRunValidation?.("apply")} disabled={loading}>Apply</button>
          <button className="action-button" onClick={() => onRunValidation?.("test")} disabled={loading}>Test</button>
          <button className="action-button" onClick={() => onRunValidation?.("rescan")} disabled={loading}>Re-scan</button>
          <button className="action-button" onClick={() => onRunValidation?.("verify")} disabled={loading}>Verify</button>
        </div>
      </div>

      {validationState && (
        <div className={`validation-banner ${validationState === "FIX VERIFIED" ? "verified" : "not-verified"}`}>
          {validationState}
        </div>
      )}
    </aside>
  );
}
