const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const cache = require('./utils/cache');

app.http('getFeed', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            // Try to retrieve the feed from cache first
            const cachedFeed = await cache.get('plants:feed');
            if (cachedFeed) {
                context.log("Returning feed from Redis cache.");
                return { jsonBody: cachedFeed };
            }

            const client = new CosmosClient(process.env.COSMOS_DB_CONNECTION);
            const container = client.database('estufa-db').container('plants');

            const querySpec = {
                query: "SELECT * FROM c ORDER BY c.timestamp DESC"
            };
            
            const { resources: feed } = await container.items.query(querySpec).fetchAll();

            // Cache the feed for 5 minutes (300 seconds)
            await cache.set('plants:feed', feed, 300);

            return { jsonBody: feed };
        } catch (error) {
            context.error(error);
            return { status: 500, jsonBody: { error: "Failed to fetch feed" } };
        }
    }
});
