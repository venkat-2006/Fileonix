import { conversionQueue } from "../queues/conversion.queue.js";
import { v4 as uuidv4 } from "uuid";

export const createJob = async (req, res) => {
  const { conversionType } = req.body;

  const jobId = uuidv4();

  const job = await conversionQueue.add(
    "conversion",
    { conversionType },
    {
      jobId,
      removeOnComplete: false, // KEEP job after completion
      removeOnFail: false,
    }
  );

  res.status(201).json({
    jobId: job.id,
    status: "queued",
  });
};

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

  const mapStatus = (state) => {
    if (state === "waiting") return "queued";
    if (state === "active") return "processing";
    return state;
  };

  res.json({
    jobId,
    status: mapStatus(state),
  });
};
