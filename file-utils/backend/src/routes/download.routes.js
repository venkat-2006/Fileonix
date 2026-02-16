import express from "express";
import fs from "fs";
import { zipJobResults } from "../utils/zip.utils.js";

const router = express.Router();

router.get("/:jobId", async (req, res) => {
  const { jobId } = req.params;

  try {
    const zipPath = await zipJobResults(jobId);

    if (!fs.existsSync(zipPath)) {
      return res.status(404).json({ error: "ZIP not created" });
    }

    res.download(zipPath, "results.zip");
  } catch (err) {
    console.error("❌ ZIP error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
