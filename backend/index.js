// backend/index.js
import express from "express";
import cors from "cors";

const app = express();

const PORT = process.env.PORT || 8080;          // Fly očekuje 8080
const ORIGINS = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

app.use(express.json());

// CORS (uključivo s preflight)
app.use(cors({
  origin: ORIGINS.length ? ORIGINS : true,      // true = sve (za debug), inače točan popis
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"],
  credentials: false
}));
app.options("*", cors());

// --- Health check ---
app.get("/", (_req, res) => {
  res.json({ ok: true, service: "YOUniversity API" });
});

// --- Minimalni login (ENV admin) ---
app.post("/auth/login", (req, res) => {
  const { email, password } = req.body || {};
  if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
    return res.json({ token: signToken(email), role: "superadmin" });
  }
  return res.status(401).json({ error: "Invalid credentials" });
});

// Health (pomaže da Fly ne ususpava)
app.get("/healthz", (_req, res) => res.send("ok"));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend listening on http://0.0.0.0:${PORT}`);
});
