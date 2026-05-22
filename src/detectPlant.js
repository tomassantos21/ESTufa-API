const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const createVisionClient = require('@azure-rest/ai-vision-image-analysis').default;
const { AzureKeyCredential } = require('@azure/core-auth');
const cache = require('./utils/cache');

// Plant-related tags to look for in the Azure Vision response
const PLANT_TAGS = [
    'plant', 'flower', 'tree', 'leaf', 'grass', 'shrub', 'herb', 'fern',
    'succulent', 'cactus', 'moss', 'bush', 'vegetation', 'garden', 'botanical',
    'flora', 'foliage', 'bloom', 'blossom', 'petal', 'stem', 'root', 'branch',
    'monstera', 'palm', 'rose', 'tulip', 'orchid', 'sunflower', 'daisy',
    'lavender', 'bamboo', 'ivy', 'vine', 'weed', 'wildflower', 'algae'
];

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

            // --- Azure Computer Vision Analysis ---
            const endpoint = process.env.AI_SERVICE_ENDPOINT;
            const key = process.env.AI_SERVICE_KEY;

            if (!endpoint || !key) {
                throw new Error("Azure AI service credentials are not configured.");
            }

            const visionClient = createVisionClient(endpoint, new AzureKeyCredential(key));

            context.log(`Analyzing image: ${imageUrl}`);

            const visionResult = await visionClient.path('/imageanalysis:analyze').post({
                body: { url: imageUrl },
                queryParameters: {
                    features: ['Tags'],
                    'api-version': '2023-10-01',
                    language: 'en'
                }
            });

            if (visionResult.status !== '200') {
                context.error('Vision API error:', visionResult.body);
                throw new Error(`Vision API returned status ${visionResult.status}`);
            }

            const { tagsResult, captionResult } = visionResult.body;
            const allTags = tagsResult?.values ?? [];

            context.log(`Vision tags: ${allTags.map(t => t.name).join(', ')}`);

            // Find the most confident plant-related tag
            const plantTags = allTags
                .filter(tag => PLANT_TAGS.some(pt => tag.name.toLowerCase().includes(pt)))
                .sort((a, b) => b.confidence - a.confidence);

            const isPlant = plantTags.length > 0;
            const topPlantTag = plantTags[0];

            // Build a human-readable plant name from the best matching tag
            const plantName = isPlant
                ? topPlantTag.name.charAt(0).toUpperCase() + topPlantTag.name.slice(1)
                : "Not a plant";

            const caption = captionResult?.text ?? null;
            const confidence = isPlant ? topPlantTag.confidence : 0;

            // All detected tags as a simple array of strings
            const detectedTags = allTags.map(t => t.name);

            const plantResult = {
                id: Date.now().toString(),
                userId: userId || "anonymous",
                username: username || "Anonymous",
                imageUrl,
                plantName,
                scientificName: isPlant ? plantName : "N/A",
                confidence,
                description: caption ?? (isPlant
                    ? `Identified as ${plantName} with ${Math.round(confidence * 100)}% confidence.`
                    : "The image does not appear to contain a plant."),
                detectedTags,
                isPlant,
                timestamp: new Date().toISOString()
            };

            // Save to Cosmos DB
            const cosmosClient = new CosmosClient(process.env.COSMOS_DB_CONNECTION);
            const container = cosmosClient.database('estufa-db').container('plants');
            await container.items.create(plantResult);

            // Invalidate the public feed cache and the user's gallery cache
            try {
                await cache.del('plants:feed');
                if (username) {
                    await cache.del(`plants:gallery:${username}`);
                }
            } catch (cacheErr) {
                context.error('Failed to invalidate cache:', cacheErr.message);
            }

            return { jsonBody: plantResult };
        } catch (error) {
            context.error('detectPlant error:', error.message);
            return { status: 500, jsonBody: { error: "Failed to detect plant", details: error.message } };
        }
    }
});
