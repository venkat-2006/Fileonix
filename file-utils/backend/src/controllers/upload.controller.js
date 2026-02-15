import { conversionQueue } from "../queues/conversion.queue.js";

export const uploadFiles = async (req, res) => {
  const jobId = req.jobId;
  const { conversionType, watermarkText, password } = req.body;  //  Add password

  console.log("📥 Upload received");
  console.log("🆔 Job:", jobId);

  await conversionQueue.add("convert", {
    jobId,
    conversionType,
    watermarkText,
    password,  //  Pass password to queue
    files: req.files,
  });

  res.json({
    jobId,
    status: "queued",
  });
};