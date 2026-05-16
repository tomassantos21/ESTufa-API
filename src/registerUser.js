const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const bcrypt = require('bcryptjs');

app.http('registerUser', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const body = await request.json();
            const { username, password, fullName, email, bio } = body;

            if (!username || !password) {
                return { status: 400, jsonBody: { error: "Username and password are required" } };
            }

            const client = new CosmosClient(process.env.COSMOS_DB_CONNECTION);
            const container = client.database('estufa-db').container('users');

            const querySpec = {
                query: "SELECT * FROM c WHERE c.id = @username",
                parameters: [{ name: "@username", value: username }]
            };
            
            const { resources: existingUsers } = await container.items.query(querySpec).fetchAll();
            
            if (existingUsers.length > 0) {
                return { status: 409, jsonBody: { error: "Username already exists" } };
            }

            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            const newUser = {
                id: username,
                username,
                passwordHash: hashedPassword,
                fullName: fullName || '',
                email: email || '',
                bio: bio || '',
                createdAt: new Date().toISOString()
            };

            await container.items.create(newUser);

            const { passwordHash, ...userResponse } = newUser;

            return { jsonBody: userResponse };
        } catch (error) {
            context.log.error(error);
            return { status: 500, jsonBody: { error: "Failed to register user" } };
        }
    }
});
