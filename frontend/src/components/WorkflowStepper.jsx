const stages = ["Detect", "Understand", "Fix", "Test", "Verify"];

export default function WorkflowStepper({ currentStage }) {
  const currentIndex = stages.indexOf(currentStage);
  return <section className="workflow panel"><div className="section-heading"><div><p className="section-kicker">Review lifecycle</p><h2>Workflow progress</h2></div><span className="workflow-count">{String(Math.max(currentIndex + 1, 1)).padStart(2, "0")} / 05</span></div><ol className="stepper">{stages.map((stage, index) => { const state = index < currentIndex ? "completed" : index === currentIndex ? "active" : "upcoming"; return <li className={`step ${state}`} key={stage}><span className="step-number">{String(index + 1).padStart(2, "0")}</span><span className="step-label">{stage}</span>{index < stages.length - 1 && <span className="step-line" />}</li>; })}</ol></section>;
}