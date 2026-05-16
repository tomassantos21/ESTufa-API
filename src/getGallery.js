const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');

app.http('getGallery', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const username = request.query.get('username');
            
            if (!username) {
                return { status: 400, jsonBody: { error: "Username is required" } };
            }

            const client = new CosmosClient(process.env.COSMOS_DB_CONNECTION);
            const container = client.database('estufa-db').container('plants');

            const querySpec = {
                query: "SELECT * FROM c WHERE c.username = @username ORDER BY c.timestamp DESC",
                parameters: [{ name: "@username", value: username }]
            };
            
            const { resources: gallery } = await container.items.query(querySpec).fetchAll();

            return { jsonBody: gallery };
        } catch (error) {
            context.log.error(error);
            return { status: 500, jsonBody: { error: "Failed to fetch gallery" } };
        }
    }
});
