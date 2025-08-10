import { Router } from "express";
const router = Router();

/**
 * CSV import stub – u produkciji ćemo parsirati CSV (kolone točno: full_name, username, email, phone, city)
 * i kreirati applications po odabranom programu/zemlji u UI-ju.
 */
router.post("/applications", (_req, res) => {
  res.json({ ok: true, message: "CSV import stub (applications)" });
});

export default router;
