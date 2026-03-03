import Redis from 'ioredis';

// Connect to Redis mapped on 6379 in Docker
const redis = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379'),
});

redis.on('error', (err) => {
  console.error('[Redis] Connection Error:', err);
});

redis.on('connect', () => {
  console.log('[Redis] Connected successfully');
});

/**
 * Stores a room/message or active session data with a strict 3600 seconds TTL.
 * No data is persisted beyond this hour constraint.
 */
export const ephemeralSet = async (key: string, value: string) => {
  // SETEX enforces strict TTL
  await redis.setex(key, 3600, value);
};

export const ephemeralListPush = async (listKey: string, payload: string) => {
  // Refresh the list TTL to 3600 each time a message pushes
  const pipeline = redis.pipeline();
  pipeline.rpush(listKey, payload);
  pipeline.expire(listKey, 3600);
  await pipeline.exec();
};

export const ephemeralGet = async (key: string) => {
    return await redis.get(key);
};

export const ephemeralListGet = async (listKey: string, start=0, end=-1) => {
    return await redis.lrange(listKey, start, end);
};

export default redis;
