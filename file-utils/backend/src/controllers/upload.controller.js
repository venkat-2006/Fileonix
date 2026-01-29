import { validateFiles } from "../utils/fileValidation.js";
import { createJob } from "../services/job.service.js";

export function uploadFiles(req, res) {
  try {
    const { conversionType } = req.body;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    validateFiles(files, conversionType);

    const job = {
      jobId: req.jobId,
      status: "uploaded",
      conversionType,
      inputFiles: files.map(f => f.path),
      createdAt: new Date().toISOString()
    };

    createJob(job);

    res.json({
      jobId: job.jobId,
      status: job.status
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}
