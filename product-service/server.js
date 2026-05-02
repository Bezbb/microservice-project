const { app } = require('./src/app');
const { PORT } = require('./src/config/env');
const {
    connectToMongoWithRetry,
    registerMongoConnectionHandlers
} = require('./src/db/mongo');
const { bootstrapProductData } = require('./src/services/bootstrapService');

registerMongoConnectionHandlers();

async function startServer() {
    await connectToMongoWithRetry();
    await bootstrapProductData();

    app.listen(PORT, () => {
        console.log(`Product Service dang chay tai cong ${PORT}`);
    });
}

startServer().catch((error) => {
    console.error('Khong the khoi dong Product Service:', error);
    process.exit(1);
});
