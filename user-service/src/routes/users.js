const express = require('express');
const { deleteUser, listUsers, updateUser } = require('../services/userService');

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const users = await listUsers(req.query);
        return res.json(users);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Khong the lay danh sach nguoi dung.' });
    }
});

router.patch('/:id', async (req, res) => {
    try {
        const user = await updateUser(req.params.id, req.body, req.authUser);

        return res.json({
            message: 'Cap nhat nguoi dung thanh cong.',
            user
        });
    } catch (error) {
        if (!error.statusCode) {
            console.error(error);
        }

        return res.status(error.statusCode || 400).json({
            error: error.statusCode ? error.message : 'Khong the cap nhat nguoi dung.'
        });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const user = await deleteUser(req.params.id, req.authUser);

        return res.json({
            message: 'Xoa nguoi dung thanh cong.',
            user
        });
    } catch (error) {
        if (!error.statusCode) {
            console.error(error);
        }

        return res.status(error.statusCode || 400).json({
            error: error.statusCode ? error.message : 'Khong the xoa nguoi dung.'
        });
    }
});

module.exports = router;
