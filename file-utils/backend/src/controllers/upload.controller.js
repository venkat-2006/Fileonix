import { conversionQueue } from "../queues/conversion.queue.js";
import { getUserStats } from "../services/stats.service.js";
import { enforceLimits } from "../services/limits.service.js";
import { incrementJobStats, incrementOCRStats } from "../services/stats-update.service.js";

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
    expiryHours,
  } = req.body;

  if (!conversionType) {
    return res.status(400).json({ error: "conversionType required" });
  }

  if (conversionType === "pdf->similarity" && req.files.length !== 2) {
    return res.status(400).json({
      error: "Exactly 2 PDFs required for similarity comparison",
    });
  }

  try {
    const userId = req.user.id;

    // 1️ Get current stats
    const stats = await getUserStats(userId);

    // 2️ Enforce daily limits
    enforceLimits(stats);

    // 3️ Add job to queue
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
        files: req.files,
      },
      {
        jobId,
        removeOnComplete: false,
        removeOnFail: false,
      }
    );

    // 4️ Increment total jobs
    await incrementJobStats(userId);

    // 5️ Increment OCR usage if applicable
    if (OCR_JOB_TYPES.includes(conversionType)) {
      await incrementOCRStats(userId);
    }

    return res.json({
      jobId,
      status: "queued",
    });

  } catch (err) {
    return res.status(400).json({
      error: err.message,
    });
  }
};