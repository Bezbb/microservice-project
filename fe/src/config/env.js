const path = require('path');

const PORT = Number(process.env.PORT || 3004);
const publicDir = path.join(__dirname, '../../public');
const pagesDir = path.join(publicDir, 'pages');

module.exports = {
    PORT,
    publicDir,
    pagesDir
};
