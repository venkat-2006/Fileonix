import { conversionQueue } from "../queues/conversion.queue.js";

export const uploadFiles = async (req, res) => {
  const jobId = req.jobId;

  const { 
    conversionType, 
    watermarkText, 
    password,
    angle,
    order,
    pages   //  ADD THIS
  } = req.body;

  console.log("📥 Upload received");
  console.log("🆔 Job:", jobId);
  console.log("🔧 Conversion:", conversionType);

  await conversionQueue.add("convert", {
    jobId,
    conversionType,
    watermarkText,
    password,
    angle,
    order,
    pages,          //  PASS TO WORKER
    files: req.files,
  });

  res.json({
    jobId,
    status: "queued",
  });
};
