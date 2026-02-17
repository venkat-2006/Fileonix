import { Router } from "express";
import { /* createJob, */ getJobStatus } from "../controllers/job.controller.js";
import fs from "../utils/fsSafe.js";
import { zipJobResults } from "../utils/zip.utils.js";

const router = Router();

// Create job
// router.post("/", createJob);

// Job status
router.get("/:jobId", getJobStatus);

// Download ZIP
router.get("/:jobId/zip", async (req, res) => {
  const { jobId } = req.params;

  try {
    console.log("📦 ZIP requested:", jobId);

    const zipPath = await zipJobResults(jobId);

    if (!fs.existsSync(zipPath)) {
      return res.status(404).json({
        error: "ZIP not created",
      });
    }

    res.download(zipPath, `results.zip`);
  } catch (err) {
    console.error("❌ ZIP error:", err.message);

    res.status(500).json({
      error: err.message,
    });
  }
});

export default router;
