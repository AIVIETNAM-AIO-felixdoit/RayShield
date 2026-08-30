---
name: rayshield-security-review
description: Full security review workflow for a RayShield finding. Bob reads
  the affected source code and repository context, explains the vulnerability in
  application-specific terms, proposes a minimal fix with a unified diff, then
  stops for explicit human approval. After APPROVE: applies the diff, runs tests,
  re-runs the RayShield scanner via scanProject(), and reports FIX VERIFIED or
  NOT VERIFIED based on actual check results. Invoke when a developer selects a
  RayShield finding and wants Bob to drive the complete Understand -> Propose ->
  Approve -> Apply -> Test -> Re-scan -> Verify cycle.
---

# RayShield Security Review Workflow

Consult `finding-schema.md` for the canonical finding contract,
`remediation-patterns.md` for safe fix patterns, and `report-template.md` for
the evidence file format.

---

## PHASE 1 — DETECT (Read and confirm the finding)

### Step 1 — Read the finding

Read the finding object from context or from the developer's message.
Confirm all six required fields are present:
- `id` (UUID — do NOT use this for verification, see Step 13)
- `rule` (e.g. `sql-injection`, `xss-reflected`, `hardcoded-secret`)
- `severity` (`critical` or `high`)
- `file` (relative path, e.g. `demo-app/src/db/queries.js`)
- `line` (integer)
- `description`

If any required field is missing, ask the developer to paste the complete
finding before proceeding. Do not guess missing values.

### Step 2 — Acknowledge scope

State clearly to the developer:

> "This finding was produced by the RayShield deterministic scanner.
> My role is contextual reasoning, explanation, remediation proposal, and
> post-fix verification — not re-detection. I will not modify any code
> until you explicitly approve the proposed fix."

---

## PHASE 2 — UNDERSTAND (Parallel analysis)

### Step 3 — Spawn two subagents in parallel

Spawn both subagents simultaneously. Do not proceed until both return.

**Subagent A — Code analysis:**
- Read the full source file at `finding.file` using `read_file`
- Read ±20 lines around `finding.line` for immediate context
- Identify: the specific tainted input, its propagation path, and the
  vulnerable sink
- Note the exact lines that need to change

**Subagent B — Repository context:**
- Read `demo-app/README.md`
- Read `docs/architecture.md`
- Find and read the `package.json` closest to `finding.file`
  (skip gracefully if blocked by `.bobignore` — note the skip and continue)
- Summarise: what this application does, its technology stack, and why the
  finding matters in this specific context

### Step 4 — Synthesise

Combine both subagent results. Produce a unified understanding of:
1. The exact vulnerable code pattern
2. What the application does that makes the vulnerability exploitable
3. The realistic attack vector for this codebase
4. The potential impact (scoped to what this application actually does)

### Step 5 — Write the explanation

Write the explanation section with these four subsections:

**WHAT IS VULNERABLE**
Name the specific code construct — the exact expression, not the generic
rule name. Quote the vulnerable line.

**WHY IT IS DANGEROUS**
Explain the mechanism. For SQL injection: how the query is constructed,
why the database executes attacker-controlled SQL. For XSS: how the
unescaped value reaches the DOM. For hardcoded secrets: how exposure occurs.

**ATTACK SCENARIO**
A concrete, realistic scenario for this application — not a textbook example.
Use what Subagent B found about the application's purpose and stack.

**POTENTIAL IMPACT**
The business/security consequence for this specific application.

---

## PHASE 3 — PROPOSE FIX

### Step 6 — Produce the minimal remediation

Consult `remediation-patterns.md` for the correct pattern for `finding.rule`.

Rules:
- Make the smallest change that eliminates the vulnerability
- Do not rename variables, refactor surrounding code, or add unrequested features
- Do not touch any file other than `finding.file`
- Do not add new dependencies unless strictly necessary and explicitly noted

### Step 7 — Generate the unified diff

Write the proposed fix as a unified diff in standard format:

```
--- a/<finding.file>
+++ b/<finding.file>
@@ -<start>,<count> +<start>,<count> @@
 <context line>
-<removed line>
+<added line>
 <context line>
```

The diff must be directly applicable with `apply_diff`. Include enough
context lines (3 minimum) for unambiguous matching.

### Step 8 — Identify the test plan

List:
- The test command to run after applying the fix
- Default: `npm --workspace scanner run test` (run from `RayShield/`)
- Any existing test files near `finding.file` that exercise the changed code
- What a passing result proves

---

## PHASE 4 — HUMAN APPROVAL GATE

### Step 9 — Present and stop

Display to the developer, in order:

```
FINDING
  Rule:     <finding.rule>
  Severity: <finding.severity>
  File:     <finding.file>
  Line:     <finding.line>

WHY THIS IS A PROBLEM
  <explanation from Step 5>

PROJECT CONTEXT
  <application-specific context from Subagent B>

PROPOSED FIX
  <prose description of the change>

DIFF
  <unified diff from Step 7>

TEST PLAN
  <test command and what it proves>
```

Then output exactly this line and stop:

> **"AWAITING APPROVAL — Reply APPROVE to apply this fix, or REJECT to stop."**

**Do not proceed past this point.** Do not read further files, do not apply
any change, do not continue the workflow for any response other than the
single word APPROVE (case-insensitive).

Treat every other response — including silence, partial approval, or
"looks good" — as a REJECT.

---

## PHASE 5 — APPLY

### Step 10 — Apply the approved diff

Only execute this step after receiving APPROVE.

Use `apply_diff` to apply the diff from Step 7 to `finding.file` only.

If the patch fails to apply cleanly:
- Report the exact error
- Set final status to NOT VERIFIED
- Stop — do not attempt a manual workaround

---

## PHASE 6 — TEST

### Step 11 — Run tests

Run the test command from Step 8 using `execute_command` from the
`RayShield/` directory.

Capture the complete output verbatim. Do not interpret or summarise — the
raw output becomes the evidence.

Record the result:
- All tests pass → `test-suite: passed`
- Any test fails or command errors → `test-suite: failed`

---

## PHASE 7 — RE-SCAN

### Step 12 — Run the RayShield scanner

From the `RayShield/` directory, run:

```
node --input-type=module --eval "import { scanProject } from './scanner/src/index.js'; scanProject({ projectPath: './demo-app' }).then(r => console.log(JSON.stringify(r, null, 2))).catch(e => { console.error(e.message); process.exit(1); })"
```

This invokes `scanProject({ projectPath })` — the deterministic scanner
boundary — without modifying any scanner file or adding a CLI wrapper.

Capture the complete JSON output verbatim. This is the post-fix scan result.

**Important:** Bob is reading this output for verification only. The scanner
is responsible for detection. Bob does not interpret the absence of a finding
as "Bob detected no vulnerability" — the scanner detected no vulnerability.

---

## PHASE 8 — VERIFY

### Step 13 — Check finding absence by rule and location

In the re-scan JSON output, search for any finding where ALL of:
- `finding.rule` matches the original finding's `rule`
- `finding.file` matches the original finding's `file`
- `finding.line` matches (or is within 3 lines if the edit shifted line numbers)

**Do NOT compare by `finding.id`.** IDs are generated by `crypto.randomUUID()`
on every scan and will never match the original.

Result:
- No matching finding in the re-scan → `rescan-absence: passed`
- A matching finding is still present → `rescan-absence: failed`

### Step 14 — Construct checks and apply summarizeValidation logic

Build the checks array:

```js
const checks = [
  { name: "test-suite",      status: "<passed|failed>" },
  { name: "rescan-absence",  status: "<passed|failed>" }
];
```

Apply the `summarizeValidation` contract from `validator/src/index.js`:

```js
// checks.length > 0 AND every check has status "passed" => "FIX VERIFIED"
// otherwise => "NOT VERIFIED"
// An empty checks array always returns "NOT VERIFIED"
```

Report the result verbatim as either `FIX VERIFIED` or `NOT VERIFIED`.
Do not compute this string by any other means. Do not claim FIX VERIFIED
because the code was changed — only because both checks passed.

---

## PHASE 9 — REPORT

### Step 15 — Save session evidence

Write the completed evidence record to:
`bob_sessions/YYYY-MM-DD-<finding.rule>.md`

Use the template in `report-template.md`. Fill every section with the
actual output captured during this run. Do not fabricate any field.

If `bob_sessions/` does not exist, create it before writing the file.

---

## Failure handling

**On REJECT (Step 9):**
Output: `"Fix rejected by developer. No code was changed."`
Write a rejection note to `bob_sessions/YYYY-MM-DD-<finding.rule>-rejected.md`
noting the finding details and that no change was applied. Stop.

**On apply failure (Step 10):**
Report the exact patch error. Set status NOT VERIFIED. Stop.
Do not attempt a manual workaround that was not part of the approved diff.

**On test failure (Step 11):**
Record `test-suite: failed`. Continue to Step 12 (re-scan still runs).
Final result will be NOT VERIFIED unless re-scan also passes and you
re-evaluate with the developer.

**On scanner error (Step 12):**
If `scanProject()` throws or returns unexpected output, record
`rescan-absence: failed` and set final status to NOT VERIFIED.
Do not guess the scan result.
