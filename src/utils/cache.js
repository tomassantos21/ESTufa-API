const redis = require('redis');

let redisClient = null;
let isReady = false;
let connectPromise = null;

// Create the Redis client instance but DO NOT connect at module load time
if (process.env.REDIS_URL) {
    redisClient = redis.createClient({
        url: process.env.REDIS_URL,
        socket: {
            // Reconnection strategy for keeping client alive
            reconnectStrategy: (retries) => {
                if (retries > 5) {
                    console.log("Redis reconnect retries exceeded. Disabling cache.");
                    isReady = false;
                    connectPromise = null;
                    return false; // Return false to stop reconnecting
                }
                return Math.min(retries * 500, 3000);
            }
        }
    });

    redisClient.on('connect', () => console.log('Redis client initiating connection...'));
    redisClient.on('ready', () => {
        console.log('Redis client connected and ready.');
        isReady = true;
    });
    redisClient.on('error', (err) => {
        console.error('Redis client error:', err.message);
        isReady = false;
        // Reset connectPromise if we lose connection so we can attempt reconnect on next request
        connectPromise = null;
    });
} else {
    console.log("REDIS_URL not configured. Caching is disabled.");
}

/**
 * Ensures the Redis client is connected before performing any operation.
 * Utilizes lazy-loading and caches the connection promise to prevent concurrent connection attempts.
 */
async function ensureConnected() {
    if (!redisClient) return false;
    if (isReady) return true;

    if (!connectPromise) {
        connectPromise = redisClient.connect().then(() => {
            isReady = true;
            return true;
        }).catch((err) => {
            console.error("Failed to connect to Redis lazy-load:", err.message);
            isReady = false;
            connectPromise = null; // Reset to allow retry later
            return false;
        });
    }

    return connectPromise;
}

/**
 * Gets cached data by key. Returns null on miss or error.
 */
async function get(key) {
    const connected = await ensureConnected();
    if (!connected) return null;
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
    const connected = await ensureConnected();
    if (!connected) return;
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
    const connected = await ensureConnected();
    if (!connected) return;
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
