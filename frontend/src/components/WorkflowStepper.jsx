/**
 * WorkflowStepper — maps the App workflow state machine to the 5-stage visual stepper.
 *
 * Workflow state → visual stage mapping:
 *   idle                → Detect (step 0, upcoming)
 *   detecting           → Detect (active)
 *   analysisComplete    → Understand (active)
 *   understanding       → Understand (active)
 *   remediationProposed → Fix (active)
 *   awaitingApproval    → Fix (active)
 *   approved            → Fix (completed) / Apply (active)
 *   rejected            → Fix (active)
 *   applying            → Apply (active)
 *   validating          → Test (active)
 *   rescanning          → Test (active)
 *   verified            → Verify (completed)
 *   notVerified         → Verify (active, failed)
 *   error               → current stage (error styling)
 */

const STAGES = ["Detect", "Understand", "Fix", "Apply", "Test", "Verify"];

/** Returns the index of the active stage for a given workflow state. */
const stageIndexFor = (workflowState) => {
  switch (workflowState) {
    case "idle":
      return 0;
    case "detecting":
      return 0;
    case "analysisComplete":
      return 1;
    case "understanding":
      return 1;
    case "remediationProposed":
      return 2;
    case "awaitingApproval":
      return 2;
    case "approved":
      return 3;
    case "rejected":
      return 2;
    case "applying":
      return 3;
    case "applied":
      return 3;
    case "validating":
      return 4;
    case "rescanning":
      return 4;
    case "verified":
      return 5;
    case "notVerified":
      return 5;
    case "error":
      return 0;
    default:
      return 0;
  }
};

export default function WorkflowStepper({ workflowState }) {
  const currentIndex = stageIndexFor(workflowState);
  const isError = workflowState === "error";
  const isNotVerified = workflowState === "notVerified";

  return (
    <section className="workflow panel">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Review lifecycle</p>
          <h2>Workflow progress</h2>
        </div>
        <span className="workflow-count">
          {String(Math.min(currentIndex + 1, STAGES.length)).padStart(2, "0")} / {String(STAGES.length).padStart(2, "0")}
        </span>
      </div>
      <ol className="stepper">
        {STAGES.map((stage, index) => {
          let state;
          if (index < currentIndex) {
            state = "completed";
          } else if (index === currentIndex) {
            state = isError ? "error" : isNotVerified && index === STAGES.length - 1 ? "not-verified" : "active";
          } else {
            state = "upcoming";
          }

          return (
            <li className={`step ${state}`} key={stage}>
              <span className="step-number">{String(index + 1).padStart(2, "0")}</span>
              <span className="step-label">{stage}</span>
              {index < STAGES.length - 1 && <span className="step-line" />}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
