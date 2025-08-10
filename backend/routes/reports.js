import { Router } from "express";
const router = Router();

// Stub – kasnije ćemo računati iz DB-a
router.get("/weekly", (req, res) => {
  const { country = "HR" } = req.query;
  res.json({
    country,
    utilizationPct: 0.0,
    avgQueueDaysByModel: [],
    counts: { applied: 0, issued: 0, returned: 0 }
  });
});

export default router;
