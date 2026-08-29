import AgentCard from "./AgentCard.jsx";

export default function AgentActivity({ statuses }) {
  return <section className="agent-section"><div className="section-heading"><div><p className="section-kicker">Parallel analysis</p><h2>AI Security Analysis</h2></div><span className="live-indicator"><span /> local preview</span></div><div className="agents-grid"><AgentCard type="code" status={statuses.code} /><AgentCard type="dependency" status={statuses.dependency} /><AgentCard type="context" status={statuses.context} /></div></section>;
}