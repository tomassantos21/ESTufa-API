const redis = require('redis');

let redisClient = null;
let isReady = false;

// Initialize Redis if REDIS_URL is provided in environment variables
if (process.env.REDIS_URL) {
    redisClient = redis.createClient({
        url: process.env.REDIS_URL,
        // Add reconnect strategy so the API doesn't crash if Redis is restarting/down
        socket: {
            reconnectStrategy: (retries) => {
                if (retries > 10) {
                    console.log("Redis reconnect retries exceeded. Disabling cache.");
                    isReady = false;
                    return new Error("Redis reconnect failed");
                }
                return Math.min(retries * 100, 3000);
            }
        }
    });

    redisClient.on('connect', () => console.log('Redis client connecting...'));
    redisClient.on('ready', () => {
        console.log('Redis client connected and ready.');
        isReady = true;
    });
    redisClient.on('error', (err) => {
        console.error('Redis client error:', err.message);
        isReady = false;
    });

    redisClient.connect().catch(() => {
        console.log("Initial Redis connection failed. Caching disabled.");
    });
} else {
    console.log("REDIS_URL not configured. Caching is disabled.");
}

/**
 * Gets cached data by key. Returns null on miss or error.
 */
async function get(key) {
    if (!redisClient || !isReady) return null;
    try {
        const data = await redisClient.get(key);
        return data ? JSON.parse(data) : null;
    } catch (err) {
        console.error(`Cache read error for key "${key}":`, err.message);
        return null;
    }
}

/**
 * Sets data in cache with an optional Time-To-Live (in seconds).
 */
async function set(key, value, ttlSeconds = 300) {
    if (!redisClient || !isReady) return;
    try {
        const payload = JSON.stringify(value);
        await redisClient.set(key, payload, {
            EX: ttlSeconds
        });
    } catch (err) {
        console.error(`Cache write error for key "${key}":`, err.message);
    }
}

/**
 * Deletes key(s) from cache (useful for cache invalidation).
 */
async function del(key) {
    if (!redisClient || !isReady) return;
    try {
        await redisClient.del(key);
    } catch (err) {
        console.error(`Cache delete error for key "${key}":`, err.message);
    }
}

module.exports = {
    get,
    set,
    del
};
