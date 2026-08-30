const agentMeta = { code: { name: "Code Agent", description: "Analyzes application source code", mark: "</>" }, dependency: { name: "Dependency Agent", description: "Analyzes dependencies and package risks", mark: "<>" }, context: { name: "Context Agent", description: "Understands repository documentation and context", mark: "◫" } };

export default function AgentCard({ type, status }) {
  const agent = agentMeta[type];
  const statusStr = status || "Ready";
  const statusClass = statusStr.toLowerCase().replace(/\s+/g, "-");
  return <article className={`agent-card ${statusClass}`}><div className="agent-top"><span className="agent-mark">{agent.mark}</span><span className="agent-status"><span className="mini-dot" />{statusStr}</span></div><h3>{agent.name}</h3><p>{agent.description}</p><div className="agent-scan"><span className="scan-line" /></div></article>;
}