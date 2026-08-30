/**
 * demo-app/src/config.js
 *
 * INTENTIONAL VULNERABILITY — FOR DEMO PURPOSES ONLY.
 *
 * This file contains a deliberate hardcoded credential used as the
 * controlled scan target for RayShield AI.  Do NOT commit real credentials.
 *
 * Safe alternative: load all secrets from environment variables:
 *   const jwtSigningValue = process.env.JWT_SIGNING_VALUE;
 */

// UNSAFE — signing value hardcoded as a string literal instead of process.env
export const jwtSigningValue = "s3cr3t-demo-signing-key-do-not-use-in-prod";

// UNSAFE — API integration value hardcoded
export const externalApiKey = "demo-api-key-abc123-not-real";

// UNSAFE — database connection value hardcoded
export const dbAccessToken = "demo-db-token-xyz789-replace-with-env-var";

// Safe reference — this line should NOT trigger the rule
export const jwtSafeValue = process.env.JWT_VALUE;
