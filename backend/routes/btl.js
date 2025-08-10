import { Router } from "express";
const router = Router();

/** Odvojeni BTL inventar (Model A–F, serijski 1–5 kao seed) */
const btl = [
  { id: "b1", country: "HR", device_model: "Model A", imei: "A-111", serial: "1", received_from_client_date: "2025-08-01", current_location: "Zagreb HQ", status: "Available", notes: "" }
];

router.get("/", (req, res) => {
  const { country, status, model } = req.query;
  let out = btl;
  if (country) out = out.filter(x => x.country === country);
  if (status)  out = out.filter(x => x.status === status);
  if (model)   out = out.filter(x => x.device_model === model);
  res.json({ items: out });
});

router.post("/", (req, res) => {
  const { country, device_model, imei, serial, received_from_client_date, current_location = "", status = "Available", notes = "" } = req.body || {};
  if (!country || !device_model || !imei) return res.status(400).json({ error: "country, device_model, imei required" });
  const item = { id: `b${Date.now()}`, country, device_model, imei, serial, received_from_client_date, current_location, status, notes };
  btl.push(item);
  res.status(201).json(item);
});

router.patch("/:id", (req, res) => {
  const i = btl.findIndex(x => x.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: "not found" });
  btl[i] = { ...btl[i], ...req.body };
  res.json(btl[i]);
});

export default router;
