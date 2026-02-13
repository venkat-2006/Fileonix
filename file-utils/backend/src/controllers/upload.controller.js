import { conversionQueue } from "../queues/conversion.queue.js";
import { v4 as uuidv4 } from "uuid";

export const uploadFiles = async (req, res) => {
  try {
    const { conversionType } = req.body;

    const jobId = uuidv4(); // ✅ generate jobId properly

    await conversionQueue.add(
      "conversion",          // ✅ must match worker name
      { conversionType },    // ✅ payload
      {
        jobId,
        removeOnComplete: false,
        removeOnFail: false,
      }
    );

    res.json({
      jobId,
      status: "queued",
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Upload failed" });
  }
};
