const express = require('express');
const {
    createOrder,
    deleteOrder,
    findOrderById,
    listOrders,
    listOrdersForUser,
    updateOrderStatus
} = require('../services/orderService');
const {
    hasValidRequestUser,
    isAdminRequest,
    isTrustedInternalRequest,
    normalizeRequestUser
} = require('../utils/requestUser');

const router = express.Router();

router.post('/', async (req, res) => {
    try {
        const user = normalizeRequestUser(req);
        const savedOrder = await createOrder(req.body, user);

        return res.status(201).json({
            thongBao: 'Tao don hang thanh cong.',
            donHang: savedOrder
        });
    } catch (error) {
        console.error(error);
        return res.status(error.statusCode || 500).json({
            loi: error.message || 'Khong the luu don hang.'
        });
    }
});

router.get('/', async (req, res) => {
    try {
        const user = normalizeRequestUser(req);

        if (!isTrustedInternalRequest(req) && !isAdminRequest(user)) {
            return res.status(hasValidRequestUser(user) ? 403 : 401).json({
                loi: 'Ban khong co quyen xem danh sach don hang nay.'
            });
        }

        const orders = await listOrders(req.query);
        return res.json(orders);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ loi: 'Khong the lay danh sach don hang.' });
    }
});

router.get('/my', async (req, res) => {
    try {
        const user = normalizeRequestUser(req);

        if (!user.userId) {
            return res.status(401).json({ loi: 'Ban can dang nhap de xem don hang.' });
        }

        const orders = await listOrdersForUser(user.userId);
        return res.json(orders);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ loi: 'Khong the lay danh sach don hang cua ban.' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const order = await findOrderById(req.params.id);

        if (!order) {
            return res.status(404).json({ loi: 'Khong tim thay don hang.' });
        }

        const user = normalizeRequestUser(req);
        const canAccess = isTrustedInternalRequest(req)
            || isAdminRequest(user)
            || (hasValidRequestUser(user) && order.user?.userId === user.userId);

        if (!canAccess) {
            return res.status(hasValidRequestUser(user) ? 403 : 401).json({
                loi: 'Ban khong co quyen xem don hang nay.'
            });
        }

        return res.json(order);
    } catch (error) {
        console.error(error);
        return res.status(400).json({ loi: 'Ma don hang khong hop le.' });
    }
});

router.patch('/:id/status', async (req, res) => {
    try {
        const user = normalizeRequestUser(req);

        if (!isTrustedInternalRequest(req) && !isAdminRequest(user)) {
            return res.status(hasValidRequestUser(user) ? 403 : 401).json({
                loi: 'Ban khong co quyen cap nhat trang thai don hang.'
            });
        }

        const order = await updateOrderStatus(req.params.id, req.body);

        return res.json({
            thongBao: 'Cap nhat trang thai don hang thanh cong.',
            donHang: order
        });
    } catch (error) {
        console.error(error);
        return res.status(error.statusCode || 400).json({
            loi: error.message || 'Khong the cap nhat trang thai don hang.'
        });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const user = normalizeRequestUser(req);

        if (!isAdminRequest(user)) {
            return res.status(hasValidRequestUser(user) ? 403 : 401).json({
                loi: 'Chi admin moi duoc xoa don hang.'
            });
        }

        const deletedOrder = await deleteOrder(req.params.id);

        return res.json({
            thongBao: 'Xoa don hang thanh cong.',
            order: deletedOrder
        });
    } catch (error) {
        console.error(error);
        return res.status(error.statusCode || 400).json({
            loi: error.message || 'Ma don hang khong hop le.'
        });
    }
});

module.exports = router;
