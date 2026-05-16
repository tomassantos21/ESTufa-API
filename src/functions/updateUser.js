const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');

app.http('updateUser', {
    methods: ['PUT'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const body = await request.json();
            const { username, fullName, email, bio, avatarUrl } = body;

            if (!username) {
                return { status: 400, jsonBody: { error: "Username is required" } };
            }

            const client = new CosmosClient(process.env.COSMOS_DB_CONNECTION);
            const container = client.database('estufa-db').container('users');

            try {
                const { resource: user } = await container.item(username, username).read();
                
                if (!user) {
                    return { status: 404, jsonBody: { error: "User not found" } };
                }

                // Update fields
                if (fullName !== undefined) user.fullName = fullName;
                if (email !== undefined) user.email = email;
                if (bio !== undefined) user.bio = bio;
                if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;

                await container.items.upsert(user);

                const { passwordHash, ...userResponse } = user;
                return { jsonBody: userResponse };
            } catch (err) {
                if (err.code === 404) {
                    return { status: 404, jsonBody: { error: "User not found" } };
                }
                throw err;
            }
        } catch (error) {
            context.log.error(error);
            return { status: 500, jsonBody: { error: "Failed to update user" } };
        }
    }
});
