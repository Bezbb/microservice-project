const { app } = require('./src/app');
const { PORT } = require('./src/config/env');

app.listen(PORT, () => {
    console.log(`API Gateway listening on port ${PORT}`);
});
