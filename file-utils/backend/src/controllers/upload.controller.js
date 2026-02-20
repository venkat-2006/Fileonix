import { conversionQueue } from "../queues/conversion.queue.js";

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

    //  NEW OPTIONAL FIELDS
    expiryMinutes,
    expiryHours,
  } = req.body;

  console.log("📥 Upload received");
  console.log("🆔 Job:", jobId);
  console.log("🔧 Conversion:", conversionType);
  console.log("🌍 Language:", language || "eng");

  //  Basic validation (prevents worker errors)
  if (!conversionType) {
    return res.status(400).json({ error: "conversionType required" });
  }

  //  Special validation for similarity
  if (conversionType === "pdf->similarity" && req.files.length !== 2) {
    return res.status(400).json({
      error: "Exactly 2 PDFs required for similarity comparison",
    });
  }

  await conversionQueue.add(
    "convert",
    {
      jobId,
      conversionType,
      watermarkText,
      password,
      angle,
      order,
      pages,
      language: language || "eng",

      //  Pass expiry settings
      expiryMinutes,
      expiryHours,

      files: req.files,
    },
    {
      jobId: jobId,          //  CRITICAL FIX (keep this)
      removeOnComplete: false,
      removeOnFail: false,
    }
  );

  res.json({
    jobId,
    status: "queued",
  });
};