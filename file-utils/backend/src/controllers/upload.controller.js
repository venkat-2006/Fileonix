import { conversionQueue } from "../queues/conversion.queue.js";
import { getUserStats } from "../services/stats.service.js";
import { enforceLimits } from "../services/limits.service.js";
import {
  incrementJobStats,
  incrementOCRStats
} from "../services/stats-update.service.js";
import { supabase } from "../config/supabase.js";
import { validateFiles } from "../utils/fileValidation.js";

const OCR_JOB_TYPES = [
  "pdf->ocr",
  "image->txt",
  "image->searchable-pdf",
  "pdf->searchable-pdf"
];

export const uploadFiles = async (req, res) => {

  const jobId = req.jobId;

  const {
    conversionType,
    watermarkText,
    password,
    angle,
    order,
    pages,
    language,
    expiryMinutes,
    expiryHours
  } = req.body;

  try {

    if (!conversionType) {
      return res.status(400).json({
        error: "conversionType required"
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        error: "No files uploaded"
      });
    }

    // Validate conversion + extensions
    validateFiles(req.files, conversionType);

    // Special rule: similarity requires 2 PDFs
    if (
      conversionType === "pdf->similarity" &&
      req.files.length !== 2
    ) {
      return res.status(400).json({
        error: "Exactly 2 PDFs required for similarity comparison"
      });
    }

    // Special rule: merge requires at least 2 PDFs
    if (
      conversionType === "pdf->merge" &&
      req.files.length < 2
    ) {
      return res.status(400).json({
        error: "At least 2 PDFs required for merge"
      });
    }

    const userId = req.user.id;

    /* ---------------- USER LIMITS ---------------- */

    const stats = await getUserStats(userId);

    enforceLimits(stats, conversionType);

    /* ---------------- CREATE JOB ---------------- */

    const { error: insertError } = await supabase
      .from("jobs")
      .insert({
        id: jobId,
        user_id: userId,
        conversion_type: conversionType,
        status: "queued"
      });

    if (insertError) {
      throw new Error(insertError.message);
    }

    /* ---------------- QUEUE JOB ---------------- */

    await conversionQueue.add(
      "convert",
      {
        jobId,
        userId,
        conversionType,
        watermarkText,
        password,
        angle,
        order,
        pages,
        language: language || "eng",
        expiryMinutes,
        expiryHours,
        files: req.files
      },
      {
        jobId,
        removeOnComplete: {
          age: 3600,
          count: 1000
        },
        removeOnFail: {
          age: 86400
        }
      }
    );

    /* ---------------- UPDATE STATS ---------------- */

    await incrementJobStats(userId);

    if (OCR_JOB_TYPES.includes(conversionType)) {
      await incrementOCRStats(userId);
    }

    /* ---------------- RESPONSE ---------------- */

    return res.json({
      jobId,
      status: "queued"
    });

  } catch (err) {

    console.error("Upload error:", err.message);

    return res.status(400).json({
      error: err.message
    });

  }

};