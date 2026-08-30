/**
 * demo-app/src/db/queries.js
 *
 * INTENTIONAL VULNERABILITY — FOR DEMO PURPOSES ONLY.
 *
 * This file contains a deliberate SQL injection vulnerability used as the
 * controlled scan target for RayShield AI.  Do NOT use this pattern in
 * production code.
 *
 * Safe alternative: use parameterised queries (db.query("... WHERE id = ?", [id])).
 */

import { db } from "../db.js";

/**
 * Looks up a user by ID supplied from the HTTP layer.
 *
 * VULNERABLE: the caller passes `req.params.id` directly and it is
 * interpolated straight into the SQL string with no sanitisation.
 *
 * Attack example:
 *   GET /users/1 OR 1=1--
 *   → SELECT * FROM users WHERE id = 1 OR 1=1--
 */
export async function getUserById(id) {
  // UNSAFE — user-controlled `id` is interpolated directly into SQL
  const query = `SELECT * FROM users WHERE id = ${id}`;
  return db.all(query);
}

/**
 * Searches orders by status provided by the caller.
 *
 * VULNERABLE: status is concatenated into SQL without escaping.
 */
export async function getOrdersByStatus(status) {
  // UNSAFE — string concatenation feeds user input into SQL
  const query = "SELECT * FROM orders WHERE status = '" + status + "'";
  return db.all(query);
}
