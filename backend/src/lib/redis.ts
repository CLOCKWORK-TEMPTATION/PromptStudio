import Redis from 'ioredis';
import { config } from '../config/index.js';

class RedisClient {
  private static instance: Redis | null = null;

  static getInstance(): Redis {
    if (!RedisClient.instance) {
      RedisClient.instance = new Redis(config.redis.url, {
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        lazyConnect: true,
      });

      RedisClient.instance.on('error', (error) => {
        console.error('Redis connection error:', error);
      });

      RedisClient.instance.on('connect', () => {
        console.log('✅ Redis connected');
      });
    }
    return RedisClient.instance;
  }

  static async disconnect(): Promise<void> {
    if (RedisClient.instance) {
      await RedisClient.instance.quit();
      RedisClient.instance = null;
    }
  }
}

export const redis = RedisClient.getInstance();
export default redis;
