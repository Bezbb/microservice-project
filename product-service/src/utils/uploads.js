const fs = require('fs');
const path = require('path');

const uploadPath = path.join(__dirname, '../../public/uploads');

function ensureUploadDirectory() {
    if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
    }
}

function getManagedUploadAbsolutePath(imagePath) {
    if (typeof imagePath !== 'string' || !imagePath.startsWith('/uploads/')) {
        return '';
    }

    const fileName = path.basename(imagePath);
    return path.join(uploadPath, fileName);
}

async function removeManagedUpload(imagePath) {
    const absolutePath = getManagedUploadAbsolutePath(imagePath);

    if (!absolutePath || !absolutePath.startsWith(uploadPath)) {
        return;
    }

    try {
        await fs.promises.unlink(absolutePath);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.error('Khong the xoa file anh cu:', error.message);
        }
    }
}

ensureUploadDirectory();

module.exports = {
    uploadPath,
    ensureUploadDirectory,
    getManagedUploadAbsolutePath,
    removeManagedUpload
};
