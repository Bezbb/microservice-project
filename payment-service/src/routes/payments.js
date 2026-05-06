const express = require('express');
const {
    createPayment,
    finalizeMomoPayment,
    findPaymentByMomoOrderId,
    listPayments
} = require('../services/paymentService');
const { createFrontendResultUrl } = require('../services/momoService');

const router = express.Router();

router.get('/', async (_req, res) => {
    try {
        const list = await listPayments();
        return res.json(list);
    } catch (_error) {
        return res.status(500).json({ error: 'Khong lay duoc danh sach thanh toan.' });
    }
});

router.post('/momo/ipn', async (req, res) => {
    try {
        await finalizeMomoPayment(req.body || {});
        return res.status(204).send();
    } catch (error) {
        console.error('Loi xu ly IPN MoMo:', error);
        return res.status(error.statusCode || 400).json({ error: error.message || 'Khong the xu ly IPN MoMo.' });
    }
});

router.get('/momo/return', async (req, res) => {
    try {
        const payment = await finalizeMomoPayment(req.query || {});
        const status = payment.status === 'paid' ? 'success' : 'failed';
        return res.redirect(createFrontendResultUrl(status, payment, req.query));
    } catch (error) {
        console.error('Loi xu ly redirect MoMo:', error);

        const payment = req.query?.orderId
            ? await findPaymentByMomoOrderId(req.query.orderId).catch(() => null)
            : null;

        return res.redirect(createFrontendResultUrl('failed', payment, {
            message: error.message || 'Thanh toan MoMo that bai.'
        }));
    }
});

router.post('/', async (req, res) => {
    try {
        const result = await createPayment(req.body);
        return res.status(result.statusCode).json(result.body);
    } catch (error) {
        console.error(error);
        return res.status(error.statusCode || 500).json({ error: error.message || 'Khong the tao thanh toan.' });
    }
});

module.exports = router;
