import { Queue } from "bullmq";
import { redisConnection } from "../config/redis.js";

export const conversionQueue = new Queue("conversion-queue", {
  connection: redisConnection,
});
