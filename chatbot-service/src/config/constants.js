const CHAT_ROLES = {
    USER: 'user',
    ASSISTANT: 'assistant',
    SYSTEM: 'system'
};

const DEFAULT_MODEL = 'gemini-1.5-flash';

const QUICK_PROMPTS = [
    '🔥 Đang có Flash Sale gì hot?',
    '📱 Gợi ý sản phẩm bán chạy nhất',
    '🎧 Tìm tai nghe / loa giá tốt',
    '💰 Tư vấn sản phẩm dưới 1 triệu',
    '🚚 Chính sách giao hàng và đổi trả thế nào?'
];

const STORE_INFO = {
    name: 'ShopOnline Revo',
    hotline: '1900 6868',
    email: 'support@shoponline.vn',
    hours: '8:00 - 22:00 (Hàng ngày)',
    shippingPolicy: 'Miễn phí vận chuyển toàn quốc cho đơn từ 150.000đ. Giao hỏa tốc 2H trong nội thành.',
    returnPolicy: 'Hỗ trợ đổi trả miễn phí trong 7 ngày nếu lỗi do nhà sản xuất hoặc sản phẩm không đúng mô tả.',
    warrantyPolicy: 'Bảo hành chính hãng 12-24 tháng theo từng dòng sản phẩm.',
    paymentMethods: 'Hỗ trợ thanh toán khi nhận hàng (COD), thẻ ATM/Visa nội địa & quốc tế, và ví điện tử MoMo.'
};

module.exports = {
    CHAT_ROLES,
    DEFAULT_MODEL,
    QUICK_PROMPTS,
    STORE_INFO
};
