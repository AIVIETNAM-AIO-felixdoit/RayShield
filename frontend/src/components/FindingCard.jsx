/**
 * FindingCard — list item for a normalised finding.
 * Real backend findings have: id, rule, severity, file, line, description
 * Demo findings also have: _name, _status, _demo
 */
export default function FindingCard({ finding, selected, onSelect }) {
  const displayName = finding._name || finding.rule || finding.id;
  const displayStatus = finding._status || "Open";

  return (
    <button
      className={`finding-card ${selected ? "selected" : ""}`}
      onClick={onSelect}
    >
      <div className="finding-card-top">
        <span className={`severity severity-${String(finding.severity).toLowerCase()}`}>
          {finding.severity}
        </span>
        <span className="finding-status">{displayStatus}</span>
      </div>
      <h3>{displayName}</h3>
      <p className="finding-location">
        {finding.file}<span>:{finding.line}</span>
      </p>
      <p className="finding-description">{finding.description}</p>
      <span className="view-details">View details <span>↗</span></span>
    </button>
  );
}
