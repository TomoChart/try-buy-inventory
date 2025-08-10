import { Router } from "express";
const router = Router();

/**
 * Applications (students/general), CSV import će puniti ove zapise.
 * status: APPLIED | CONTACTED | ISSUED | ON_LOAN | RETURNED | CLOSED
 */
const apps = [
  { id: "a1", country: "HR", program: "students", full_name: "Ana", username: "ana01", email: "ana@ex.com", phone: "091...", city: "Zagreb", model: null, applied_at: "2025-08-01", status: "APPLIED", notes: "" },
];

router.get("/", (req, res) => {
  const { country, program, status } = req.query;
  let out = apps;
  if (country) out = out.filter(a => a.country === country);
  if (program) out = out.filter(a => a.program === program);
  if (status) out = out.filter(a => a.status === status);
  res.json({ items: out });
});

router.post("/", (req, res) => {
  const { country, program, full_name, username, email, phone, city, model = null } = req.body || {};
  if (!country || !program || !full_name || !email) return res.status(400).json({ error: "country, program, full_name, email required" });
  const item = {
    id: `a${Date.now()}`, country, program, full_name, username, email, phone, city,
    model, applied_at: new Date().toISOString(), status: "APPLIED", notes: ""
  };
  apps.push(item);
  res.status(201).json(item);
});

router.patch("/:id", (req, res) => {
  const i = apps.findIndex(a => a.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: "not found" });
  apps[i] = { ...apps[i], ...req.body };
  res.json(apps[i]);
});

export default router;
