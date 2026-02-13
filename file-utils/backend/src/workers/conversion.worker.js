import { Worker } from "bullmq";
import { redisConnection } from "../config/redis.js";

const worker = new Worker(
  "conversion-queue",
  async (job) => {
    const jobId = job.id;
    const { conversionType } = job.data;

    console.log(`👷 Processing job ${jobId}`);
    console.log(`🔄 Conversion type: ${conversionType}`);

    await new Promise((res) => setTimeout(res, 3000));

    console.log(`✅ Completed job ${jobId}`);

    return { success: true };
  },
  { connection: redisConnection }
);

console.log("🚀 Worker started...");
