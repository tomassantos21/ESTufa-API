const { app } = require('@azure/functions');
const { BlobServiceClient, BlobSASPermissions } = require('@azure/storage-blob');

app.http('getUploadToken', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const fileName = request.query.get('fileName') || `upload-${Date.now()}.jpg`;
            const containerName = "fotos-plantas";
            const connectionString = process.env.BLOB_CONNECTION_STRING;
            
            if (!connectionString) {
                return { status: 500, jsonBody: { error: "BLOB_CONNECTION_STRING not set" } };
            }

            const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
            const containerClient = blobServiceClient.getContainerClient(containerName);
            const blobClient = containerClient.getBlobClient(fileName);

            const startsOn = new Date();
            const expiresOn = new Date(new Date().valueOf() + 3600 * 1000); // 1 hour

            const sasUrl = await blobClient.generateSasUrl({
                permissions: BlobSASPermissions.parse("rw"), // read and write
                startsOn,
                expiresOn
            });

            return {
                status: 200,
                jsonBody: {
                    sasUrl: sasUrl,
                    blobUrl: blobClient.url,
                    fileName: fileName
                }
            };
        } catch (error) {
            context.log.error(error);
            return { status: 500, jsonBody: { error: error.message } };
        }
    }
});
