/**
 * demo-app/src/routes/search.js
 *
 * INTENTIONAL VULNERABILITY — FOR DEMO PURPOSES ONLY.
 *
 * This file contains a deliberate reflected XSS vulnerability used as the
 * controlled scan target for RayShield AI.  Do NOT use this pattern in
 * production code.
 *
 * Safe alternative: escape HTML before embedding user input in a response
 * (e.g. use a template engine with auto-escaping, or encode with he/entities).
 */

import express from "express";

export const searchRouter = express.Router();

/**
 * GET /search?q=<user-input>
 *
 * VULNERABLE: req.query.q is embedded directly into the HTML response
 * without escaping.  An attacker can inject arbitrary HTML/JavaScript.
 *
 * Attack example:
 *   GET /search?q=<script>alert(document.cookie)</script>
 */
searchRouter.get("/search", (req, res) => {
  // UNSAFE — req.query.q flows directly into HTML without sanitisation
  res.send(`
    <html>
      <body>
        <h1>Search Results</h1>
        <p>Results for: ${req.query.q}</p>
      </body>
    </html>
  `);
});

/**
 * GET /user/:name
 *
 * VULNERABLE: req.params.name embedded directly in the response.
 */
searchRouter.get("/user/:name", (req, res) => {
  // UNSAFE — req.params.name is reflected without escaping
  res.send(`<h2>Profile: ${req.params.name}</h2>`);
});
