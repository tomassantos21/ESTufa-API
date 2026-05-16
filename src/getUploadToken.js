const { app } = require('@azure/functions');
const { StorageSharedKeyCredential, BlobServiceClient, generateBlobSASQueryParameters, BlobSASPermissions } = require('@azure/storage-blob');

app.http('getUploadToken', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const fileName = request.query.get('fileName') || `upload-${Date.now()}.jpg`;
            const containerName = 'fotos-plantas';
            const connectionString = process.env.BLOB_CONNECTION_STRING;
            
            const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
            const containerClient = blobServiceClient.getContainerClient(containerName);
            const blobClient = containerClient.getBlobClient(fileName);

            const sasOptions = {
                containerName,
                blobName: fileName,
                permissions: BlobSASPermissions.parse("racwd"),
                startsOn: new Date(),
                expiresOn: new Date(new Date().valueOf() + 3600 * 1000),
            };

            const sasToken = generateBlobSASQueryParameters(sasOptions, blobServiceClient.credential).toString();
            const sasUrl = `${blobClient.url}?${sasToken}`;

            return { jsonBody: { sasUrl, blobUrl: blobClient.url } };
        } catch (error) {
            context.log.error(error);
            return { status: 500, jsonBody: { error: "Failed to generate token" } };
        }
    }
});
