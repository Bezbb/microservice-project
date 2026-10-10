const express = require('express');
const Conversation = require('../models/conversation');
const { generateChatReply } = require('../services/aiService');
const { extractUserContext } = require('../middlewares/auth');
const { QUICK_PROMPTS } = require('../config/constants');

const router = express.Router();

router.use(extractUserContext);

async function findOrCreateConversation(userContext, clientSessionId) {
    const sessionId = userContext.sessionId || clientSessionId || `anon_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const userId = userContext.userId;

    let conversation = null;

    if (userId) {
        // Find existing conversation for this authenticated user
        conversation = await Conversation.findOne({ userId }).sort({ updatedAt: -1 });

        // If no user conversation found, but there is an active session from guest, link it to the user!
        if (!conversation && sessionId) {
            conversation = await Conversation.findOne({ sessionId, userId: null });
            if (conversation) {
                conversation.userId = userId;
            }
        }
    } else {
        // Guest user by sessionId
        conversation = await Conversation.findOne({ sessionId });
    }

    if (!conversation) {
        conversation = new Conversation({
            userId: userId || null,
            sessionId,
            title: 'Tư vấn mua sắm',
            messages: [],
            referencedProducts: []
        });
    }

    return conversation;
}

// POST /api/chat/message
router.post('/message', async (req, res) => {
    try {
        const { message, sessionId: bodySessionId } = req.body;
        const userMessage = String(message || '').trim();

        if (!userMessage) {
            return res.status(400).json({ error: 'Nội dung tin nhắn không được để trống.' });
        }

        const conversation = await findOrCreateConversation(req.userContext, bodySessionId);

        // Get recent conversation history
        const recentHistory = conversation.messages.slice(-10).map((m) => ({
            role: m.role,
            content: m.content
        }));

        // Generate AI response
        const aiResult = await generateChatReply({
            userMessage,
            conversationHistory: recentHistory,
            referencedProducts: conversation.referencedProducts || [],
            userContext: req.userContext
        });

        // Push user message
        conversation.messages.push({
            role: 'user',
            content: userMessage,
            suggestedProducts: [],
            suggestedQuestions: []
        });

        // Push assistant response
        conversation.messages.push({
            role: 'assistant',
            content: aiResult.reply,
            suggestedProducts: aiResult.suggestedProducts || [],
            suggestedQuestions: aiResult.suggestedQuestions || []
        });

        // Update referenced products and active time
        conversation.referencedProducts = aiResult.referencedProducts || [];
        conversation.lastActiveAt = new Date();

        // Auto update title if still default
        if (conversation.title === 'Tư vấn mua sắm' && conversation.messages.length <= 2) {
            conversation.title = userMessage.slice(0, 36) + (userMessage.length > 36 ? '...' : '');
        }

        await conversation.save();

        return res.json({
            success: true,
            reply: aiResult.reply,
            suggestedProducts: aiResult.suggestedProducts,
            suggestedQuestions: aiResult.suggestedQuestions,
            referencedProducts: conversation.referencedProducts,
            sessionId: conversation.sessionId,
            conversationId: conversation._id
        });
    } catch (error) {
        console.error('[ChatRoutes] Error handling message:', error);
        return res.status(500).json({
            error: 'Đã có lỗi xảy ra khi xử lý tin nhắn. Vui lòng thử lại.'
        });
    }
});

// GET /api/chat/history
router.get('/history', async (req, res) => {
    try {
        const sessionId = req.userContext.sessionId || req.query.sessionId;
        const userId = req.userContext.userId;

        let conversation = null;
        if (userId) {
            conversation = await Conversation.findOne({ userId }).sort({ updatedAt: -1 });
        }
        if (!conversation && sessionId) {
            conversation = await Conversation.findOne({ sessionId });
        }

        if (!conversation) {
            return res.json({
                messages: [],
                referencedProducts: [],
                suggestedQuestions: QUICK_PROMPTS
            });
        }

        return res.json({
            sessionId: conversation.sessionId,
            title: conversation.title,
            messages: conversation.messages,
            referencedProducts: conversation.referencedProducts,
            suggestedQuestions: QUICK_PROMPTS
        });
    } catch (error) {
        console.error('[ChatRoutes] Error getting history:', error);
        return res.status(500).json({ error: 'Không thể tải lịch sử trò chuyện.' });
    }
});

// GET /api/chat/referenced-products
router.get('/referenced-products', async (req, res) => {
    try {
        const sessionId = req.userContext.sessionId || req.query.sessionId;
        const userId = req.userContext.userId;

        let conversation = null;
        if (userId) {
            conversation = await Conversation.findOne({ userId }).sort({ updatedAt: -1 });
        }
        if (!conversation && sessionId) {
            conversation = await Conversation.findOne({ sessionId });
        }

        return res.json({
            items: conversation?.referencedProducts || []
        });
    } catch (error) {
        console.error('[ChatRoutes] Error getting referenced products:', error);
        return res.status(500).json({ error: 'Không thể lấy danh sách sản phẩm đang quan tâm.' });
    }
});

// DELETE /api/chat/referenced-products/:productId
router.delete('/referenced-products/:productId', async (req, res) => {
    try {
        const { productId } = req.params;
        const sessionId = req.userContext.sessionId || req.query.sessionId;
        const userId = req.userContext.userId;

        let conversation = null;
        if (userId) {
            conversation = await Conversation.findOne({ userId }).sort({ updatedAt: -1 });
        }
        if (!conversation && sessionId) {
            conversation = await Conversation.findOne({ sessionId });
        }

        if (!conversation) {
            return res.status(404).json({ error: 'Không tìm thấy cuộc trò chuyện.' });
        }

        conversation.referencedProducts = conversation.referencedProducts.filter(
            (p) => String(p.productId) !== String(productId)
        );
        await conversation.save();

        return res.json({
            success: true,
            referencedProducts: conversation.referencedProducts
        });
    } catch (error) {
        console.error('[ChatRoutes] Error deleting referenced product:', error);
        return res.status(500).json({ error: 'Không thể xóa sản phẩm khỏi danh sách quan tâm.' });
    }
});

// DELETE /api/chat/history
router.delete('/history', async (req, res) => {
    try {
        const sessionId = req.userContext.sessionId || req.query.sessionId;
        const userId = req.userContext.userId;

        let conversation = null;
        if (userId) {
            conversation = await Conversation.findOne({ userId }).sort({ updatedAt: -1 });
        }
        if (!conversation && sessionId) {
            conversation = await Conversation.findOne({ sessionId });
        }

        if (conversation) {
            conversation.messages = [];
            conversation.referencedProducts = [];
            conversation.title = 'Tư vấn mua sắm';
            await conversation.save();
        }

        return res.json({
            success: true,
            message: 'Đã xóa lịch sử trò chuyện thành công.'
        });
    } catch (error) {
        console.error('[ChatRoutes] Error clearing history:', error);
        return res.status(500).json({ error: 'Không thể xóa lịch sử trò chuyện.' });
    }
});

module.exports = router;
