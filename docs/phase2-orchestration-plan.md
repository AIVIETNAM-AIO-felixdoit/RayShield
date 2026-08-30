# Phase 2 — Agent Orchestration Plan (Revised)
# Repository Analysis → Parallel Agents → Merge → Risk Prioritization → Frontend

## Ownership

| Area | Owner | Phase 2 Scope |
|---|---|---|
| `scanner/` and backend scanner integration | Felix | Phase 1 COMPLETE — do not modify |
| `demo-app/` and vulnerability-related tests | Rabeesa | Do not touch |
| Agent orchestration, context, prioritization, frontend wiring | You | This phase |

**Phase 1 is complete (Felix):**
- `scanner/` detects SQL Injection, XSS, and Hardcoded Secret
- `backend/src/index.js` has `POST /api/reviews` and `GET /api/reviews/:reviewId`
- 30/30 tests pass

**Phase 2 builds on top of Phase 1 without rewriting it.**

---

## What Phase 2 Is — and Is Not

**Phase 2 establishes the DETECT → UNDERSTAND foundation:**

```
DETECT:     Felix's scanner already does this — findings[] with severity, file, line, code
UNDERSTAND: Phase 2 adds agent orchestration, repository context, and risk prioritization
```

**Phase 2 does NOT implement:**
- Remediation proposal (Phase 3)
- Human approval gate (Phase 3)
- Fix application (Phase 3)
- Testing/re-scan/verification (Phase 4/5)

---

## Architectural Distinction (Critical)

This plan enforces a three-layer model:

```
Layer 1 — DETERMINISTIC SCANNER RESULTS (Felix, Phase 1)
  scanner/src/index.js → scanProject() → { findings[] }
  These are pattern-matched findings with known severity/confidence.
  No interpretation. No AI. Factual.

Layer 2 — AGENT-GENERATED ANALYSIS (Phase 2 — your work)
  Code Agent:       wraps the scanner, labels findings by source
  Context Agent:    reads repository docs and package metadata
  Dependency Agent: lightweight supporting metadata (NOT security findings)
  Orchestrated in parallel, merged into a unified analysis record

Layer 3 — RISK PRIORITIZATION (Phase 2 — your work)
  Takes merged findings from Layer 2
  Applies deterministic scoring formula (severity + confidence)
  Returns sorted findings with riskScore visible to the frontend

Layer 4 — AI/LLM REASONING (Phase 3 — future)
  proposeRemediation() in agents/remediation/ receives a prioritized finding
  IBM Granite via Watson SDK generates: explanation, diff, rationale
  This is where IBM Bob AI capability is invoked at runtime
```

A hackathon judge can see exactly where deterministic logic ends and where AI begins.

---

## Phase 1 State — What Felix Built (Do Not Touch)

```
scanner/src/index.js
  → scanProject({ projectPath })
  → returns { projectPath, scannedAt, findings[] }
  → findings include: id, severity, name, file, line, description, impact, action, code, confidence

backend/src/index.js
  → POST /api/reviews  → { reviewId, status, nextStep }  [202]
  → GET  /api/reviews/:reviewId  → ReviewRecord

demo-app/
  → Contains controlled vulnerabilities (Rabeesa's work — do not modify)
  → SQL Injection, XSS, Hardcoded Secret already present and tested

tests/
  → Rabeesa's tests pass (do not modify)
```

---

## Target Architecture (End of Phase 2)

```
Frontend
  analyzeRepository()
    → POST /api/reviews (already implemented by Felix)
    → poll GET /api/reviews/:reviewId at 800ms interval
    → on each poll: update agentStatuses from review.agentStatuses
    → on status:"complete": clear interval, replace findings from review.findings,
       advance workflow stepper to "Understand"

Backend
  POST /api/reviews (Felix — EXISTING, needs one addition)
    existing: creates reviewId, returns 202
    add:      calls orchestrateAnalysis(reviewId, projectPath) without await

  GET /api/reviews/:reviewId (Felix — EXISTING, may need to serve ReviewRecord)
    existing: returns review state
    if Felix's implementation already returns the full ReviewRecord → no change needed
    if it returns a stub → add ReviewRecord read from reviewStore

  orchestrateAnalysis(reviewId, projectPath)  ← NEW: backend/src/orchestrator.js
    updateReview(reviewId, { status:"running", agentStatuses:{ code:"Running", ... } })
    [codeResult, depResult, ctxResult] = await Promise.all([
      codeAgent(projectPath),       ← NEW: backend/src/agents/codeAgent.js
      dependencyAgent(projectPath), ← NEW: backend/src/agents/dependencyAgent.js
      contextAgent(projectPath),    ← NEW: backend/src/agents/contextAgent.js
    ])
    merged   = mergeAnalysis([codeResult, depResult, ctxResult])
    sorted   = prioritize(merged.findings)
    updateReview(reviewId, {
      status:"complete",
      agentStatuses:{ code:"Complete", dependency:"Complete", context:"Complete" },
      findings: sorted,
      contextSummary: merged.contextSummary,
      dependencySummary: merged.dependencySummary,
      completedAt: new Date().toISOString()
    })

  reviewStore  ← NEW: backend/src/reviewStore.js
    Map<reviewId, ReviewRecord>
    Exported: createReview(), getReview(), updateReview()
    NOTE: If Felix's GET /api/reviews/:reviewId already uses an internal store,
    integrate with it rather than creating a parallel one.
```

---

## Files to Create (New — Phase 2)

| File | Owner | Purpose |
|---|---|---|
| `backend/src/reviewStore.js` | You | In-memory Map of ReviewRecord; shared module |
| `backend/src/orchestrator.js` | You | Promise.all coordinator; writes to reviewStore |
| `backend/src/agents/codeAgent.js` | You | Wraps Felix's scanner; labels findings as code-layer |
| `backend/src/agents/dependencyAgent.js` | You | Reads package metadata; produces supporting summary (NOT findings) |
| `backend/src/agents/contextAgent.js` | You | Reads README + architecture docs; builds contextSummary |
| `backend/src/mergeAnalysis.js` | You | Merges code findings with context and dependency metadata |
| `backend/src/prioritize.js` | You | Deterministic riskScore formula; sorts findings |
| `tests/orchestrator.test.js` | You | Node --test integration tests for orchestration path |

## Files to Modify (Existing — Minimal Changes Only)

| File | Owner | Required Change | Justification |
|---|---|---|---|
| `backend/src/index.js` | Felix | Add: `orchestrateAnalysis(reviewId, projectPath)` call (no-await) inside POST handler; import reviewStore and orchestrator | Without this, the orchestrator is never invoked. This is a 2-line addition, not a rewrite. |
| `frontend/src/App.jsx` | You | Replace `window.setTimeout` stub with fetch + polling | Frontend currently has no real API calls; this is the core Phase 2 user-visible change. |

## Files NOT to Touch

| File | Reason |
|---|---|
| `scanner/src/index.js` | Felix's Phase 1 work — complete |
| `scanner/src/rules/*` | Felix's Phase 1 work — complete |
| `demo-app/*` | Rabeesa owns this entirely |
| `tests/*` (existing) | Rabeesa's tests — do not modify |
| `agents/remediation/src/index.js` | Phase 3 boundary — stub intentionally |
| `validator/src/index.js` | Phase 4/5 boundary — stub intentionally |
| All CSS, all frontend components | Phase 1 UI foundation — complete |

---

## Sub-Task 1 — reviewStore

**Intent**: Create a shared in-memory store that the orchestrator writes to and the
GET endpoint reads from. Felix's GET endpoint may already have an internal store;
if so, the implementor must read Felix's `backend/src/index.js` first and import
from the shared store rather than creating a parallel one.

**Expected Outcomes**:
- `backend/src/reviewStore.js` exports `createReview`, `getReview`, `updateReview`
- ReviewRecord shape:
  ```
  {
    reviewId:         string
    status:           "running" | "complete" | "error"
    agentStatuses:    { code: string, dependency: string, context: string }
    findings:         Finding[]
    contextSummary:   string
    dependencySummary: string
    startedAt:        string (ISO)
    completedAt:      string | null
  }
  ```
- Backed by a module-level `Map`
- `createReview(reviewId)` initialises status "running", agentStatuses all "Running",
  findings [], empty summaries
- `updateReview(reviewId, patch)` shallow-merges patch into existing record

**Todo**:
- [ ] Read Felix's `backend/src/index.js` to check if a review store already exists
- [ ] If yes: integrate with existing store; do not create a parallel one
- [ ] If no: create `backend/src/reviewStore.js` with the shape above

**Status**: [ ] pending

---

## Sub-Task 2 — Code Agent

**Intent**: The Code Agent is a thin, clearly labelled wrapper around Felix's scanner.
It calls `scanProject()`, attaches `source:"code-agent"` to each finding, and
returns a typed result. Its existence in the architecture makes the data flow
explicit: scanner produces raw signals; the agent labels them and passes them upstream.

**File**: `backend/src/agents/codeAgent.js`

**Contract**:
```javascript
export async function codeAgent(projectPath)
// Returns:
{
  agentId:  "code",
  status:   "complete",
  findings: Finding[],   // scanner findings with source:"code-agent" added
  summary:  string       // e.g. "3 code vulnerabilities detected"
}
```

**Implementation notes**:
- Import `scanProject` from `@rayshield/scanner` (Felix's boundary package)
- Do NOT reproduce any scanner logic — call the published function only
- Add `source: "code-agent"` field to each finding
- On scanner error, return `{ agentId:"code", status:"error", findings:[], summary:"scan failed" }`

**Expected Outcomes**:
- `codeAgent("./demo-app")` returns findings matching Felix's scanner output
- No scanner rules are reproduced in this file

**Todo**:
- [ ] Create `backend/src/agents/codeAgent.js`
- [ ] Confirm `@rayshield/scanner` is resolvable from the backend workspace

**Status**: [ ] pending

---

## Sub-Task 3 — Context Agent

**Intent**: The Context Agent reads repository documentation to build a contextSummary.
This summary is NOT a security finding. It is metadata that the merge step attaches
to every finding as `finding.context`, enabling the frontend's "Why it matters"
section to show repository-aware reasoning rather than generic boilerplate.

In Phase 3, this context will be passed to IBM Granite so the LLM can produce
explanations that reference the actual application — not generic CVE descriptions.

**File**: `backend/src/agents/contextAgent.js`

**Contract**:
```javascript
export async function contextAgent(projectPath)
// Returns:
{
  agentId:        "context",
  status:         "complete",
  findings:       [],        // always empty — context produces no security findings
  contextSummary: string     // human-readable application context string
}
```

**What it reads** (gracefully skips missing files):
1. `{projectPath}/README.md` — first non-empty paragraph (application purpose)
2. `{projectPath}/package.json` — `name` and `description` fields
3. `docs/architecture.md` — first heading line (overall system role)

**contextSummary format**:
```
"[app-name]: [purpose]. Architecture: [system-role]."
Example: "demo-app: Controlled Node.js application for security scanning.
          Architecture: Scan target for RayShield AI detection workflow."
```

**Expected Outcomes**:
- Returns a non-empty `contextSummary` even if all files are missing
  (fallback: `"Repository context unavailable."`)
- `findings` array is always `[]`
- Does not perform security analysis

**Todo**:
- [ ] Create `backend/src/agents/contextAgent.js`
- [ ] Resolve projectPath relative to CWD using `path.resolve`

**Status**: [ ] pending

---

## Sub-Task 4 — Dependency Agent (Supporting Analysis Only)

**Intent**: The Dependency Agent reads package metadata and produces a
`dependencySummary` string. It is explicitly labelled as supporting analysis,
not security findings. It does NOT produce entries in the `findings[]` array.

**Rationale**: Heuristics such as "missing lockfile" or "version pinned to latest"
are not security vulnerabilities in the CVE sense. Presenting them as Critical/High
findings would misrepresent risk to a judge and devalue real findings. Instead,
the Dependency Agent surfaces package health information that:
1. Completes the "three agents" narrative for the judge
2. Provides meaningful metadata (unpinned versions, dependency count)
3. Establishes the interface that Phase 3 can upgrade with a real advisory database

**File**: `backend/src/agents/dependencyAgent.js`

**Contract**:
```javascript
export async function dependencyAgent(projectPath)
// Returns:
{
  agentId:           "dependency",
  status:            "complete",
  findings:          [],     // always empty — this agent does not produce security findings
  dependencySummary: string  // e.g. "4 dependencies; 2 pinned to 'latest' (recommend locking)"
}
```

**What it reads**:
- `{projectPath}/package.json` — `dependencies` and `devDependencies` fields
- Does not make network calls; does not consult a CVE database

**Summary content** (all optional, gracefully skipped):
- Total dependency count
- Number pinned to `"latest"` (with note: "recommend explicit version pinning")
- Whether `package-lock.json` exists (note: "lockfile present/absent")
- Fallback: `"No package.json found at project path."` if file is missing

**Expected Outcomes**:
- `findings` is always `[]`
- `dependencySummary` is a readable one-to-two sentence summary
- Never throws — all I/O errors produce the fallback summary

**Todo**:
- [ ] Create `backend/src/agents/dependencyAgent.js`

**Status**: [ ] pending

---

## Sub-Task 5 — mergeAnalysis

**Intent**: After `Promise.all` resolves, combine the three agent results into a
single analysis object. The merger is responsible for:
1. Taking security findings from the Code Agent only
2. Attaching `contextSummary` from the Context Agent to every finding as `finding.context`
3. Carrying the `dependencySummary` forward for inclusion in the ReviewRecord

**File**: `backend/src/mergeAnalysis.js`

**Contract**:
```javascript
export function mergeAnalysis(agentResults)
// agentResults: [codeResult, dependencyResult, contextResult]
// Returns:
{
  findings:          Finding[],  // from codeAgent, with context attached
  contextSummary:    string,
  dependencySummary: string
}
```

**Logic**:
- Extract `findings` from the result with `agentId:"code"` only
- Extract `contextSummary` from the result with `agentId:"context"`
- Extract `dependencySummary` from the result with `agentId:"dependency"`
- For each finding: attach `finding.context = contextSummary`
- Deduplicate by `finding.id` (last write wins) — guards against future multi-scanner runs
- Does not add findings from dependencyAgent (it produces none by design)

**Expected Outcomes**:
- Returns findings from the code agent only, with context attached
- Order-independent — does not rely on `Promise.all` result array order

**Todo**:
- [ ] Create `backend/src/mergeAnalysis.js`

**Status**: [ ] pending

---

## Sub-Task 6 — prioritize

**Intent**: Apply a deterministic, transparent scoring formula to the merged findings.
Findings are returned sorted by `riskScore` descending. The formula and its inputs
are visible in the API response so a judge can audit it.

**File**: `backend/src/prioritize.js`

**Scoring formula (integer math, no external libraries)**:
```
severityScore  = { critical:40, high:30, medium:20, low:10 }[severity.toLowerCase()] ?? 10
confidenceScore = finding.confidence ?? 80   // percent 0–100
riskScore = severityScore + Math.round(confidenceScore / 10)
```

**Contract**:
```javascript
export function prioritize(findings)
// Returns: Finding[] sorted by riskScore descending
// Each finding gains: finding.riskScore = number
```

**Demo scoring for reference** (not hardcoded — derived from scanner output):
| Finding | Severity | Confidence | riskScore |
|---|---|---|---|
| SQL Injection | Critical (40) | 90 | 49 |
| XSS | High (30) | 85 | 39 |
| Hardcoded Secret | High (30) | 75 | 38 |

**Expected Outcomes**:
- `prioritize([])` returns `[]`
- Critical + 90% confidence always outranks High + 100% confidence
- `riskScore` is included in each finding in the API response

**Todo**:
- [ ] Create `backend/src/prioritize.js`

**Status**: [ ] pending

---

## Sub-Task 7 — orchestrator

**Intent**: The orchestrator is the central coordinator. It fires all three agents
in parallel, merges their results, prioritizes findings, and writes the completed
ReviewRecord to the store. It is a pure async function — no Express dependency,
fully testable in isolation.

**File**: `backend/src/orchestrator.js`

**Contract**:
```javascript
export async function orchestrateAnalysis(reviewId, projectPath)
```

**Logic**:
```
updateReview(reviewId, { status:"running", agentStatuses:{ code:"Running", dependency:"Running", context:"Running" } })

try {
  [codeResult, depResult, ctxResult] = await Promise.all([
    codeAgent(projectPath),
    dependencyAgent(projectPath),
    contextAgent(projectPath),
  ])
  merged   = mergeAnalysis([codeResult, depResult, ctxResult])
  sorted   = prioritize(merged.findings)
  updateReview(reviewId, {
    status:"complete",
    agentStatuses:{ code:"Complete", dependency:"Complete", context:"Complete" },
    findings: sorted,
    contextSummary: merged.contextSummary,
    dependencySummary: merged.dependencySummary,
    completedAt: new Date().toISOString()
  })
} catch (err) {
  updateReview(reviewId, { status:"error", error: err.message })
}
```

**Expected Outcomes**:
- All three agents fire simultaneously (not sequentially)
- Error in any single agent is caught and recorded — frontend does not poll forever
- The orchestrator has no knowledge of Express or HTTP

**Todo**:
- [ ] Create `backend/src/orchestrator.js`

**Status**: [ ] pending

---

## Sub-Task 8 — Wire backend (minimal)

**Intent**: Connect the orchestrator to Felix's existing POST handler.
This is the smallest possible change to `backend/src/index.js` — adding two imports
and one fire-and-forget call inside the existing handler.

**IMPORTANT**: Read Felix's current `backend/src/index.js` before touching it.
If his GET endpoint already returns a ReviewRecord from an internal store,
integrate reviewStore.js with that store rather than creating a parallel one.

**Required additions to `backend/src/index.js`**:
```javascript
// Add at top with other imports:
import { createReview } from "./reviewStore.js";
import { orchestrateAnalysis } from "./orchestrator.js";

// Modify POST /api/reviews handler:
app.post("/api/reviews", (_request, response) => {
  const reviewId = crypto.randomUUID();
  const projectPath = process.env.DEMO_APP_PATH || "./demo-app";
  createReview(reviewId);
  orchestrateAnalysis(reviewId, projectPath);   // fire-and-forget
  response.status(202).json({
    reviewId,
    status: "running",
    nextStep: "scan"
  });
});
```

**If Felix's GET handler already reads from a store**: update the reviewStore module
to use the same store map, or export a getter that Felix's handler can call.

**Expected Outcomes**:
- `POST /api/reviews` immediately returns 202 with reviewId
- Orchestration runs asynchronously in the background
- `GET /api/reviews/:reviewId` returns the ReviewRecord including `agentStatuses`,
  `findings`, `contextSummary`, `dependencySummary`, `status`, `completedAt`

**Todo**:
- [ ] Read Felix's current `backend/src/index.js` before making changes
- [ ] Add imports for reviewStore and orchestrator
- [ ] Add `createReview` call and fire-and-forget `orchestrateAnalysis` call
- [ ] Confirm GET endpoint returns full ReviewRecord (add if missing)

**Status**: [ ] pending

---

## Sub-Task 9 — Wire frontend

**Intent**: Replace the `window.setTimeout` stub in `App.jsx` with real API polling.
No component, prop shape, or CSS changes. Only `App.jsx` is modified.

**Changes to `frontend/src/App.jsx`**:

```javascript
// Replace analyzeRepository() with:
const analyzeRepository = async () => {
  setAnalysisStatus("Analysis running");
  setCurrentWorkflowStage("Detect");
  setAgentStatuses({ code: "Running", dependency: "Running", context: "Running" });

  try {
    const base = import.meta.env.VITE_API_URL || "http://localhost:3001";
    const { reviewId } = await fetch(`${base}/api/reviews`, { method: "POST" }).then(r => r.json());

    const interval = setInterval(async () => {
      try {
        const review = await fetch(`${base}/api/reviews/${reviewId}`).then(r => r.json());
        setAgentStatuses(review.agentStatuses);
        if (review.status === "complete") {
          clearInterval(interval);
          setFindings(review.findings);
          setSelectedFinding(review.findings[0] ?? null);
          setAnalysisStatus("Analysis complete");
          setCurrentWorkflowStage("Understand");
        }
        if (review.status === "error") {
          clearInterval(interval);
          setAnalysisStatus("Analysis error");
        }
      } catch { clearInterval(interval); setAnalysisStatus("Network error"); }
    }, 800);
  } catch {
    setAnalysisStatus("Error starting analysis");
  }
};
```

**State changes required**:
- Add `const [findings, setFindings] = useState(demoFindings)` — replaces hardcoded prop
- Change `<FindingsList findings={demoFindings}` to `<FindingsList findings={findings}`
- Keep `demoFindings` as the initial value — shown before first analysis

**Expected Outcomes**:
- Agent cards animate through Running → Complete driven by real API data
- Findings panel replaces with real scanner output after analysis completes
- Stepper advances to "Understand" only when backend reports complete
- `demoFindings` remains as placeholder until first real analysis

**Todo**:
- [ ] Add `findings` state with `demoFindings` as initial value
- [ ] Replace `window.setTimeout` with fetch + setInterval pattern above
- [ ] Pass `findings` state (not import) to `FindingsList`

**Status**: [ ] pending

---

## Sub-Task 10 — Tests

**Intent**: Prove the orchestration layer works end-to-end without a running server
and without touching Rabeesa's existing tests.

**File**: `tests/orchestrator.test.js`

**Tests** (using `node:test` and `node:assert`):

| Test | What it proves |
|---|---|
| `codeAgent("./demo-app")` returns `{ agentId:"code", status:"complete" }` | Code agent wraps scanner correctly |
| Code agent findings have `source:"code-agent"` | Findings are labelled by agent layer |
| `contextAgent("./demo-app")` returns `{ findings:[] }` | Context agent never produces findings |
| `contextAgent` `contextSummary` is a non-empty string | Context extraction works |
| `dependencyAgent("./demo-app")` returns `{ findings:[] }` | Dependency agent never produces findings |
| `prioritize([])` returns `[]` | Edge case |
| `prioritize([critical, high])` returns critical first | Risk ordering is correct |
| `mergeAnalysis(results)` attaches `contextSummary` to each finding as `.context` | Merge correctness |
| `mergeAnalysis` with duplicate finding ids deduplicates | Merge deduplication |
| `orchestrateAnalysis(reviewId, "./demo-app")` → `getReview(reviewId).status === "complete"` | Full pipeline |
| Final review has `findings.length >= 1` | Agents produced output |
| `riskScore` present on every finding | Prioritizer ran |

**Run command**: `node --test tests/orchestrator.test.js` from `RayShield/`

**Todo**:
- [ ] Create `tests/orchestrator.test.js`
- [ ] Import only from: `backend/src/orchestrator.js`, `backend/src/prioritize.js`,
      `backend/src/mergeAnalysis.js`, `backend/src/reviewStore.js`,
      `backend/src/agents/*.js`
- [ ] Do NOT modify Rabeesa's existing test files

**Status**: [ ] pending

---

## Data Contracts

### Finding object (canonical — must match Felix's scanner output)
```json
{
  "id":          "sql-injection",
  "severity":    "Critical",
  "name":        "SQL Injection",
  "file":        "demo-app/src/db/queries.js",
  "line":        8,
  "description": "User-controlled input is directly incorporated into a SQL query.",
  "status":      "Open",
  "impact":      "An attacker could read, modify, or delete data.",
  "action":      "Use parameterized queries.",
  "code":        "const query = `SELECT * FROM users WHERE id = ${userId}`;",
  "confidence":  90,
  "source":      "code-agent",
  "context":     "demo-app: Controlled Node.js application for security scanning.",
  "riskScore":   49
}
```

Fields added by Phase 2 (must not break Felix's existing contract):
- `source` — added by codeAgent
- `context` — added by mergeAnalysis
- `riskScore` — added by prioritize

### ReviewRecord (GET /api/reviews/:reviewId response)
```json
{
  "reviewId":          "uuid",
  "status":            "running | complete | error",
  "agentStatuses":     { "code": "Running | Complete | Error", "dependency": "...", "context": "..." },
  "findings":          [],
  "contextSummary":    "demo-app: Controlled Node.js application for security scanning.",
  "dependencySummary": "4 dependencies; 2 pinned to 'latest' (recommend locking versions).",
  "startedAt":         "ISO",
  "completedAt":       "ISO | null"
}
```

---

## IBM Bob 2.0 — Credible Hackathon Story

**What Bob actually does in this project** (no fake claims):

### Phase 2 (This Phase)
Bob is the **design authority and orchestration author** for the agent layer.

Specifically:
- Bob designed the three-layer architecture (deterministic / agent / AI) and enforced the boundary separation
- Bob authored the orchestrator, all three agent modules, the merge logic, and the prioritizer
- Bob's `spawn_subagent` parallel execution pattern is the direct architectural model for `Promise.all([codeAgent, dependencyAgent, contextAgent])`
- Bob's repository context-reading capability (reading docs, architecture files, package metadata before acting) is mirrored in the Context Agent's design
- The `bob_sessions/` directory contains the exported session record of this planning and implementation

The code includes JSDoc on every new module attributing: `@author IBM Bob 2.0 — RayShield AI hackathon agent orchestration layer`

### Phase 3 (Next Phase — LLM Integration Point)
```javascript
// agents/remediation/src/index.js
export async function proposeRemediation({ finding, source }) {
  // PHASE 3: This stub will call IBM Granite via Watson SDK
  // Input:  finding (with context from contextAgent)
  //         source (raw code from scanner)
  // Output: { explanation, diff, rationale }
  // The context field on finding (populated by Phase 2 contextAgent)
  // enables repository-aware explanations, not generic CVE text.
}
```

The judge sees a clear progression:
- Phase 2: deterministic pipeline, context gathered, risk ordered
- Phase 3: IBM Granite receives `finding.context` + `finding.code` and returns a reasoned explanation and patch

**This is genuine agentic design, not UI theatre.**

---

## 5-Minute Judge Demo Script

| Time | What the judge sees | What is happening |
|---|---|---|
| 0:00 | Click **Analyze Repository** | `POST /api/reviews` fires; orchestrator starts three agents in parallel |
| 0:02 | Three agent cards show **Running** (animated scan line) | Frontend polls GET every 800ms; returns `status:"running"` |
| 0:04 | All three cards flip to **Complete** | Scanner, context reader, and dependency reader all resolved |
| 0:05 | Stepper advances to **Understand** | Orchestrator wrote `status:"complete"` to reviewStore |
| 0:10 | Three findings appear: Critical SQL Injection first, then High XSS, then High Hardcoded Secret | Risk-prioritized by `riskScore` formula — Critical (40+9=49) before High (30+9=39) |
| 0:20 | Click SQL Injection finding | Context panel shows: "Why it matters", "Impact", "Recommended action", actual code snippet from demo-app |
| 0:40 | Show **Finding Details** — "context" field | Shows repository-aware context from contextAgent: "demo-app: Controlled Node.js scan target" |
| 1:00 | Open browser DevTools → Network → GET /api/reviews/:id | Raw JSON shows `agentStatuses`, `findings[]` with `riskScore`, `contextSummary`, `dependencySummary` |
| 1:30 | Point at code: `backend/src/orchestrator.js` | Show `Promise.all([codeAgent, depAgent, ctxAgent])` — real parallel execution, not a setTimeout |
| 2:00 | Point at code: `backend/src/prioritize.js` | Show scoring formula — transparent, deterministic, auditable |
| 2:30 | Point at code: `agents/remediation/src/index.js` | Show `// PHASE 3: IBM Granite via Watson SDK` comment — clear AI integration point |
| 3:00 | Click **Analyze Repository** again | Re-runs the entire pipeline — no hardcoded data |

**Key talking points**:
- "Three parallel agents — Code, Context, Dependency — mirror how IBM Bob dispatches parallel subagents"
- "The Context Agent reads repository documentation before analysis — same as how Bob reads codebase context before acting"
- "Findings arrive risk-prioritized with a transparent formula: not an ML black box, an auditable score"
- "Phase 3 slots IBM Granite into `proposeRemediation()` — the context Bob gathered here flows directly into the LLM prompt"

---

## Sub-Task Execution Order

1. reviewStore (Sub-Task 1) — foundation for all others
2. codeAgent (Sub-Task 2) — depends on Felix's scanner
3. contextAgent (Sub-Task 3) — independent
4. dependencyAgent (Sub-Task 4) — independent
5. mergeAnalysis (Sub-Task 5) — depends on agent shapes
6. prioritize (Sub-Task 6) — depends on finding shape
7. orchestrator (Sub-Task 7) — depends on all above
8. Wire backend (Sub-Task 8) — depends on orchestrator + reviewStore
9. Wire frontend (Sub-Task 9) — depends on backend being live
10. Tests (Sub-Task 10) — validates the full stack
