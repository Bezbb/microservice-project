const mongoose = require('mongoose');
const { MONGODB_URI } = require('../config/env');

async function connectToMongo() {
    await mongoose.connect(MONGODB_URI);
    console.log('Payment Service da ket noi MongoDB');
}

module.exports = {
    mongoose,
    connectToMongo
};
