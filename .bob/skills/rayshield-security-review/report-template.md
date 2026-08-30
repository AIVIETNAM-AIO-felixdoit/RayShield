# RayShield Security Review — Session Evidence Template

Bob fills this template during Step 15 of the workflow.
Replace every `<placeholder>` with actual output from the run.
Do not fabricate any field. If a step did not run, write "Not reached — <reason>".

---

# RayShield Security Review: <finding.rule>

**Date:** <YYYY-MM-DD>
**Workflow run by:** IBM Bob (rayshield-security-review skill)

---

## Finding

| Field | Value |
|---|---|
| Rule | `<finding.rule>` |
| Severity | `<finding.severity>` |
| File | `<finding.file>` |
| Line | `<finding.line>` |
| Description | <finding.description> |

> Note: `finding.id` is a scan-time UUID and is not recorded here.
> Verification is performed by rule + file + line, not by ID.

---

## Explanation

### What is vulnerable
<exact code construct — quote the vulnerable line>

### Why it is dangerous
<mechanism explanation>

### Attack scenario
<application-specific attack scenario — not a generic CVE description>

### Potential impact
<impact scoped to this application>

---

## Repository context

<summary from Subagent B: application purpose, technology stack, why the
finding matters in this specific project>

---

## Proposed fix

<prose description of the minimal change>

### Diff applied

```diff
<paste the unified diff that was applied — exactly as shown to the developer>
```

---

## Approval

**Developer action:** APPROVE / REJECT
**Timestamp:** <approximate time or "not recorded">

> If REJECT: record reason if provided. Note that no code was changed. Stop here.

---

## Apply result

```
<output from apply_diff — success confirmation or error message>
```

---

## Test results

**Command:** `<test command run>`

```
<complete verbatim test output>
```

**Test suite status:** passed / failed

---

## Re-scan output

**Command:** `node --input-type=module --eval "import { scanProject } from './scanner/src/index.js'; ..."`

```json
<complete verbatim JSON output from scanProject()>
```

---

## Verification

**Matching rule:** `<original finding.rule>`
**Matching file:** `<original finding.file>`
**Matching line:** `<original finding.line>` (±3 tolerance)

| Check | Status |
|---|---|
| test-suite | passed / failed |
| rescan-absence | passed / failed |

**summarizeValidation logic applied:**
`checks.length > 0 && checks.every(c => c.status === "passed")`

---

## Final result

```
FIX VERIFIED
```
or
```
NOT VERIFIED
```

---

## Notes

<Any errors encountered, partial completions, files skipped due to .bobignore,
developer comments, or anything else relevant to this run.>
