import Redis from "ioredis";

let client: Redis | null = null;

function createRedis(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  const instance = new Redis(url, {
    maxRetriesPerRequest: 2,
    enableOfflineQueue: true,
    lazyConnect: false
  });
  return instance;
}

export function getRedis(): Redis | null {
  if (client) return client;
  client = createRedis();
  return client;
}

export function redisEnabled(): boolean {
  return !!process.env.REDIS_URL;
}


