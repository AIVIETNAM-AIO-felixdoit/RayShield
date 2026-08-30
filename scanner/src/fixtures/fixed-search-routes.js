/**
 * Fixed variant of demo-app/src/routes/search.js — FOR TESTING ONLY.
 *
 * This is the safe version used in scanner tests to prove that the
 * xss-reflected rule does NOT fire after a fix is applied.
 * It lives in scanner/src/fixtures/ and is never part of the demo scan target.
 */

import express from "express";

export const searchRouter = express.Router();

// Simple HTML escape helper — replaces the dangerous direct interpolation
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// SAFE — req.query.q is escaped before being embedded in the response
searchRouter.get("/search", (req, res) => {
  const safeQuery = escapeHtml(req.query.q ?? "");
  res.send(`
    <html>
      <body>
        <h1>Search Results</h1>
        <p>Results for: ${safeQuery}</p>
      </body>
    </html>
  `);
});

// SAFE — req.params.name is escaped
searchRouter.get("/user/:name", (req, res) => {
  const safeName = escapeHtml(req.params.name);
  res.send(`<h2>Profile: ${safeName}</h2>`);
});
