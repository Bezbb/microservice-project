const mongoose = require('mongoose');
const { MONGODB_URI } = require('../config/env');

async function connectToMongo() {
    await mongoose.connect(MONGODB_URI);
    console.log('Order Service connected to MongoDB');
}

function isDatabaseReady() {
    return mongoose.connection.readyState === 1;
}

module.exports = {
    mongoose,
    connectToMongo,
    isDatabaseReady
};
