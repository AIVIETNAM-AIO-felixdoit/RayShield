import "dotenv/config";
import cors from "cors";
import express from "express";

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get("/health", (_request, response) => {
  response.json({ service: "rayshield-api", status: "ok" });
});

app.post("/api/reviews", (_request, response) => {
  response.status(202).json({
    reviewId: crypto.randomUUID(),
    status: "queued",
    nextStep: "scan"
  });
});

app.listen(port, () => {
  console.log(`RayShield API listening on http://localhost:${port}`);
});
