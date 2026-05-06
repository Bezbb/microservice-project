const { app } = require('./src/app');
const { PORT } = require('./src/config/env');
const { connectToMongo } = require('./src/db/mongo');

connectToMongo()
    .catch((error) => console.error('Loi ket noi MongoDB cua Payment Service:', error));

app.listen(PORT, () => {
    console.log(`Payment Service dang chay tai cong ${PORT}`);
});
