const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');

app.http('getFeed', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const cosmosConn = process.env.COSMOS_DB_CONNECTION;
            const client = new CosmosClient(cosmosConn);
            const database = client.database('estufa-db');
            const container = database.container('plants');

            // Fetch all scans ordered by newest first
            const querySpec = {
                query: "SELECT * from c ORDER BY c.timestamp DESC"
            };

            const { resources: items } = await container.items
                .query(querySpec)
                .fetchAll();

            return {
                status: 200,
                jsonBody: items
            };
        } catch (error) {
            context.log.error(error);
            return { status: 500, jsonBody: { error: error.message } };
        }
    }
});
