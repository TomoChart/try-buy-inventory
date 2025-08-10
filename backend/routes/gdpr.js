import { Router } from "express";
const router = Router();

const gdprQueue = []; // { application_id, ready_on, confirmed_deleted_at }

router.get("/pending", (_req, res) => res.json({ items: gdprQueue }));

router.post("/delete/:applicationId", (req, res) => {
  const { applicationId } = req.params;
  const i = gdprQueue.findIndex(x => x.application_id === applicationId);
  if (i >= 0) gdprQueue.splice(i, 1);
  res.json({ ok: true, deleted: applicationId });
});

export default router;
