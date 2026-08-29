import { useState } from "react";
import Header from "./components/Header.jsx";
import WorkflowStepper from "./components/WorkflowStepper.jsx";
import RepositoryCard from "./components/RepositoryCard.jsx";
import AgentActivity from "./components/AgentActivity.jsx";
import FindingsList from "./components/FindingsList.jsx";
import FindingDetails from "./components/FindingDetails.jsx";
import { demoFindings } from "./data/demoFindings.js";

const initialAgentStatuses = { code: "Ready", dependency: "Ready", context: "Ready" };

export default function App() {
  const [currentWorkflowStage, setCurrentWorkflowStage] = useState("Detect");
  const [selectedFinding, setSelectedFinding] = useState(demoFindings[0]);
  const [analysisStatus, setAnalysisStatus] = useState("Ready to analyze");
  const [agentStatuses, setAgentStatuses] = useState(initialAgentStatuses);

  const analyzeRepository = () => {
    setAnalysisStatus("Analysis running");
    setCurrentWorkflowStage("Detect");
    setAgentStatuses({ code: "Running", dependency: "Running", context: "Running" });
    window.setTimeout(() => {
      setAnalysisStatus("Analysis complete");
      setAgentStatuses({ code: "Complete", dependency: "Complete", context: "Complete" });
      setCurrentWorkflowStage("Understand");
    }, 900);
  };

  return (
    <div className="app-shell">
      <Header />
      <main className="dashboard">
        <section className="intro-row"><div><p className="section-kicker">Developer security workspace</p><h1>Security Review</h1><p className="intro-copy">Trace risk from repository signal to verified fix.</p></div><div className="review-id"><span>Review</span><strong>RS-2048</strong></div></section>
        <RepositoryCard status={analysisStatus} onAnalyze={analyzeRepository} />
        <WorkflowStepper currentStage={currentWorkflowStage} />
        <AgentActivity statuses={agentStatuses} />
        <section className="findings-layout"><FindingsList findings={demoFindings} selectedFinding={selectedFinding} onSelect={setSelectedFinding} /><FindingDetails finding={selectedFinding} /></section>
      </main>
    </div>
  );
}
