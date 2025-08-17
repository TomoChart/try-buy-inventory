
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

dotenv.config();

const app = express();
app.use(express.json());

// CORS: dinamički origin i preflight
const allowed = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
  : [];

app.use(cors({
  origin: function (origin, cb) {
    // dopusti zahtjeve bez Origin (npr. curl/healthz) i one s dopuštene domene
    if (!origin || allowed.includes(origin)) return cb(null, true);
    return cb(new Error('CORS not allowed'), false);
  },
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: false
}));
// preflight za sve rute
app.options('*', cors());

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
app.get('/', (req, res) => {
  res.send({ status: 'OK', message: 'Try Buy Backend API running' });
});

app.get('/healthz', (req, res) => {
  res.status(200).send({ status: 'healthy' });
});


// Novi sigurni blok za login
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // dohvat korisnika po emailu (ne po id-u)
    const user = await prisma.user.findFirst({ where: { email } });
    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // usporedba lozinke
    const ok = await bcrypt.compare(String(password), String(user.passwordHash));
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    // JWT payload
    const payload = { id: user.id, email: user.email, role: user.role, countryId: user.countryId };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

    return res.json({ token });
  } catch (e) {
    console.error('LOGIN_ERROR', e);
    return res.status(500).json({ error: 'Login failed' });
  }
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

app.get("/countries", async (req, res) => {
  try {
    const countries = await prisma.country.findMany({
      select: { id: true, code: true },
      orderBy: { code: "asc" },
    });
    res.json(countries);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch countries" });
  }
});

// --- helpers: dohvat zemlje i keš ---
const countryCache = new Map(); // code -> { id, code }
async function getCountryByCode(code) {
  const key = String(code || "").toUpperCase();
  if (!key) return null;
  if (countryCache.has(key)) return countryCache.get(key);
  const c = await prisma.country.findUnique({ where: { code: key } });
  if (c) countryCache.set(key, c);
  return c;
}

// --- MOCK uređaji (dok ne uvedemo Device model) ---
const demoDevices = [
  { id: 1, imei: "356789012345671", model: "Galaxy Fold7", status: "active",   location: "Zagreb",   countryCode: "HR", updatedAt: new Date().toISOString() },
  { id: 2, imei: "356789012345672", model: "Galaxy Fold7", status: "inactive", location: "Split",    countryCode: "HR", updatedAt: new Date().toISOString() },
  { id: 3, imei: "356789012345673", model: "Galaxy S24",   status: "active",   location: "Ljubljana",countryCode: "SI", updatedAt: new Date().toISOString() },
  { id: 4, imei: "356789012345674", model: "Galaxy A55",   status: "active",   location: "Maribor",  countryCode: "SI", updatedAt: new Date().toISOString() },
  { id: 5, imei: "356789012345675", model: "Galaxy Fold7", status: "active",   location: "Beograd",  countryCode: "RS", updatedAt: new Date().toISOString() },
  { id: 6, imei: "356789012345676", model: "Galaxy S24",   status: "inactive", location: "Novi Sad", countryCode: "RS", updatedAt: new Date().toISOString() },
  { id: 7, imei: "356789012345677", model: "Galaxy A35",   status: "active",   location: "Zagreb",   countryCode: "HR", updatedAt: new Date().toISOString() },
  { id: 8, imei: "356789012345678", model: "Galaxy Fold7", status: "active",   location: "Celje",    countryCode: "SI", updatedAt: new Date().toISOString() },
  { id: 9, imei: "356789012345679", model: "Galaxy S24",   status: "active",   location: "Niš",      countryCode: "RS", updatedAt: new Date().toISOString() },
  { id:10, imei: "356789012345680", model: "Galaxy A55",   status: "active",   location: "Rijeka",   countryCode: "HR", updatedAt: new Date().toISOString() },
];

// --- KPI: /stats?code=hr ---
app.get("/stats", async (req, res) => {
  try {
    const code = String(req.query.code || "").toUpperCase();
    const c = await getCountryByCode(code);
    if (!c) return res.status(400).json({ error: "Unknown country code" });

    // realni podatak iz DB-a koji već imamo
    const users = await prisma.user.count({ where: { countryId: c.id } });

    // mock za sada (dok ne uvedemo tablice)
    const devicesActive = demoDevices.filter(d => d.countryCode === code && d.status === "active").length;
    const tryAndBuyActive = 0;       // TODO: zamijeniti kad dodamo T&B tablicu
    const galaxyTryActivations = 0;  // TODO: zamijeniti kad dodamo Galaxy Try evidenciju

    res.json({
      country: { id: c.id, code: c.code },
      kpi: {
        devicesActive,
        tryAndBuyActive,
        galaxyTryActivations,
        users,
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load stats" });
  }
});

// --- Devices (mock): /devices?code=hr&page=1&pageSize=10&search=fold ---
app.get("/devices", async (req, res) => {
  try {
    const code = String(req.query.code || "").toUpperCase();
    const c = await getCountryByCode(code);
    if (!c) return res.status(400).json({ error: "Unknown country code" });

    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || "10", 10)));
    const search = String(req.query.search || "").toLowerCase();

    let rows = demoDevices.filter(d => d.countryCode === code);
    if (search) {
      rows = rows.filter(d =>
        d.imei.toLowerCase().includes(search) ||
        d.model.toLowerCase().includes(search) ||
        d.location.toLowerCase().includes(search)
      );
    }

    const total = rows.length;
    const start = (page - 1) * pageSize;
    const items = rows.slice(start, start + pageSize);

    res.json({ total, page, pageSize, items });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load devices" });
  }
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
