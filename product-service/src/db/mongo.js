const mongoose = require('mongoose');
const {
    MONGODB_URIS,
    DB_RETRY_DELAY_MS,
    DB_SERVER_SELECTION_TIMEOUT_MS
} = require('../config/env');

function wait(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function isDatabaseReady() {
    return mongoose.connection.readyState === 1;
}

async function connectToMongoWithRetry() {
    while (!isDatabaseReady()) {
        for (const uri of MONGODB_URIS) {
            try {
                await mongoose.connect(uri, {
                    serverSelectionTimeoutMS: DB_SERVER_SELECTION_TIMEOUT_MS
                });

                console.log(`Product Service da ket noi MongoDB thanh cong qua ${uri}`);
                return uri;
            } catch (error) {
                console.error(`Khong the ket noi MongoDB qua ${uri}:`, error.message);
            }
        }

        console.error(`Product Service se thu ket noi lai sau ${DB_RETRY_DELAY_MS}ms`);
        await wait(DB_RETRY_DELAY_MS);
    }

    return null;
}

function registerMongoConnectionHandlers() {
    mongoose.connection.on('disconnected', () => {
        console.warn('Product Service bi mat ket noi MongoDB');
    });
}

module.exports = {
    mongoose,
    isDatabaseReady,
    connectToMongoWithRetry,
    registerMongoConnectionHandlers
};
