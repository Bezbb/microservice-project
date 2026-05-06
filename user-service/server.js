const { app } = require('./src/app');
const { PORT } = require('./src/config/env');
const {
    connectToMongoWithRetry,
    registerMongoConnectionHandlers
} = require('./src/db/mongo');
const { seedDefaultAdmin } = require('./src/services/bootstrapService');

registerMongoConnectionHandlers();

async function startServer() {
    await connectToMongoWithRetry();
    await seedDefaultAdmin();

    app.listen(PORT, () => {
        console.log(`User Service dang chay tai cong ${PORT}`);
    });
}

startServer().catch((error) => {
    console.error('Khong the khoi dong User Service:', error);
    process.exit(1);
});
