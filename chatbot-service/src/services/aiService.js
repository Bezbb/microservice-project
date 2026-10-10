const { GEMINI_API_KEY, GEMINI_MODEL } = require('../config/env');
const { STORE_INFO, QUICK_PROMPTS } = require('../config/constants');
const { searchProducts, getFlashSaleProducts, getFeaturedProducts } = require('./catalogService');
const { removeVietnameseDiacritics, formatCurrency, parsePriceFromText } = require('../utils/text');

async function callGeminiApi({ prompt, history = [] }) {
    if (!GEMINI_API_KEY) {
        return null;
    }

    const modelName = GEMINI_MODEL || 'gemini-1.5-flash';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`;

    const contents = [];

    // Map history to Gemini format (user & model roles)
    for (const msg of history.slice(-6)) {
        contents.push({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        });
    }

    contents.push({
        role: 'user',
        parts: [{ text: prompt }]
    });

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents,
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 1000
                }
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.warn('[AIService] Gemini API error:', response.status, errText);
            return null;
        }

        const data = await response.json();
        const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        return candidateText ? candidateText.trim() : null;
    } catch (error) {
        console.error('[AIService] Exception calling Gemini:', error.message);
        return null;
    }
}

function generateLocalSmartResponse(query, { catalogMatches, referencedProducts, userContext }) {
    const rawQuery = removeVietnameseDiacritics(query);
    const greetingWords = ['chao', 'hi', 'hello', 'alo', 'xin chao', 'shop oi', 'ad oi', 'admin oi'];
    const isGreeting = greetingWords.some((word) => rawQuery.startsWith(word) || rawQuery === word);

    const isAskingSale = /flash\s*sale|giam\s*gia|khuyen\s*mai|deal|uu\s*dai/i.test(rawQuery);
    const isAskingShip = /giao\s*hang|ship|van\s*chuyen|phi\s*ship|bao\s*lau/i.test(rawQuery);
    const isAskingWarranty = /bao\s*hanh|doi\s*tra|doi\s*hang|tra\s*hang|loi/i.test(rawQuery);
    const isAskingPayment = /thanh\s*toan|momo|cod|tien\s*mat|the\s*atm/i.test(rawQuery);
    const isAskingReferenced = /san\s*pham\s*(?:da|dang)?\s*(?:xem|tham\s*khao|quan\s*tam)|da\s*hoi\s*gi/i.test(rawQuery);

    const customerName = userContext?.fullName ? ` ${userContext.fullName}` : '';
    let reply = '';
    let suggestedQuestions = [];

    if (isGreeting && !rawQuery.includes('muon') && !rawQuery.includes('tim') && catalogMatches.length === 0) {
        reply = `Dạ chào bạn${customerName}! Em là **Revo AI** - trợ lý mua sắm thông minh của ${STORE_INFO.name}.\n\nEm có thể giúp bạn tìm kiếm sản phẩm, gợi ý các deal Flash Sale giá tốt, kiểm tra chính sách giao hàng và ghi nhớ các sản phẩm bạn quan tâm. Bạn đang muốn tìm sản phẩm nào hôm nay ạ?`;
        suggestedQuestions = [
            '🔥 Có chương trình Flash Sale nào không?',
            '📱 Giới thiệu sản phẩm bán chạy',
            '🚚 Phí giao hàng tính thế nào?'
        ];
    } else if (isAskingReferenced) {
        if (referencedProducts && referencedProducts.length > 0) {
            const listNames = referencedProducts.map((p) => `- **${p.name}** (${formatCurrency(p.price)})`).join('\n');
            reply = `Dạ bạn${customerName} đang quan tâm đến các sản phẩm sau đây trong phiên tư vấn:\n\n${listNames}\n\nBạn cần em tư vấn chi tiết thêm về thông số, ưu đãi hay cách đặt mua sản phẩm nào không ạ?`;
            suggestedQuestions = referencedProducts.slice(0, 3).map((p) => `Tư vấn kỹ hơn về ${p.name}`);
        } else {
            reply = `Dạ hiện tại bạn chưa hỏi về sản phẩm cụ thể nào. Bạn có thể cho em biết nhu cầu (ví dụ: tai nghe bluetooth, điện thoại tầm 5-10 triệu, quần áo thời trang) để em tìm và lưu lại các sản phẩm phù hợp cho bạn nhé!`;
            suggestedQuestions = ['🔥 Xem sản phẩm khuyến mãi hôm nay', '🎧 Tư vấn thiết bị âm thanh'];
        }
    } else if (isAskingShip) {
        reply = `📦 **Chính sách giao hàng của ${STORE_INFO.name}:**\n\n- ${STORE_INFO.shippingPolicy}\n- Thời gian giao hàng tiêu chuẩn: 1-3 ngày làm việc trên toàn quốc.\n- Bạn có thể theo dõi trực tiếp trạng thái đơn hàng trong trang Tài khoản.`;
        suggestedQuestions = ['🚚 Có được kiểm tra hàng trước khi nhận không?', '💳 Có hỗ trợ trả góp hay thanh toán MoMo không?'];
    } else if (isAskingWarranty) {
        reply = `🛡️ **Chính sách bảo hành & đổi trả:**\n\n- **Đổi trả:** ${STORE_INFO.returnPolicy}\n- **Bảo hành:** ${STORE_INFO.warrantyPolicy}\n- Hotline hỗ trợ kỹ thuật và bảo hành: **${STORE_INFO.hotline}** (8:00 - 22:00 hàng ngày).`;
        suggestedQuestions = ['📞 Hotline chăm sóc khách hàng', '🔥 Xem các sản phẩm đang giảm giá'];
    } else if (isAskingPayment) {
        reply = `💳 **Phương thức thanh toán:**\n\n${STORE_INFO.paymentMethods}\n\nTất cả giao dịch trực tuyến đều được mã hóa bảo mật an toàn tuyệt đối.`;
        suggestedQuestions = ['🚚 Miễn phí ship từ bao nhiêu?', '🔥 Các sản phẩm hot nhất'];
    } else if (catalogMatches.length > 0) {
        const productListStr = catalogMatches
            .map((p) => `- **${p.name}**: ${formatCurrency(p.price)}${p.discountPercent > 0 ? ` *(Giảm ${p.discountPercent}%)*` : ''}`)
            .join('\n');

        if (isAskingSale) {
            reply = `🎉 Dưới đây là các sản phẩm **Flash Sale / Khuyến Mãi** đang có giá cực kỳ ưu đãi tại cửa hàng:\n\n${productListStr}\n\nEm đã đính kèm thẻ sản phẩm bên dưới để bạn dễ dàng xem chi tiết hoặc thêm vào giỏ hàng nhé!`;
        } else {
            reply = `Dạ em đã tìm thấy các sản phẩm phù hợp với yêu cầu của bạn${customerName}:\n\n${productListStr}\n\nEm đã lưu các sản phẩm này vào danh sách **Đang quan tâm** của bạn. Bạn muốn em tư vấn chi tiết hơn về sản phẩm nào ạ?`;
        }

        suggestedQuestions = catalogMatches.slice(0, 3).map((p) => `So sánh chi tiết ${p.name}`);
        suggestedQuestions.push('🚚 Đơn này có được freeship không?');
    } else {
        reply = `Dạ em đã ghi nhận yêu cầu của bạn. Hiện tại hệ thống chưa tìm thấy sản phẩm hoàn toàn trùng khớp với từ khóa trên. Bạn có thể cho em biết thêm mức giá mong muốn (ví dụ: dưới 1 triệu, từ 2 - 5 triệu) hoặc danh mục sản phẩm để em gợi ý chính xác hơn nhé!`;
        suggestedQuestions = QUICK_PROMPTS.slice(0, 3);
    }

    return {
        reply,
        suggestedQuestions
    };
}

async function generateChatReply({
    userMessage,
    conversationHistory = [],
    referencedProducts = [],
    userContext = {}
}) {
    // 1. Search products from catalog based on user query
    let catalogMatches = await searchProducts(userMessage, { limit: 4 });

    // If asking about sales specifically and search yielded none, get flash sales
    const raw = removeVietnameseDiacritics(userMessage);
    if (catalogMatches.length === 0 && /flash\s*sale|giam\s*gia|khuyen\s*mai/i.test(raw)) {
        catalogMatches = await getFlashSaleProducts(4);
    }

    let replyText = null;
    let suggestedQuestions = [];

    // 2. Try Gemini API if key is available
    if (GEMINI_API_KEY) {
        const storeContext = `
Thông tin cửa hàng:
- Tên: ${STORE_INFO.name}
- Hotline: ${STORE_INFO.hotline}
- Chính sách giao hàng: ${STORE_INFO.shippingPolicy}
- Chính sách đổi trả: ${STORE_INFO.returnPolicy}
- Chính sách bảo hành: ${STORE_INFO.warrantyPolicy}
- Phương thức thanh toán: ${STORE_INFO.paymentMethods}

Sản phẩm khách đã tham khảo trước đó:
${referencedProducts.length > 0 ? referencedProducts.map((p) => `- ${p.name} (${formatCurrency(p.price)})`).join('\n') : '(Chưa có)'}

Các sản phẩm phù hợp hiện có trong kho:
${catalogMatches.length > 0 ? catalogMatches.map((p) => `- ID: ${p.productId} | Tên: ${p.name} | Giá: ${formatCurrency(p.price)} | Giảm: ${p.discountPercent}% | Tồn kho: ${p.stockQuantity}`).join('\n') : '(Không có sản phẩm trực tiếp trùng khớp)'}

Khách hàng: ${userContext.fullName || 'Khách hàng'} ${userContext.isAuthenticated ? '(Đã đăng nhập)' : '(Khách vãng lai)'}
`;

        const systemPrompt = `
Bạn là Revo AI - trợ lý tư vấn mua sắm chuyên nghiệp và thân thiện của ${STORE_INFO.name}.
Nhiệm vụ của bạn:
1. Trả lời bằng tiếng Việt tự nhiên, nhiệt tình, lịch sự và chu đáo.
2. Dựa vào danh sách sản phẩm và thông tin cửa hàng ở trên để tư vấn, gợi ý sản phẩm phù hợp nhất.
3. Khi giới thiệu sản phẩm, hãy nêu tên chính xác và giá bán.
4. Ghi nhớ các sản phẩm khách đã tham khảo để so sánh hoặc nhắc lại khi được hỏi.
5. Cuối câu trả lời, hãy gợi ý 1-2 câu hỏi tiếp theo phù hợp.

Câu hỏi của khách: "${userMessage}"
`;

        replyText = await callGeminiApi({
            prompt: `${storeContext}\n\n${systemPrompt}`,
            history: conversationHistory
        });
    }

    // 3. Fallback to smart local rule & catalog engine if Gemini is not used or failed
    if (!replyText) {
        const localResult = generateLocalSmartResponse(userMessage, {
            catalogMatches,
            referencedProducts,
            userContext
        });
        replyText = localResult.reply;
        suggestedQuestions = localResult.suggestedQuestions;
    } else {
        // Extract follow-up question ideas from catalog matches
        suggestedQuestions = catalogMatches.slice(0, 3).map((p) => `Tư vấn thêm về ${p.name}`);
        if (suggestedQuestions.length === 0) {
            suggestedQuestions = QUICK_PROMPTS.slice(0, 3);
        }
    }

    // 4. Update referenced products: any products presented in catalogMatches are recorded/updated
    const updatedReferencedMap = new Map();
    for (const p of referencedProducts) {
        updatedReferencedMap.set(p.productId, {
            ...p,
            lastReferencedAt: p.lastReferencedAt || new Date(),
            inquiryCount: p.inquiryCount || 1
        });
    }

    for (const match of catalogMatches) {
        if (updatedReferencedMap.has(match.productId)) {
            const existing = updatedReferencedMap.get(match.productId);
            existing.lastReferencedAt = new Date();
            existing.inquiryCount = (existing.inquiryCount || 1) + 1;
            existing.price = match.price;
            existing.discountPercent = match.discountPercent;
            existing.isFlashSale = match.isFlashSale;
        } else {
            updatedReferencedMap.set(match.productId, {
                productId: match.productId,
                name: match.name,
                price: match.price,
                originalPrice: match.originalPrice,
                discountPercent: match.discountPercent,
                image: match.image,
                category: match.category,
                brand: match.brand,
                stockQuantity: match.stockQuantity,
                isFlashSale: match.isFlashSale,
                lastReferencedAt: new Date(),
                inquiryCount: 1,
                notes: ''
            });
        }
    }

    const nextReferencedProducts = Array.from(updatedReferencedMap.values())
        .sort((a, b) => new Date(b.lastReferencedAt) - new Date(a.lastReferencedAt))
        .slice(0, 20); // Keep up to 20 most recently referenced products

    return {
        reply: replyText,
        suggestedProducts: catalogMatches,
        suggestedQuestions,
        referencedProducts: nextReferencedProducts
    };
}

module.exports = {
    generateChatReply
};
