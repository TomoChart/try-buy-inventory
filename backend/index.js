import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const app = express();

// CORS: čita iz CORS_ORIGINS (CSV). Ako nije postavljeno, koristi prod domenu.
const allowedOrigins = (process.env.CORS_ORIGINS || "https://try-buy-inventory.vercel.app")
  .split(",")
  .map(s => s.trim());

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

const prisma = new PrismaClient();

// Helpers
function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, countryId: user.countryId ?? null },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function requireAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "No token" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

// Health
app.get("/", (_req, res) => res.send("Backend is running"));
app.get("/healthz", (_req, res) => res.json({ status: "ok" }));

// Auth (DB korisnici; ENV-admin ostaje kao fallback ako ga imaš u kodu/okruženju)
app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const token = signToken(user);
  return res.json({ token, role: user.role, countryId: user.countryId ?? null });
});

// Users CRUD (RBAC: superadmin i country_admin)
app.get("/users", requireAuth, requireRole("superadmin", "country_admin"), async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: { id: "asc" } });
  res.json(users);
});

app.post("/users", requireAuth, requireRole("superadmin", "country_admin"), async (req, res) => {
  const { email, password, role, countryId } = req.body || {};
  if (!email || !password || !role) return res.status(400).json({ error: "Missing fields" });
  const passwordHash = await bcrypt.hash(password, 12);
  const created = await prisma.user.create({ data: { email, passwordHash, role, countryId: countryId ?? null } });
  res.json(created);
});

app.patch("/users/:id", requireAuth, requireRole("superadmin", "country_admin"), async (req, res) => {
  const id = Number(req.params.id);
  const data = { ...req.body };
  if (data.password) {
    data.passwordHash = await bcrypt.hash(data.password, 12);
    delete data.password;
  }
  const updated = await prisma.user.update({ where: { id }, data });
  res.json(updated);
});

app.delete("/users/:id", requireAuth, requireRole("superadmin", "country_admin"), async (req, res) => {
  const id = Number(req.params.id);
  await prisma.user.delete({ where: { id } });
  res.json({ success: true });
});

const PORT = process.env.PORT || 8080;
// VAŽNO: slušaj na 0.0.0.0 da Fly proxy može doći do appa
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
  });

// Graceful shutdown
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
