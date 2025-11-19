// backend/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import chatRoute from "./routes/chatRoute.js";

dotenv.config();

const app = express();

// --- Determine environment ---
const isProduction = process.env.NODE_ENV === "production";

// ✅ Use correct frontend origin
const frontendOrigin = isProduction
  ? process.env.FRONTEND_URL || "https://real-time-rag-chatbot.netlify.app"
  : "http://localhost:5173"; // your React dev port

// --- CORS setup ---
app.use(
  cors({
    origin: frontendOrigin,
    methods: ["GET", "POST", "OPTIONS"],
  })
);

app.use(express.json({ limit: "2mb" }));

// --- Health check routes ---
app.get("/health", (_, res) => res.send("ok"));
app.get("/api/health", (_, res) => res.json({ ok: true, ts: Date.now() }));

// --- Main chat route ---
app.use("/api", chatRoute);

// --- Dynamic port handling ---
const PORT = process.env.PORT || 8080;

// ✅ Don't pass HOST manually – let Express bind correctly
app.listen(PORT, () => {
    console.log("process.env.PORT =", process.env.PORT);
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`CORS origin allowed: ${frontendOrigin}`);
});
