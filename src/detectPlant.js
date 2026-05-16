const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');

app.http('detectPlant', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const body = await request.json();
            const { imageUrl, userId, username } = body;

            // In a real scenario, you would call process.env.AI_SERVICE_ENDPOINT here.
            // Using a simulated logic for the project
            const isPlant = Math.random() > 0.1;
            
            const plantResult = {
                id: Date.now().toString(),
                userId: userId || "anonymous",
                username: username || "Anonymous",
                imageUrl,
                plantName: isPlant ? "Monstera deliciosa" : "Not a plant",
                scientificName: isPlant ? "Monstera deliciosa" : "N/A",
                confidence: isPlant ? 0.95 : 0.1,
                description: isPlant ? "Uma planta tropical popular de interior com folhas características." : "Não foi possível identificar a planta.",
                timestamp: new Date().toISOString()
            };

            const client = new CosmosClient(process.env.COSMOS_DB_CONNECTION);
            const container = client.database('estufa-db').container('plants');
            
            await container.items.create(plantResult);

            return { jsonBody: plantResult };
        } catch (error) {
            context.log.error(error);
            return { status: 500, jsonBody: { error: "Failed to detect plant" } };
        }
    }
});
