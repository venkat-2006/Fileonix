import { Router } from "express";
import { getJobStatus } from "../controllers/job.controller.js";
import { verifyAuth } from "../middleware/auth.js";
import fs from "../utils/fsSafe.js";
import { zipJobResults } from "../utils/zip.utils.js";
import { supabase } from "../config/supabase.js";

const router = Router();

// ✅ Get current user's job history
router.get("/me", verifyAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    res.json(data);

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ✅ Get specific job status (secure)
router.get("/:jobId", verifyAuth, async (req, res) => {
  const { jobId } = req.params;

  try {
    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", req.user.id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "Job not found" });
    }

    res.json(data);

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ✅ Download ZIP (secure)
router.get("/:jobId/zip", verifyAuth, async (req, res) => {
  const { jobId } = req.params;

  try {
    const { data, error } = await supabase
      .from("jobs")
      .select("id")
      .eq("id", jobId)
      .eq("user_id", req.user.id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "Job not found" });
    }

    const zipPath = await zipJobResults(jobId);

    if (!fs.existsSync(zipPath)) {
      return res.status(404).json({ error: "ZIP not created" });
    }

    res.download(zipPath, "results.zip");

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;