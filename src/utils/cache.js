let redisClient = null;
let isReady = false;
let connectPromise = null;

/**
 * Ensures the Redis client is connected before performing any operation.
 * Utilizes complete lazy-loading (both the 'redis' module and the connection promise are deferred).
 * This completely isolates the Azure Functions startup phase from any missing dependencies or networking issues.
 */
async function ensureConnected() {
    // If REDIS_URL is not set, caching is disabled. Return false immediately.
    if (!process.env.REDIS_URL) {
        return false;
    }

    if (isReady) return true;

    if (!connectPromise) {
        connectPromise = (async () => {
            try {
                // LAZY REQUIRE: Import 'redis' only when we first perform a cache operation.
                // This ensures the App startup never crashes if the 'redis' npm package fails to build/deploy in Azure.
                const redis = require('redis');

                if (!redisClient) {
                    redisClient = redis.createClient({
                        url: process.env.REDIS_URL,
                        socket: {
                            reconnectStrategy: (retries) => {
                                if (retries > 5) {
                                    console.log("Redis reconnect retries exceeded. Disabling cache.");
                                    isReady = false;
                                    connectPromise = null;
                                    return false; // Stop reconnecting
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
                        connectPromise = null; // Allow reconnect on next trigger
                    });
                }

                await redisClient.connect();
                isReady = true;
                return true;
            } catch (err) {
                console.error("Failed to lazy-load or connect to Redis:", err.message);
                isReady = false;
                connectPromise = null; // Allow retry on next trigger
                return false;
            }
        })();
    }

    return connectPromise;
}

/**
 * Gets cached data by key. Returns null on miss or error.
 */
async function get(key) {
    try {
        const connected = await ensureConnected();
        if (!connected || !redisClient) return null;
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
    try {
        const connected = await ensureConnected();
        if (!connected || !redisClient) return;
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
    try {
        const connected = await ensureConnected();
        if (!connected || !redisClient) return;
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
