const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const bcrypt = require('bcryptjs');

app.http('loginUser', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const body = await request.json();
            const { username, password } = body;

            if (!username || !password) {
                return { status: 400, jsonBody: { error: "Username and password are required" } };
            }

            const client = new CosmosClient(process.env.COSMOS_DB_CONNECTION);
            const container = client.database('estufa-db').container('users');

            try {
                const { resource: user } = await container.item(username, username).read();
                
                if (!user) {
                    return { status: 401, jsonBody: { error: "Invalid credentials" } };
                }

                const isMatch = await bcrypt.compare(password, user.passwordHash);

                if (!isMatch) {
                    return { status: 401, jsonBody: { error: "Invalid credentials" } };
                }

                const { passwordHash, ...userResponse } = user;
                return { jsonBody: userResponse };
            } catch (err) {
                if (err.code === 404) {
                    return { status: 401, jsonBody: { error: "Invalid credentials" } };
                }
                throw err;
            }
        } catch (error) {
            context.log.error(error);
            return { status: 500, jsonBody: { error: "Login failed" } };
        }
    }
});
