import "dotenv/config";
import cors from "cors";
import express from "express";
import { fileURLToPath } from "url";
import { scanProject } from "@rayshield/scanner";

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

/** In-memory review store: reviewId → { reviewId, status, findings, scannedAt } */
const reviews = new Map();

// ── Routes ───────────────────────────────────────────────────────────────────

app.get("/health", (_request, response) => {
  response.json({ service: "rayshield-api", status: "ok" });
});

app.post("/api/reviews", async (_request, response) => {
  const reviewId = crypto.randomUUID();

  // Run scanner against the controlled demo application.
  // projectPath is relative to the process working directory (repo root).
  let result;
  try {
    result = await scanProject({ projectPath: "demo-app" });
  } catch (err) {
    result = { findings: [], scannedAt: new Date().toISOString() };
    console.error("Scanner error:", err.message);
  }

  const record = {
    reviewId,
    status: "scanned",
    findings: result.findings,
    scannedAt: result.scannedAt
  };

  reviews.set(reviewId, record);

  response.status(202).json(record);
});

app.get("/api/reviews/:reviewId", (request, response) => {
  const record = reviews.get(request.params.reviewId);
  if (!record) {
    return response.status(404).json({ error: "not found" });
  }
  response.json(record);
});

// ── Start server (only when this file is the main entry-point) ───────────────
// Compare normalised paths to handle both file:// URLs and plain paths.

function normalisePath(p) {
  try {
    return fileURLToPath(p);
  } catch {
    return p;
  }
}

const isMain =
  process.argv[1] &&
  normalisePath(import.meta.url) === normalisePath(process.argv[1]);

if (isMain) {
  app.listen(port, () => {
    console.log(`RayShield API listening on http://localhost:${port}`);
  });
}

export { app };
