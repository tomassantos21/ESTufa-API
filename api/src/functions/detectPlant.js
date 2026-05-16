const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');

app.http('detectPlant', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const body = await request.json();
            const { imageUrl, userId, username } = body;

            if (!imageUrl) {
                return { status: 400, jsonBody: { error: "imageUrl is required" } };
            }

            // 1. Call Azure Computer Vision API
            const aiEndpoint = process.env.AI_SERVICE_ENDPOINT;
            const aiKey = process.env.AI_SERVICE_KEY;
            
            // Using Azure Computer Vision 4.0 API
            const apiUrl = `${aiEndpoint}computervision/imageanalysis:analyze?features=Tags,Caption&api-version=2023-10-01`;
            
            const aiResponse = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Ocp-Apim-Subscription-Key': aiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ url: imageUrl })
            });

            if (!aiResponse.ok) {
                const err = await aiResponse.text();
                throw new Error(`AI API Error: ${err}`);
            }

            const aiData = await aiResponse.json();
            
            // 2. Parse AI Response
            let plantName = "Planta Desconhecida";
            let confidence = 0;
            let description = aiData.captionResult?.text || "Não foi possível descrever a imagem.";

            if (aiData.tagsResult && aiData.tagsResult.values.length > 0) {
                // Find a tag that might be a plant (often generic in basic AI Vision)
                const bestTag = aiData.tagsResult.values.find(t => t.confidence > 0.5) || aiData.tagsResult.values[0];
                plantName = bestTag.name;
                confidence = bestTag.confidence;
            }

            const resultObj = {
                id: Date.now().toString(),
                userId: userId || 'guest',
                username: username || 'Visitante',
                imageUrl,
                plantName: plantName.charAt(0).toUpperCase() + plantName.slice(1),
                scientificName: "Nome científico (Automático)", 
                confidence: confidence,
                description: description,
                timestamp: new Date().toISOString()
            };

            // 3. Save to Cosmos DB
            const cosmosConn = process.env.COSMOS_DB_CONNECTION;
            const client = new CosmosClient(cosmosConn);
            const database = client.database('estufa-db');
            const container = database.container('plants');

            await container.items.create(resultObj);

            return {
                status: 200,
                jsonBody: resultObj
            };
        } catch (error) {
            context.log.error(error);
            return { status: 500, jsonBody: { error: error.message } };
        }
    }
});
