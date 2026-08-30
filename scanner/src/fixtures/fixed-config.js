/**
 * Fixed variant of demo-app/src/config.js — FOR TESTING ONLY.
 *
 * This is the safe version used in scanner tests to prove that the
 * hardcoded-secret rule does NOT fire after a fix is applied.
 * It lives in scanner/src/fixtures/ and is never part of the demo scan target.
 */

// SAFE — all sensitive values loaded from environment variables
export const jwtSigningValue = process.env.JWT_SIGNING_VALUE;
export const externalApiKey  = process.env.EXTERNAL_API_KEY;
export const dbAccessToken   = process.env.DB_ACCESS_TOKEN;
