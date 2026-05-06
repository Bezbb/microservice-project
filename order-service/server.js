const { app } = require('./src/app');
const { PORT } = require('./src/config/env');
const { connectToMongo } = require('./src/db/mongo');
const { startOrderExpirationWorker } = require('./src/workers/orderExpirationWorker');

connectToMongo()
    .then(() => {
        startOrderExpirationWorker();
    })
    .catch((error) => console.error('Order Service MongoDB connection error:', error));

app.listen(PORT, () => {
    console.log(`Order Service listening on port ${PORT}`);
});
