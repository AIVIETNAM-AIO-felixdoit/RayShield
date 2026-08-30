/**
 * Fixed variant of demo-app/src/db/queries.js — FOR TESTING ONLY.
 *
 * This is the safe version used in scanner tests to prove that the
 * sql-injection rule does NOT fire after a fix is applied.
 * It lives in scanner/src/fixtures/ and is never part of the demo scan target.
 */

// SAFE — uses parameterised queries (placeholder ?)
export async function getUserById(db, id) {
  const query = "SELECT * FROM users WHERE id = ?";
  return db.all(query, [id]);
}

// SAFE — parameterised with named placeholder
export async function getOrdersByStatus(db, status) {
  const query = "SELECT * FROM orders WHERE status = ?";
  return db.all(query, [status]);
}
