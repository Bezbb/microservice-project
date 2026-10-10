const { app } = require('./src/app');
const { PORT } = require('./src/config/env');
const { connectToMongo } = require('./src/db/mongo');

connectToMongo()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Chatbot Service listening on port ${PORT}`);
        });
    })
    .catch((error) => {
        console.error('Chatbot Service MongoDB connection error:', error);
        process.exit(1);
    });
