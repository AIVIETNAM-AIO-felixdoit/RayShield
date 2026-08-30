# Bob Security Reviewer — Workflow Design Plan

## Top-Level Overview

**Goal**: Design a reusable IBM Bob security-reviewer workflow that a developer invokes
when a RayShield finding exists. Bob's role is strictly in the EXPLAIN and PROPOSE FIX
stages of the pipeline. The deterministic scanner (scanner/) runs first and is never
replaced by LLM output.

**Scope**: This plan covers:
1. A Bob skill (`SKILL.md`) named `rayshield-security-review`
2. A custom Bob mode (`custom_modes.yaml`) named `security-reviewer`
3. Updates to `AGENTS.md` to register persistent workflow instructions
4. The demo-app vulnerable source file (SQL injection target)
5. The `agents/remediation/src/index.js` integration point annotation
6. Evidence preservation in `bob_sessions/` for hackathon submission
7. A 5-minute judge demo script

**What Bob does at runtime** (grounded in real capabilities):
- Reads the selected finding from context
- Uses `read_file` to locate and read the vulnerable source file
- Uses `read_file` to read repo docs for application context
- Uses `spawn_subagent` to run code analysis and doc reading in parallel
- Explains the vulnerability in application-specific terms
- Proposes a minimal parameterized-query fix and generates a unified diff
- Identifies which tests to run
- Waits for explicit developer Approve/Reject input
- After approval: applies the diff using `apply_diff`
- Triggers `npm test` and `node scanner/src/index.js` equivalent re-scan
- Calls `summarizeValidation(checks)` logic to determine FIX VERIFIED
- Saves a session evidence file to `bob_sessions/`

**What Bob does NOT do**:
- Replace the scanner
- Skip the human approval gate
- Claim FIX VERIFIED without a re-scan
- Invent test or scan output
- Touch files outside the fix scope

**Approach**: Bob Skill + Bob Mode combination. The skill provides the step-by-step
procedural instructions; the mode sets the persona, permissions, and available tools.
The AGENTS.md file makes the workflow discoverable to Bob across all sessions.

---

## Sub-Task 1 — Create the demo-app vulnerable source

**Intent**: The SQL injection demo requires a real vulnerable source file at
`demo-app/src/db/queries.js`. This file is the scan target. Without it, Bob
cannot read a real vulnerable file, the scanner returns no findings, and the
end-to-end demo loop cannot run. The demoFindings fallback in the frontend shows
this path (`demo-app/src/db/queries.js`, line 8) so the file must match exactly.

**Expected Outcomes**:
- `demo-app/src/db/queries.js` exists and contains a string-interpolated SQL query
  on line 8 that the scanner will flag as SQL Injection
- `demo-app/src/routes/search.js` exists with an unescaped `req.query.q` render
  for XSS (line 12)
- `demo-app/src/config.js` exists with a hardcoded API key (line 3)
- `demo-app/package.json` exists so the dependency agent can read it
- `demo-app/README.md` already exists (do not touch)

**Todo List**:
- [ ] Create `demo-app/src/db/queries.js` — SQL injection at line 8
- [ ] Create `demo-app/src/routes/search.js` — reflected XSS at line 12
- [ ] Create `demo-app/src/config.js` — hardcoded API key at line 3
- [ ] Create `demo-app/package.json` — minimal Node package with a few deps
- [ ] Verify line numbers match what the scanner and demoFindings expect

**Relevant Context**:
- `RayShield/frontend/src/data/demoFindings.js` — shows expected file paths and lines
- `RayShield/demo-app/README.md` — design intent (do not modify)
- Scanner finding contract: `{ id, severity, name, file, line, description, code, confidence }`

**Status**: [ ] pending

---

## Sub-Task 2 — Implement the real scanner

**Intent**: `scanner/src/index.js` currently returns an empty findings array. For the
demo to work end-to-end, it must detect the three vulnerabilities in demo-app.
The scanner is deterministic AST/regex analysis — no LLM, no network calls.
This is Layer 1 in the architecture (pure factual detection).

**Expected Outcomes**:
- `scanProject({ projectPath: "./demo-app" })` returns 3 findings matching
  the canonical Finding contract (id, severity, name, file, line, description,
  impact, action, code, confidence)
- SQL Injection: id="sql-injection", severity="Critical", confidence=90, file=".../queries.js", line=8
- XSS: id="xss", severity="High", confidence=85, file=".../search.js", line=12
- Hardcoded Secret: id="hardcoded-secret", severity="High", confidence=75, file=".../config.js", line=3
- After the fix is applied (queries.js uses parameterized query), re-running the scanner
  returns 0 SQL injection findings (the XSS and secret findings remain)

**Todo List**:
- [ ] Read current `scanner/src/index.js` — understand the stub
- [ ] Implement regex/string-match detection for:
  - SQL injection: template literal with `${` inside a SQL string in .js files
  - Reflected XSS: `res.send(` with `req.query` inside a template literal
  - Hardcoded secret: assignment of a string matching `sk_live_` or similar patterns
- [ ] Return findings in the canonical shape with all required fields
- [ ] Confirm scanner does NOT import from backend, agents, or validator
- [ ] Verify re-scan after fix produces 0 SQL injection results

**Relevant Context**:
- `RayShield/scanner/src/index.js` — current stub
- `RayShield/scanner/package.json` — `"type": "module"`, Node built-in test runner
- Phase 2 plan contract: findings must include `confidence` field (0-100)
- `.bob/rules-agent/AGENTS.md` — "Never reproduce scanner logic outside scanner/"

**Status**: [ ] pending

---

## Sub-Task 3 — Create the Bob Security Reviewer skill

**Intent**: A Bob skill named `rayshield-security-review` provides the complete
step-by-step workflow instructions that Bob follows when reviewing a RayShield finding.
Skills are the correct Bob primitive for a reusable procedural workflow — they load
detailed instructions into context on demand via `use_skill`.

The skill instructs Bob to:
1. Read the finding (from context or user input)
2. Read the vulnerable file using `read_file`
3. Read repo docs (`demo-app/README.md`, `docs/architecture.md`) for application context
4. Use `spawn_subagent` to parallelize code analysis and doc reading
5. Write a structured explanation (what, why, impact, why-it-matters-here)
6. Write a minimal proposed fix (parameterized query for SQL injection)
7. Generate a unified diff using `apply_diff` format
8. List tests that must run
9. Pause for explicit Approve/Reject from the developer
10. On Approve: apply the diff with `apply_diff`
11. Run `npm test` and re-run the scanner
12. Read scanner output — check if the original finding is absent
13. Call the `summarizeValidation` logic contract: all checks must pass
14. Display FIX VERIFIED or NOT VERIFIED based only on real check results
15. Save evidence to `bob_sessions/YYYY-MM-DD-sql-injection.md`

**Expected Outcomes**:
- File `RayShield/.bob/skills/rayshield-security-review/SKILL.md` exists
- The skill frontmatter includes correct `name`, `description`, and `tools` fields
- The skill body contains all 15 procedural steps in order
- The skill explicitly states what Bob must NOT do (skip approval, invent results)
- The skill references the exact API endpoints for approve/apply/validate

**Todo List**:
- [ ] Read Bob skill schema documentation via `search_bob_docs` before writing
- [ ] Create `.bob/skills/rayshield-security-review/SKILL.md`
- [ ] Write frontmatter: name, description, tools list (read_file, apply_diff, spawn_subagent, execute_command)
- [ ] Write the 15-step procedural body
- [ ] Include the finding shape Bob should expect as input
- [ ] Include the hard boundary rules (no skipping approval, no invented results)
- [ ] Include the evidence preservation step (bob_sessions/ output format)

**Relevant Context**:
- `RayShield/.bob/` — existing Bob config directory
- `RayShield/.bobignore` — files Bob cannot read (relevant for what NOT to pass in prompts)
- `RayShield/AGENTS.md` — existing project instructions Bob reads automatically
- `RayShield/agents/remediation/src/index.js` — the boundary function this skill drives
- `RayShield/validator/src/index.js` — `summarizeValidation(checks)` — FIX VERIFIED logic

**Status**: [ ] pending

---

## Sub-Task 4 — Create the Bob Security Reviewer mode

**Intent**: A custom Bob mode named `security-reviewer` gives Bob the correct persona,
tool permissions, and role definition for the security review workflow. The mode
complements the skill: the skill provides the steps, the mode sets the context
and restricts Bob from wandering outside the security review scope.

The mode should:
- Set a `roleDefinition` that frames Bob as a security reviewer (not a general coder)
- Enable the tools required: `read_file`, `apply_diff`, `search_and_replace`,
  `execute_command`, `spawn_subagent`, `insert_content`, `list_files`
- Be registered in `custom_modes.yaml` at the workspace level

**Expected Outcomes**:
- `RayShield/.bob/custom_modes.yaml` exists with the `security-reviewer` mode entry
- The mode's `roleDefinition` explicitly scopes Bob to the Explain → Propose Fix
  → Approve → Apply → Verify stages
- The mode does not grant file write access outside `demo-app/` and `bob_sessions/`
  (enforced by roleDefinition instruction, not by permission stripping)
- Switching to this mode in the demo is a single `switch_mode` call

**Todo List**:
- [ ] Read Bob mode schema documentation via `search_bob_docs` before writing
- [ ] Create or update `RayShield/.bob/custom_modes.yaml`
- [ ] Write `security-reviewer` mode entry with correct schema
- [ ] Set `roleDefinition` to scope Bob to security review workflow
- [ ] List available tools appropriate for the workflow
- [ ] Verify mode name matches what the skill references

**Relevant Context**:
- `RayShield/.bob/` — existing Bob config directory
- Bob mode schema requires: `name`, `id`, `roleDefinition`, `groups` or `tools`
- The skill (Sub-Task 3) must be activatable from within this mode

**Status**: [ ] pending

---

## Sub-Task 5 — Update AGENTS.md with Bob workflow instructions

**Intent**: `AGENTS.md` is read by Bob automatically at the start of every session.
Adding a "Bob Security Reviewer" section to it makes the workflow discoverable
without requiring the developer to remember to activate the skill.
This is the "persistent project instructions" capability called out in the brief.

The section should tell Bob:
- When a RayShield finding is selected, the developer may say "Review this with Bob"
- Bob should then call `use_skill` with `rayshield-security-review`
- Bob must not proceed past step 8 (propose fix) without explicit approval
- The demo primary finding is `sql-injection` in `demo-app/src/db/queries.js`

**Expected Outcomes**:
- `AGENTS.md` gains a `## Bob Security Reviewer` section
- The section is concise — it points to the skill, not duplicates it
- The section documents the trigger phrase developers use
- Existing AGENTS.md content is not modified

**Todo List**:
- [ ] Read current `RayShield/AGENTS.md` to find correct insertion point
- [ ] Append `## Bob Security Reviewer` section to AGENTS.md
- [ ] Document trigger, skill name, and approval gate instruction
- [ ] Keep the addition under 20 lines

**Relevant Context**:
- `RayShield/AGENTS.md` — current content (read before editing)
- `RayShield/.bob/rules-plan/AGENTS.md` — existing Bob-mode-specific rules

**Status**: [ ] pending

---

## Sub-Task 6 — Annotate the remediation agent boundary

**Intent**: `agents/remediation/src/index.js` is currently a stub. For the hackathon
demo, this boundary function is where IBM Granite would be called in a production
build. The stub must be annotated clearly so:
1. Bob knows exactly what to pass in and what to return when the skill drives it
2. A judge can see the clean AI integration point
3. The backend can call this function and receive a usable response for the demo

For the demo, the stub should return a hardcoded-but-realistic explanation and diff
for the SQL injection finding, so the full Explain → Propose Fix → Approve → Apply
loop works end-to-end even without a live Watson/Granite API key.

**Expected Outcomes**:
- `agents/remediation/src/index.js` returns a realistic explanation and diff
  when `finding.id === "sql-injection"`
- The function has a JSDoc comment block explaining the Phase 3 IBM Granite integration
- The diff in the response is a real unified diff that, when applied, changes the
  vulnerable query to a parameterized query
- The function still returns `{ status, findingId, explanation, diff }` — the
  existing contract is not broken

**Todo List**:
- [ ] Read `agents/remediation/src/index.js` — understand current stub contract
- [ ] Read `demo-app/src/db/queries.js` (created in Sub-Task 1) to produce a real diff
- [ ] Write explanation text for SQL injection (application-specific, not generic CVE)
- [ ] Write a real unified diff (`--- a/... +++ b/...`) for the parameterized query fix
- [ ] Add JSDoc `@phase3` annotation explaining IBM Granite integration point
- [ ] Do NOT add Watson SDK dependency — demo works without live credentials

**Relevant Context**:
- `RayShield/agents/remediation/src/index.js` — current stub
- `RayShield/.bob/rules-agent/AGENTS.md` — return shape must be `{ status, findingId, explanation, diff }`
- The backend will call `proposeRemediation({ finding, source })` and pass the result
  to the frontend via `POST /api/findings/:findingId/remediation`

**Status**: [ ] pending

---

## Sub-Task 7 — Implement the backend workflow endpoints

**Intent**: The backend currently has only `POST /api/reviews` and `GET /health`.
The remaining 5 endpoints in the API contract need to be implemented to close the
full Explain → Propose Fix → Approve → Apply → Validate loop. The frontend
is already wired to call all of these (from the previous frontend integration task).

This sub-task wires the orchestration layer (from the Phase 2 plan) and adds
the remaining endpoints. It is the minimum backend needed for the Bob workflow demo.

**Endpoints to implement**:

| Endpoint | What it does |
|---|---|
| `GET /api/reviews/:reviewId` | Returns ReviewRecord from reviewStore |
| `POST /api/findings/:findingId/remediation` | Calls `proposeRemediation()`, returns `{ explanation, diff }` |
| `POST /api/findings/:findingId/approve` | Records `{ approved: true/false }` in review state |
| `POST /api/findings/:findingId/apply` | Applies the stored diff to the demo-app file |
| `POST /api/findings/:findingId/validate` | Runs scanner re-scan + calls `summarizeValidation()`, returns result |

**For the apply endpoint**: The diff stored in the remediation response is applied
by patching `demo-app/src/db/queries.js` directly (Node.js `fs` write). This is
the "Bob applies the approved fix" moment in the demo.

**For the validate endpoint**: Run `scanProject({ projectPath: "./demo-app" })`,
check that the `sql-injection` finding is absent, call `summarizeValidation(checks)`,
return the result. FIX VERIFIED only if scanner no longer reports the original finding.

**Expected Outcomes**:
- All 5 endpoints return correct JSON
- `GET /api/reviews/:reviewId` returns `{ status, agentStatuses, findings, ... }`
- `POST /api/findings/sql-injection/remediation` returns a real explanation and diff
- `POST /api/findings/sql-injection/approve` with `{ approved: true }` enables apply
- `POST /api/findings/sql-injection/apply` patches `demo-app/src/db/queries.js`
- `POST /api/findings/sql-injection/validate` returns `{ status: "FIX VERIFIED", verified: true }`
  only after the scanner no longer finds the SQL injection

**Todo List**:
- [ ] Create `backend/src/reviewStore.js` (Sub-Task 1 from phase2 plan)
- [ ] Create `backend/src/agents/codeAgent.js` — wraps scanner
- [ ] Create `backend/src/agents/contextAgent.js` — reads repo docs
- [ ] Create `backend/src/agents/dependencyAgent.js` — reads package metadata
- [ ] Create `backend/src/mergeAnalysis.js`
- [ ] Create `backend/src/prioritize.js`
- [ ] Create `backend/src/orchestrator.js`
- [ ] Add `GET /api/reviews/:reviewId` to `backend/src/index.js`
- [ ] Add `POST /api/findings/:findingId/remediation` endpoint
- [ ] Add `POST /api/findings/:findingId/approve` endpoint
- [ ] Add `POST /api/findings/:findingId/apply` endpoint
- [ ] Add `POST /api/findings/:findingId/validate` endpoint
- [ ] Wire `POST /api/reviews` to call `orchestrateAnalysis` fire-and-forget

**Relevant Context**:
- `RayShield/docs/phase2-orchestration-plan.md` — full orchestration design
- `RayShield/backend/src/index.js` — existing backend (do not break existing endpoints)
- `RayShield/validator/src/index.js` — `summarizeValidation(checks)` contract
- `RayShield/agents/remediation/src/index.js` — `proposeRemediation({ finding, source })`

**Status**: [ ] pending

---

## Sub-Task 8 — Evidence preservation and demo script

**Intent**: Create the `bob_sessions/` directory and a template for session evidence.
The `.bob/rules-ask/AGENTS.md` rule states: "bob_sessions/ folder is required for
project submission per .gitignore comments — do not delete it."
For the hackathon, a completed Bob session must produce an evidence file proving
the end-to-end workflow ran.

The demo script is a judge-facing document (not code) that maps each UI moment
to the Bob capability being demonstrated.

**Expected Outcomes**:
- `bob_sessions/` directory exists with a `.gitkeep` file (or README)
- `bob_sessions/demo-sql-injection-template.md` exists with the evidence format:
  - Finding that was reviewed (id, severity, file, line)
  - Bob explanation (copy from session)
  - Proposed diff (copy from session)
  - Approval action (who approved, timestamp)
  - Test results (pass/fail)
  - Re-scan result (finding absent/present)
  - Final status (FIX VERIFIED / NOT VERIFIED)
- `docs/demo-script.md` exists with the 5-minute judge demo script

**Todo List**:
- [ ] Create `bob_sessions/` directory with `.gitkeep` or README
- [ ] Create `bob_sessions/demo-sql-injection-template.md` with evidence format
- [ ] Create `docs/demo-script.md` with minute-by-minute judge script
- [ ] Verify `bob_sessions/` is not blocked by `.bobignore` or `.gitignore`
- [ ] Confirm `.gitignore` comment about `bob_sessions/` (check if it should be committed)

**Relevant Context**:
- `RayShield/.bob/rules-ask/AGENTS.md` — "bob_sessions/ folder is required for project submission"
- `RayShield/docs/phase2-orchestration-plan.md` — existing 5-minute demo script (extend, not replace)
- `RayShield/.gitignore` — check whether `bob_sessions/` is excluded

**Status**: [ ] pending

---

## Implementation Order

The sub-tasks have dependencies. Recommended execution sequence:

```
1 (demo-app files) → 2 (scanner) → 6 (remediation annotation) → 7 (backend endpoints)
                                                                      ↑
                              3 (skill) → 4 (mode) → 5 (AGENTS.md)  |
                                                                      |
                                        8 (evidence + demo script) ──┘
```

Sub-tasks 3, 4, 5 (Bob configuration files) are independent of the backend
and can be done before or after the backend work. They do not require a running
server to write or validate.

Sub-task 8 (evidence) is written last because the demo script references the
completed workflow.
