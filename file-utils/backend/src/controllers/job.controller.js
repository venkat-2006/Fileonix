import { conversionQueue } from "../queues/conversion.queue.js";

export const getJobStatus = async (req, res) => {
  const { jobId } = req.params;

  const job = await conversionQueue.getJob(jobId);

  if (!job) {
    return res.status(404).json({
      jobId,
      status: "not_found",
    });
  }

  const state = await job.getState();
  const progress = job.progress ?? 0;

  const mapStatus = (state) => {
    if (state === "waiting") return "queued";
    if (state === "active") return "processing";
    if (state === "completed") return "completed";
    if (state === "failed") return "failed";
    return state;
  };

  res.json({
    jobId,
    status: mapStatus(state),
    progress,
  });
};
