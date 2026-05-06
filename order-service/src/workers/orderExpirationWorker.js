const Order = require('../models/order');
const { INVENTORY_STATE, ORDER_STATUS } = require('../config/constants');
const { ORDER_EXPIRATION_SWEEP_INTERVAL_MS } = require('../config/env');
const { isDatabaseReady } = require('../db/mongo');
const { releaseOrderInventory } = require('../services/productInventoryService');

let expirationWorkerTimer = null;
let isExpirationWorkerRunning = false;

async function expirePendingPaymentOrders() {
    if (!isDatabaseReady()) {
        return;
    }

    const now = new Date();
    const expiredOrders = await Order.find({
        inventoryState: { $ne: INVENTORY_STATE.RELEASED },
        $or: [
            {
                status: ORDER_STATUS.PENDING_PAYMENT,
                expiresAt: { $lte: now }
            },
            {
                status: ORDER_STATUS.CANCELLED,
                cancelledReason: 'payment_timeout',
                inventorySyncError: { $ne: '' }
            }
        ]
    }).sort({ expiresAt: 1 }).limit(50);

    for (const order of expiredOrders) {
        const claimedOrder = order.status === ORDER_STATUS.PENDING_PAYMENT
            ? await Order.findOneAndUpdate(
                {
                    _id: order._id,
                    status: ORDER_STATUS.PENDING_PAYMENT,
                    expiresAt: { $lte: new Date() },
                    inventoryState: { $ne: INVENTORY_STATE.RELEASED }
                },
                {
                    $set: {
                        status: ORDER_STATUS.CANCELLED,
                        statusUpdatedAt: new Date(),
                        cancelledReason: 'payment_timeout',
                        inventorySyncError: ''
                    }
                },
                { new: true }
            )
            : order;

        if (!claimedOrder) {
            continue;
        }

        try {
            await releaseOrderInventory(claimedOrder.items, {
                decrementSoldCount: claimedOrder.inventoryState === INVENTORY_STATE.CONFIRMED
            });

            claimedOrder.inventoryState = INVENTORY_STATE.RELEASED;
            claimedOrder.inventoryUpdatedAt = new Date();
            claimedOrder.inventorySyncError = '';
            await claimedOrder.save();
        } catch (error) {
            console.error('Khong the hoan ton kho cho don hang qua han:', claimedOrder._id, error);
            claimedOrder.inventorySyncError = error.message || 'Khong the hoan ton kho cho don hang qua han.';
            claimedOrder.inventoryUpdatedAt = new Date();
            await claimedOrder.save().catch((saveError) => {
                console.error('Khong the luu loi dong bo ton kho:', saveError);
            });
        }
    }
}

function startOrderExpirationWorker() {
    if (expirationWorkerTimer) {
        return;
    }

    const runExpirationWorker = async () => {
        if (isExpirationWorkerRunning) {
            return;
        }

        isExpirationWorkerRunning = true;

        try {
            await expirePendingPaymentOrders();
        } catch (error) {
            console.error('Loi khi quet don hang qua han thanh toan:', error);
        } finally {
            isExpirationWorkerRunning = false;
        }
    };

    runExpirationWorker();
    expirationWorkerTimer = setInterval(runExpirationWorker, ORDER_EXPIRATION_SWEEP_INTERVAL_MS);
}

module.exports = {
    expirePendingPaymentOrders,
    startOrderExpirationWorker
};
