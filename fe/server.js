const { app } = require('./src/app');
const { PORT } = require('./src/config/env');

app.listen(PORT, () => {
    console.log(`Frontend chạy tại http://localhost:${PORT}`);
});
