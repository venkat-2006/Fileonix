import express from "express";
import { verifyAuth } from "../middleware/auth.js";
import { getUserStats } from "../services/stats.service.js";

const router = express.Router();

router.get("/users/me/stats", verifyAuth, async (req, res) => {
  try {
    const stats = await getUserStats(req.user.id);

    const MAX_JOBS_PER_DAY = 10;

    res.json({
      jobsToday: stats.jobs_today,
      remainingJobs: MAX_JOBS_PER_DAY - stats.jobs_today,
      ocrToday: stats.ocr_today,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;