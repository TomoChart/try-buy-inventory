import { Router } from "express";
const router = Router();

/**
 * In-memory stub (zamijenit ćemo DB-om)
 * country: HR/SI/RS
 * program_available_for: ['students','general']
 */
const devices = [
  { id: "d1", country: "HR", model: "Fold7", imei: "111", serial: "S-001", status: "Available", program_available_for: ["students","general"] },
  { id: "d2", country: "HR", model: "S24",   imei: "222", serial: "S-002", status: "OnLoan",   program_available_for: ["students"] },
];

router.get("/", (req, res) => {
  const { country, model, status } = req.query;
  let out = devices;
  if (country) out = out.filter(d => d.country === country);
  if (model) out = out.filter(d => d.model === model);
  if (status) out = out.filter(d => d.status === status);
  res.json({ items: out });
});

router.post("/", (req, res) => {
  const { country, model, imei, serial, status = "Available", program_available_for = ["students","general"] } = req.body || {};
  if (!country || !model || !imei) return res.status(400).json({ error: "country, model, imei are required" });
  const id = `d${Date.now()}`;
  const item = { id, country, model, imei, serial, status, program_available_for };
  devices.push(item);
  res.status(201).json(item);
});

router.patch("/:id", (req, res) => {
  const i = devices.findIndex(d => d.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: "not found" });
  devices[i] = { ...devices[i], ...req.body };
  res.json(devices[i]);
});

export default router;
