const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const cache = require('./utils/cache');

app.http('getGallery', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const username = request.query.get('username');
            
            if (!username) {
                return { status: 400, jsonBody: { error: "Username is required" } };
            }

            // Try to retrieve the gallery from cache first
            const cacheKey = `plants:gallery:${username}`;
            const cachedGallery = await cache.get(cacheKey);
            if (cachedGallery) {
                context.log(`Returning gallery for user "${username}" from Redis cache.`);
                return { jsonBody: cachedGallery };
            }

            const client = new CosmosClient(process.env.COSMOS_DB_CONNECTION);
            const container = client.database('estufa-db').container('plants');

            const querySpec = {
                query: "SELECT * FROM c WHERE c.username = @username ORDER BY c.timestamp DESC",
                parameters: [{ name: "@username", value: username }]
            };
            
            const { resources: gallery } = await container.items.query(querySpec).fetchAll();

            // Cache the user's gallery for 5 minutes (300 seconds)
            await cache.set(cacheKey, gallery, 300);

            return { jsonBody: gallery };
        } catch (error) {
            context.error(error);
            return { status: 500, jsonBody: { error: "Failed to fetch gallery" } };
        }
    }
});
