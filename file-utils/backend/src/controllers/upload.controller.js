import { conversionQueue } from "../queues/conversion.queue.js";

export const uploadFiles = async (req, res) => {
  const jobId = req.jobId;
  const { conversionType } = req.body;

  console.log("📥 Upload received");
  console.log("🆔 Job:", jobId);

  await conversionQueue.add("convert", {
    jobId,
    conversionType,
    files: req.files,
  });

  res.json({
    jobId,
    status: "queued",
  });
};
