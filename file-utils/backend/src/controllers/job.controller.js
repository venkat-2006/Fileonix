import { getJob } from "../services/job.service.js";

export function getJobStatus(req, res) {
  const job = getJob(req.params.jobId);

  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  res.json(job);
}
