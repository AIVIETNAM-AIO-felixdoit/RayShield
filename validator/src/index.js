/**
 * A remediation is verified only if every required executable check passes.
 */
export function summarizeValidation(checks) {
  const allPassed = checks.length > 0 && checks.every((check) => check.status === "passed");

  return {
    checks,
    status: allPassed ? "FIX VERIFIED" : "NOT VERIFIED"
  };
}
