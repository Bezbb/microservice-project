const crypto = require('crypto');
const path = require('path');
const multer = require('multer');
const {
    MAX_IMAGE_SIZE_BYTES,
    ALLOWED_IMAGE_TYPES,
    IMAGE_EXTENSION_BY_TYPE
} = require('../config/constants');
const { uploadPath, removeManagedUpload } = require('../utils/uploads');

const storage = multer.diskStorage({
    destination(_req, _file, cb) {
        cb(null, uploadPath);
    },
    filename(_req, file, cb) {
        const fileExtension = IMAGE_EXTENSION_BY_TYPE[file.mimetype]
            || path.extname(file.originalname).toLowerCase()
            || '.jpg';

        cb(null, `${Date.now()}-${crypto.randomUUID()}${fileExtension}`);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: MAX_IMAGE_SIZE_BYTES
    },
    fileFilter(_req, file, cb) {
        if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
            cb(new Error('Chi chap nhan anh JPG, PNG hoac WEBP.'));
            return;
        }

        cb(null, true);
    }
});

function createUploadMiddleware() {
    return (req, res, next) => {
        upload.single('image')(req, res, (error) => {
            if (!error) {
                next();
                return;
            }

            if (req.file?.path) {
                void removeManagedUpload(`/uploads/${path.basename(req.file.path)}`);
            }

            if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
                res.status(400).json({ error: 'Anh tai len khong duoc vuot qua 2MB.' });
                return;
            }

            res.status(400).json({ error: error.message || 'Upload anh that bai.' });
        });
    };
}

module.exports = {
    handleImageUpload: createUploadMiddleware()
};
