import IORedis from "ioredis";

export const redisConnection = new IORedis({
  host: "redis",
  port: 6379,
  maxRetriesPerRequest: null
});

// import IORedis from "ioredis";

// export const redisConnection = new IORedis({
//   host: "127.0.0.1",
//   port: 6379,
//   maxRetriesPerRequest: null,
// });