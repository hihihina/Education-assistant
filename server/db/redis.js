import { createClient } from 'redis';
import { config } from '../config.js';

const redisClient = createClient({
    socket: {
        host: config.redis.host,
        port: config.redis.port,
    },
    password: config.redis.password || undefined,
});

redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
    console.log('Redis connected successfully');
});

export async function connectRedis() {
    await redisClient.connect();
}

export const TokenBlacklist = {
    async add(token, expiresIn) {
        const key = `blacklist:${token}`;
        await redisClient.setEx(key, expiresIn, '1');
    },

    async has(token) {
        const key = `blacklist:${token}`;
        const result = await redisClient.exists(key);
        return result === 1;
    },
};

export const SessionStore = {
    async set(userId, sessionId, data, expiresIn = 7 * 24 * 60 * 60) {
        const key = `session:${userId}:${sessionId}`;
        await redisClient.setEx(key, expiresIn, JSON.stringify(data));
    },

    async get(userId, sessionId) {
        const key = `session:${userId}:${sessionId}`;
        const data = await redisClient.get(key);
        return data ? JSON.parse(data) : null;
    },

    async delete(userId, sessionId) {
        const key = `session:${userId}:${sessionId}`;
        await redisClient.del(key);
    },

    async deleteAll(userId) {
        const keys = await redisClient.keys(`session:${userId}:*`);
        if (keys.length > 0) {
            await redisClient.del(keys);
        }
    },
};

export default redisClient;
