import FindingCard from "./FindingCard.jsx";

/**
 * Groups findings by vulnerability type (finding.rule or finding._name),
 * then renders each group under a labelled header while preserving every
 * individual finding card and its selection behaviour.
 *
 * Real backend findings use `rule`; demo fallback findings use `_name`.
 */
function groupFindings(findings) {
  const groups = new Map();
  for (const finding of findings) {
    const key = finding.rule || finding._name || "Other";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(finding);
  }
  return groups;
}

export default function FindingsList({ findings, selectedFinding, onSelect }) {
  const groups = groupFindings(findings);
  const groupEntries = Array.from(groups.entries());
  const showGroups = groupEntries.length > 0 && findings.length > 1;

  return (
    <section className="findings-panel">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Detected risk</p>
          <h2>Security Findings</h2>
        </div>
        <span className="finding-total">{findings.length} finding{findings.length !== 1 ? "s" : ""}</span>
      </div>

      {showGroups ? (
        <div className="finding-list">
          {groupEntries.map(([groupName, groupFindings]) => (
            <div key={groupName} className="finding-group">
              <div className="finding-group-header">
                <span className="finding-group-name">{groupName}</span>
                <span className="finding-group-count">{groupFindings.length}</span>
              </div>
              {groupFindings.map((finding) => (
                <FindingCard
                  key={finding.id}
                  finding={finding}
                  selected={selectedFinding?.id === finding.id}
                  onSelect={() => onSelect(finding)}
                />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="finding-list">
          {findings.map((finding) => (
            <FindingCard
              key={finding.id}
              finding={finding}
              selected={selectedFinding?.id === finding.id}
              onSelect={() => onSelect(finding)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
