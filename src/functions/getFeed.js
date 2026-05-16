const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');

app.http('getFeed', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const client = new CosmosClient(process.env.COSMOS_DB_CONNECTION);
            const container = client.database('estufa-db').container('plants');

            const querySpec = {
                query: "SELECT * FROM c ORDER BY c.timestamp DESC"
            };
            
            const { resources: feed } = await container.items.query(querySpec).fetchAll();

            return { jsonBody: feed };
        } catch (error) {
            context.log.error(error);
            return { status: 500, jsonBody: { error: "Failed to fetch feed" } };
        }
    }
});
