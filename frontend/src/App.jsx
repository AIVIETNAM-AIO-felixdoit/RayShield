const stages = ["Detect", "Understand", "Fix", "Test", "Verify"];

export default function App() {
  return (
    <main>
      <p className="eyebrow">IBM Bob 2.0 hackathon MVP</p>
      <h1>RayShield AI</h1>
      <p>An agentic security remediation workflow for developers.</p>
      <ol>
        {stages.map((stage) => <li key={stage}>{stage}</li>)}
      </ol>
      <p className="status">UI foundation ready. Connect this screen to the review API next.</p>
    </main>
  );
}
