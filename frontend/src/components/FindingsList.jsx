import FindingCard from "./FindingCard.jsx";

export default function FindingsList({ findings, selectedFinding, onSelect }) {
  return <section className="findings-panel"><div className="section-heading"><div><p className="section-kicker">Detected risk</p><h2>Security Findings</h2></div><span className="finding-total">{findings.length} findings</span></div><div className="finding-list">{findings.map((finding) => <FindingCard key={finding.id} finding={finding} selected={selectedFinding?.id === finding.id} onSelect={() => onSelect(finding)} />)}</div></section>;
}