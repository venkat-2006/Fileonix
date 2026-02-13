import IORedis from "ioredis";

export const redisConnection = new IORedis({
  host: "redis",
  port: 6379,
  maxRetriesPerRequest: null
});
