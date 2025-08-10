// backend/index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "crypto";

// Routers
import devicesRouter from "./routes/devices.js";
import applicationsRouter from "./routes/applications.js";
import loansRouter from "./routes/loans.js";
import btlRouter from "./routes/btl.js";
import reportsRouter from "./routes/reports.js";
import gdprRouter from "./routes/gdpr.js";
import importsRouter from "./routes/imports.js";

dotenv.config();

const app = express();
app.use(express.json());

// --- CORS (više domena odvojenih zarezom) ---
const allowed = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowed.length === 0 || allowed.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"), false);
    }
  })
);

// --- Health check ---
app.get("/", (_req, res) => {
  res.json({ ok: true, service: "YOUniversity API" });
});

// --- Token util (HMAC, bez dodatnih libova) ---
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
function signToken(email) {
  const ts = Date.now(); // ms
  const payload = `${email}.${ts}`;
  const sig = crypto.createHmac("sha256", JWT_SECRET).update(payload).digest("base64url");
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}
function verifyToken(token, maxAgeMs = 24 * 60 * 60 * 1000) {
  try {
    const raw = Buffer.from(token, "base64url").toString("utf8");
    const [email, tsStr, sig] = raw.split(".");
    const payload = `${email}.${tsStr}`;
    const expect = crypto.createHmac("sha256", JWT_SECRET).update(payload).digest("base64url");
    if (expect !== sig) return null;
    const ts = Number(tsStr);
    if (!Number.isFinite(ts) || Date.now() - ts > maxAgeMs) return null;
    return { email };
  } catch {
    return null;
  }
}

// --- Minimalni login (ENV admin) ---
app.post("/auth/login", (req, res) => {
  const { email, password } = req.body || {};
  if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
    return res.json({ token: signToken(email), role: "superadmin" });
  }
  return res.status(401).json({ error: "Invalid credentials" });
});

// --- Auth middleware ---
export function requireAuth(req, res, next) {
  const hdr = req.headers.authorization || "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
  const user = token ? verifyToken(token) : null;
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  req.user = user;
  next();
}

// --- Mount routers (zaštićeno) ---
app.use("/devices", requireAuth, devicesRouter);
app.use("/applications", requireAuth, applicationsRouter);
app.use("/loans", requireAuth, loansRouter);
app.use("/btl", requireAuth, btlRouter);
app.use("/reports", requireAuth, reportsRouter);
app.use("/gdpr", requireAuth, gdprRouter);
app.use("/imports", requireAuth, importsRouter);

// --- Start (Fly.io PORT) ---
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Backend listening on 0.0.0.0:${PORT}`));
