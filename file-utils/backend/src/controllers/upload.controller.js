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
    language
  } = req.body;

  console.log("📥 Upload received");
  console.log("🆔 Job:", jobId);
  console.log("🔧 Conversion:", conversionType);
  console.log("🌍 Language:", language || "eng");

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
      files: req.files,
    },
    {
      jobId: jobId,                 // CRITICAL FIX
      removeOnComplete: false,
      removeOnFail: false,
    }
  );

  res.json({
    jobId,
    status: "queued",
  });
};
