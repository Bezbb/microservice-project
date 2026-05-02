const express = require('express');
const { requireTrustedService } = require('../middlewares/auth');
const {
    reserveInventoryItems,
    releaseInventoryItems,
    confirmSoldItems
} = require('../services/inventoryService');

const router = express.Router();
const requireOrderService = requireTrustedService(new Set(['order-service']));

router.post('/prepare', requireOrderService, async (req, res) => {
    try {
        const result = await reserveInventoryItems(req.body.items, req.internalActor);
        return res.json({
            items: result.items,
            totalAmount: result.totalAmount
        });
    } catch (error) {
        console.error(error);
        return res.status(error.statusCode || 500).json({
            error: error.message || 'Khong the kiem tra va giu ton kho cho don hang.'
        });
    }
});

router.post('/release', requireOrderService, async (req, res) => {
    try {
        await releaseInventoryItems(req.body.items, req.internalActor, {
            decrementSoldCount: req.body.decrementSoldCount === true
        });

        return res.json({
            message: 'Da hoan lai ton kho cho don hang.'
        });
    } catch (error) {
        console.error(error);
        return res.status(error.statusCode || 500).json({
            error: error.message || 'Khong the hoan ton kho cho don hang.'
        });
    }
});

router.post('/confirm', requireOrderService, async (req, res) => {
    try {
        await confirmSoldItems(req.body.items, req.internalActor);
        return res.json({
            message: 'Da xac nhan so luong ban cho don hang.'
        });
    } catch (error) {
        console.error(error);
        return res.status(error.statusCode || 500).json({
            error: error.message || 'Khong the xac nhan so luong ban cho don hang.'
        });
    }
});

module.exports = router;
