/**
 * Revo AI Chatbot Assistant Widget
 * Supports:
 * - Conversational AI shopper assistant (Vietnamese)
 * - Real-time product recommendations from catalog
 * - Conversation persistence per user account (MongoDB)
 * - Automatic tracking of referenced/interested products
 * - Sync with storefront cart and session
 */

(() => {
    'use strict';

    const API_BASE = window.Auth?.API_BASE || window.AppConfig?.API_BASE_URL || window.__API_BASE__ || '';
    const SESSION_KEY = 'revo_chat_session_id';
    const CART_KEY = 'cart';

    // State
    let state = {
        isOpen: false,
        activeTab: 'chat', // 'chat' | 'interested'
        isLoading: false,
        messages: [],
        referencedProducts: [],
        suggestedQuestions: [
            '🔥 Đang có Flash Sale gì hot?',
            '📱 Gợi ý sản phẩm bán chạy nhất',
            '🎧 Tìm tai nghe / loa giá tốt',
            '💰 Tư vấn sản phẩm dưới 1 triệu'
        ],
        hasLoadedHistory: false
    };

    function getSessionId() {
        let sid = localStorage.getItem(SESSION_KEY);
        if (!sid) {
            sid = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            localStorage.setItem(SESSION_KEY, sid);
        }
        return sid;
    }

    function formatVND(amount = 0) {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND'
        }).format(amount);
    }

    function escapeHtml(str = '') {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function renderMarkdownText(text = '') {
        let formatted = escapeHtml(text);
        // Bold: **text**
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Italic: *text*
        formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
        // Bullet points: \n- item
        formatted = formatted.replace(/(?:^|\n)-\s+(.*?)(?=\n|$)/g, '<br>• $1');
        // Linebreaks: \n
        formatted = formatted.replace(/\n/g, '<br>');
        return formatted;
    }

    // Build DOM structure
    function buildWidgetDom() {
        if (document.getElementById('ai-chat-root')) return;

        const root = document.createElement('div');
        root.id = 'ai-chat-root';
        root.innerHTML = `
            <!-- Floating Launcher Button -->
            <button id="ai-chat-launcher" class="ai-chat-launcher" type="button" aria-label="Mở trợ lý AI">
                <div class="ai-launcher-icon-wrap">
                    <span>✨</span>
                    <span class="ai-online-dot"></span>
                </div>
                <div class="ai-launcher-label">
                    <span class="ai-launcher-title">Revo AI</span>
                    <span class="ai-launcher-sub">Tư vấn mua sắm 24/7</span>
                </div>
                <span id="ai-launcher-badge" class="ai-launcher-badge" style="display: none;">0</span>
            </button>

            <!-- Chat Window Container -->
            <div id="ai-chat-window" class="ai-chat-window" role="dialog" aria-modal="true" aria-label="Cửa sổ trò chuyện Revo AI">
                <!-- Header -->
                <div class="ai-chat-header">
                    <div class="ai-header-info">
                        <div class="ai-avatar">🤖</div>
                        <div class="ai-header-text">
                            <h3>Revo AI Trợ Lý Mua Sắm</h3>
                            <div class="ai-header-status">
                                <span class="ai-status-indicator"></span>
                                <span>Trực tuyến • Hỗ trợ tức thì</span>
                            </div>
                        </div>
                    </div>
                    <div class="ai-header-actions">
                        <button id="ai-btn-refresh" class="ai-header-btn" title="Làm mới đoạn chat" type="button">🔄</button>
                        <button id="ai-btn-close" class="ai-header-btn" title="Đóng" type="button">✕</button>
                    </div>
                </div>

                <!-- Subheader Tabs -->
                <div class="ai-chat-tabs">
                    <button id="ai-tab-chat" class="ai-tab-btn active" type="button">
                        <span>💬 Tư vấn & Hỏi đáp</span>
                    </button>
                    <button id="ai-tab-interested" class="ai-tab-btn" type="button">
                        <span>⭐ Đang quan tâm</span>
                        <span id="ai-tab-interested-count" class="ai-tab-badge">0</span>
                    </button>
                </div>

                <!-- Tab 1: Chat Stream -->
                <div id="ai-panel-chat" class="ai-tab-panel active">
                    <div id="ai-messages-container" class="ai-messages-container">
                        <!-- Messages dynamically inserted here -->
                    </div>

                    <!-- Quick Prompt Suggestions -->
                    <div id="ai-quick-prompts" class="ai-quick-prompts">
                        <!-- Chips dynamically rendered here -->
                    </div>

                    <!-- Input Area -->
                    <form id="ai-chat-form" class="ai-chat-input-area">
                        <textarea
                            id="ai-chat-input"
                            class="ai-chat-input"
                            placeholder="Nhập câu hỏi hoặc sản phẩm cần tư vấn..."
                            rows="1"
                        ></textarea>
                        <button id="ai-chat-send" class="ai-chat-send-btn" type="submit" title="Gửi tin nhắn">
                            ➤
                        </button>
                    </form>
                </div>

                <!-- Tab 2: Interested / Referenced Products Panel -->
                <div id="ai-panel-interested" class="ai-tab-panel">
                    <div class="ai-interested-panel">
                        <div class="ai-interested-header">
                            💡 Đây là danh sách các sản phẩm bạn đã tham khảo hoặc được AI tư vấn. Bạn có thể nhấn để xem chi tiết hoặc hỏi thêm về từng món đồ!
                        </div>
                        <div id="ai-interested-list" class="ai-interested-list">
                            <!-- Items dynamically rendered here -->
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(root);
        attachEventListeners();
    }

    // Attach UI Event Listeners
    function attachEventListeners() {
        const launcher = document.getElementById('ai-chat-launcher');
        const closeBtn = document.getElementById('ai-btn-close');
        const refreshBtn = document.getElementById('ai-btn-refresh');
        const tabChat = document.getElementById('ai-tab-chat');
        const tabInterested = document.getElementById('ai-tab-interested');
        const form = document.getElementById('ai-chat-form');
        const input = document.getElementById('ai-chat-input');

        launcher?.addEventListener('click', toggleChatWindow);
        closeBtn?.addEventListener('click', closeChatWindow);

        refreshBtn?.addEventListener('click', async () => {
            if (confirm('Bạn có muốn làm mới cuộc trò chuyện này không?')) {
                await clearChatHistory();
            }
        });

        tabChat?.addEventListener('click', () => switchTab('chat'));
        tabInterested?.addEventListener('click', () => switchTab('interested'));

        form?.addEventListener('submit', (e) => {
            e.preventDefault();
            sendMessageFromInput();
        });

        input?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessageFromInput();
            }
        });

        // Auto resize textarea
        input?.addEventListener('input', () => {
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 100) + 'px';
        });
    }

    function toggleChatWindow() {
        if (state.isOpen) {
            closeChatWindow();
        } else {
            openChatWindow();
        }
    }

    function openChatWindow() {
        state.isOpen = true;
        const win = document.getElementById('ai-chat-window');
        win?.classList.add('is-open');

        if (!state.hasLoadedHistory) {
            loadChatHistory();
        }

        setTimeout(() => {
            document.getElementById('ai-chat-input')?.focus();
            scrollMessagesToBottom();
        }, 150);
    }

    function closeChatWindow() {
        state.isOpen = false;
        const win = document.getElementById('ai-chat-window');
        win?.classList.remove('is-open');
    }

    function switchTab(tabName) {
        state.activeTab = tabName;
        const tabChat = document.getElementById('ai-tab-chat');
        const tabInterested = document.getElementById('ai-tab-interested');
        const panelChat = document.getElementById('ai-panel-chat');
        const panelInterested = document.getElementById('ai-panel-interested');

        if (tabName === 'chat') {
            tabChat?.classList.add('active');
            tabInterested?.classList.remove('active');
            panelChat?.classList.add('active');
            panelInterested?.classList.remove('active');
            scrollMessagesToBottom();
        } else {
            tabInterested?.classList.add('active');
            tabChat?.classList.remove('active');
            panelInterested?.classList.add('active');
            panelChat?.classList.remove('active');
            renderInterestedProductsList();
        }
    }

    function scrollMessagesToBottom() {
        const container = document.getElementById('ai-messages-container');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }

    function updateBadges() {
        const count = state.referencedProducts.length;
        const launcherBadge = document.getElementById('ai-launcher-badge');
        const tabBadge = document.getElementById('ai-tab-interested-count');

        if (launcherBadge) {
            if (count > 0) {
                launcherBadge.textContent = count;
                launcherBadge.style.display = 'flex';
            } else {
                launcherBadge.style.display = 'none';
            }
        }

        if (tabBadge) {
            tabBadge.textContent = count;
        }
    }

    // API Calls
    async function loadChatHistory() {
        const sessionId = getSessionId();
        const headers = window.Auth?.getAuthHeaders ? window.Auth.getAuthHeaders() : {};

        try {
            const res = await fetch(`${API_BASE}/api/chat/history?sessionId=${encodeURIComponent(sessionId)}`, {
                headers
            });

            if (res.ok) {
                const data = await res.json();
                state.messages = Array.isArray(data.messages) ? data.messages : [];
                state.referencedProducts = Array.isArray(data.referencedProducts) ? data.referencedProducts : [];
                if (data.suggestedQuestions?.length) {
                    state.suggestedQuestions = data.suggestedQuestions;
                }
                state.hasLoadedHistory = true;

                // If empty conversation, show default greeting
                if (state.messages.length === 0) {
                    const user = window.Auth?.getUser ? window.Auth.getUser() : null;
                    const greetingName = user?.fullName ? ` ${user.fullName}` : '';
                    state.messages.push({
                        role: 'assistant',
                        content: `Xin chào bạn${greetingName}! 👋\n\nTôi là **Revo AI**, trợ lý mua sắm thông minh của cửa hàng. Tôi có thể:\n- Gợi ý sản phẩm phù hợp theo ngân sách và sở thích\n- Cập nhật các khuyến mãi & Flash Sale mới nhất\n- Ghi nhớ các sản phẩm bạn quan tâm để dễ dàng so sánh\n\nBạn đang tìm kiếm sản phẩm nào hôm nay?`,
                        suggestedProducts: [],
                        suggestedQuestions: state.suggestedQuestions
                    });
                }

                renderMessages();
                renderQuickPrompts();
                updateBadges();
            }
        } catch (error) {
            console.error('[ChatbotWidget] Error loading history:', error);
        }
    }

    async function clearChatHistory() {
        const sessionId = getSessionId();
        const headers = window.Auth?.getAuthHeaders ? window.Auth.getAuthHeaders() : {};

        try {
            await fetch(`${API_BASE}/api/chat/history?sessionId=${encodeURIComponent(sessionId)}`, {
                method: 'DELETE',
                headers
            });

            state.messages = [];
            state.referencedProducts = [];
            state.hasLoadedHistory = false;
            loadChatHistory();
        } catch (error) {
            console.error('[ChatbotWidget] Error clearing history:', error);
        }
    }

    async function sendMessage(text) {
        if (!text || !text.trim() || state.isLoading) return;

        const userMessage = text.trim();
        const sessionId = getSessionId();

        // Append user message immediately to UI
        state.messages.push({
            role: 'user',
            content: userMessage,
            suggestedProducts: []
        });
        renderMessages();
        scrollMessagesToBottom();

        // Show typing indicator
        state.isLoading = true;
        renderTypingIndicator(true);

        const input = document.getElementById('ai-chat-input');
        if (input) {
            input.value = '';
            input.style.height = 'auto';
        }

        const baseHeaders = { 'Content-Type': 'application/json' };
        const headers = window.Auth?.getAuthHeaders ? window.Auth.getAuthHeaders(baseHeaders) : baseHeaders;

        try {
            const res = await fetch(`${API_BASE}/api/chat/message`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    message: userMessage,
                    sessionId
                })
            });

            const data = await res.json();
            renderTypingIndicator(false);
            state.isLoading = false;

            if (res.ok && data.success) {
                state.messages.push({
                    role: 'assistant',
                    content: data.reply,
                    suggestedProducts: data.suggestedProducts || [],
                    suggestedQuestions: data.suggestedQuestions || []
                });

                if (Array.isArray(data.referencedProducts)) {
                    state.referencedProducts = data.referencedProducts;
                }

                if (Array.isArray(data.suggestedQuestions) && data.suggestedQuestions.length > 0) {
                    state.suggestedQuestions = data.suggestedQuestions;
                }

                renderMessages();
                renderQuickPrompts();
                updateBadges();
                scrollMessagesToBottom();
            } else {
                state.messages.push({
                    role: 'assistant',
                    content: data.error || 'Xin lỗi, hệ thống đang bận. Vui lòng thử lại sau ít phút.',
                    suggestedProducts: []
                });
                renderMessages();
                scrollMessagesToBottom();
            }
        } catch (error) {
            console.error('[ChatbotWidget] Send error:', error);
            renderTypingIndicator(false);
            state.isLoading = false;

            state.messages.push({
                role: 'assistant',
                content: 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại.',
                suggestedProducts: []
            });
            renderMessages();
            scrollMessagesToBottom();
        }
    }

    function sendMessageFromInput() {
        const input = document.getElementById('ai-chat-input');
        if (input && input.value.trim()) {
            sendMessage(input.value.trim());
        }
    }

    // Rendering Helpers
    function renderMessages() {
        const container = document.getElementById('ai-messages-container');
        if (!container) return;

        container.innerHTML = state.messages
            .map((msg, idx) => {
                const isUser = msg.role === 'user';
                const bubbleContent = renderMarkdownText(msg.content);

                let productsHtml = '';
                if (msg.suggestedProducts && msg.suggestedProducts.length > 0) {
                    productsHtml = `
                        <div class="ai-products-grid">
                            ${msg.suggestedProducts.map((p) => renderProductCardHtml(p)).join('')}
                        </div>
                    `;
                }

                return `
                    <div class="ai-message ${isUser ? 'ai-message--user' : 'ai-message--assistant'}" data-index="${idx}">
                        ${!isUser ? '<div class="ai-msg-avatar">🤖</div>' : ''}
                        <div class="ai-msg-bubble">
                            ${bubbleContent}
                            ${productsHtml}
                        </div>
                    </div>
                `;
            })
            .join('');

        // Attach product card button listeners
        container.querySelectorAll('.js-ai-add-cart').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const pData = JSON.parse(btn.dataset.product || '{}');
                addProductToCart(pData);
            });
        });

        container.querySelectorAll('.js-ai-view-product').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const pId = btn.dataset.productId;
                const pName = btn.dataset.productName;
                viewProduct(pId, pName);
            });
        });
    }

    function renderProductCardHtml(p) {
        const imgSrc = p.image || '/images/default-product.svg';
        const priceStr = formatVND(p.price);
        const originalPriceStr = p.originalPrice > p.price ? formatVND(p.originalPrice) : '';
        const jsonProduct = escapeHtml(JSON.stringify(p));

        return `
            <div class="ai-product-card">
                <img class="ai-product-img" src="${escapeHtml(imgSrc)}" alt="${escapeHtml(p.name)}" onerror="this.src='/images/default-product.svg'">
                <div class="ai-product-info">
                    <h4 class="ai-product-title" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</h4>
                    <div class="ai-product-prices">
                        <span class="ai-product-price">${priceStr}</span>
                        ${originalPriceStr ? `<span class="ai-product-original">${originalPriceStr}</span>` : ''}
                        ${p.discountPercent > 0 ? `<span style="font-size:10px;color:#e11d48;font-weight:700;">-${p.discountPercent}%</span>` : ''}
                    </div>
                    <div class="ai-product-actions">
                        <button type="button" class="ai-btn-sm js-ai-view-product" data-product-id="${escapeHtml(p.productId)}" data-product-name="${escapeHtml(p.name)}">
                            Chi tiết
                        </button>
                        <button type="button" class="ai-btn-sm ai-btn-sm--primary js-ai-add-cart" data-product="${jsonProduct}">
                            + Thêm giỏ
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    function renderTypingIndicator(show) {
        const existing = document.getElementById('ai-typing-ind');
        if (show) {
            if (!existing) {
                const container = document.getElementById('ai-messages-container');
                const ind = document.createElement('div');
                ind.id = 'ai-typing-ind';
                ind.className = 'ai-message ai-message--assistant';
                ind.innerHTML = `
                    <div class="ai-msg-avatar">🤖</div>
                    <div class="ai-typing-indicator">
                        <span class="ai-typing-dot"></span>
                        <span class="ai-typing-dot"></span>
                        <span class="ai-typing-dot"></span>
                    </div>
                `;
                container?.appendChild(ind);
                scrollMessagesToBottom();
            }
        } else {
            existing?.remove();
        }
    }

    function renderQuickPrompts() {
        const container = document.getElementById('ai-quick-prompts');
        if (!container) return;

        const prompts = state.suggestedQuestions.slice(0, 5);
        container.innerHTML = prompts
            .map((prompt) => `<button type="button" class="ai-prompt-chip">${escapeHtml(prompt)}</button>`)
            .join('');

        container.querySelectorAll('.ai-prompt-chip').forEach((chip) => {
            chip.addEventListener('click', () => {
                sendMessage(chip.textContent || '');
            });
        });
    }

    function renderInterestedProductsList() {
        const container = document.getElementById('ai-interested-list');
        if (!container) return;

        if (state.referencedProducts.length === 0) {
            container.innerHTML = `
                <div class="ai-empty-state">
                    <span class="ai-empty-icon">🛍️</span>
                    <div class="ai-empty-title">Chưa có sản phẩm nào</div>
                    <div class="ai-empty-desc">Khi bạn trò chuyện và hỏi về các mặt hàng, Revo AI sẽ tự động ghi nhớ tại đây để bạn tiện theo dõi và so sánh!</div>
                </div>
            `;
            return;
        }

        container.innerHTML = state.referencedProducts
            .map((p) => {
                const imgSrc = p.image || '/images/default-product.svg';
                const priceStr = formatVND(p.price);
                const jsonProduct = escapeHtml(JSON.stringify(p));

                return `
                    <div class="ai-interested-item" data-id="${escapeHtml(p.productId)}">
                        <img class="ai-interested-item-img" src="${escapeHtml(imgSrc)}" alt="${escapeHtml(p.name)}" onerror="this.src='/images/default-product.svg'">
                        <div class="ai-interested-item-details">
                            <h4 class="ai-interested-item-name" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</h4>
                            <div class="ai-interested-item-price">${priceStr}</div>
                            <div class="ai-interested-actions">
                                <button type="button" class="ai-btn-sm js-ai-ask-about" data-product-name="${escapeHtml(p.name)}">
                                    💬 Hỏi AI
                                </button>
                                <button type="button" class="ai-btn-sm js-ai-view-product" data-product-id="${escapeHtml(p.productId)}" data-product-name="${escapeHtml(p.name)}">
                                    Xem
                                </button>
                                <button type="button" class="ai-btn-sm ai-btn-sm--primary js-ai-add-cart" data-product="${jsonProduct}">
                                    + Giỏ hàng
                                </button>
                            </div>
                        </div>
                        <button type="button" class="ai-interested-remove js-ai-remove-interested" title="Xóa khỏi danh sách" data-id="${escapeHtml(p.productId)}">
                            ✕
                        </button>
                    </div>
                `;
            })
            .join('');

        // Attach actions
        container.querySelectorAll('.js-ai-ask-about').forEach((btn) => {
            btn.addEventListener('click', () => {
                const name = btn.dataset.productName;
                switchTab('chat');
                sendMessage(`Hãy tư vấn chi tiết hơn về sản phẩm ${name} cho tôi.`);
            });
        });

        container.querySelectorAll('.js-ai-view-product').forEach((btn) => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.productId;
                const name = btn.dataset.productName;
                viewProduct(id, name);
            });
        });

        container.querySelectorAll('.js-ai-add-cart').forEach((btn) => {
            btn.addEventListener('click', () => {
                const p = JSON.parse(btn.dataset.product || '{}');
                addProductToCart(p);
            });
        });

        container.querySelectorAll('.js-ai-remove-interested').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                await removeInterestedProduct(id);
            });
        });
    }

    async function removeInterestedProduct(productId) {
        state.referencedProducts = state.referencedProducts.filter((p) => p.productId !== productId);
        renderInterestedProductsList();
        updateBadges();

        const sessionId = getSessionId();
        const headers = window.Auth?.getAuthHeaders ? window.Auth.getAuthHeaders() : {};

        try {
            await fetch(`${API_BASE}/api/chat/referenced-products/${encodeURIComponent(productId)}?sessionId=${encodeURIComponent(sessionId)}`, {
                method: 'DELETE',
                headers
            });
        } catch (error) {
            console.error('[ChatbotWidget] Error removing product:', error);
        }
    }

    function addProductToCart(product) {
        try {
            const rawCart = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
            const existingIndex = rawCart.findIndex((item) => String(item.id) === String(product.productId || product.id));

            if (existingIndex > -1) {
                rawCart[existingIndex].quantity = (Number(rawCart[existingIndex].quantity) || 1) + 1;
            } else {
                rawCart.push({
                    id: product.productId || product.id,
                    name: product.name,
                    price: Number(product.price) || 0,
                    originalPrice: Number(product.originalPrice) || Number(product.price) || 0,
                    discountPercent: Number(product.discountPercent) || 0,
                    image: product.image || '/images/default-product.svg',
                    quantity: 1,
                    trangThai: 'Còn hàng',
                    danhMuc: product.category || ''
                });
            }

            localStorage.setItem(CART_KEY, JSON.stringify(rawCart));

            // Notify storefront cart UI if script.js is present
            if (typeof window.updateCartCount === 'function') {
                window.updateCartCount();
            } else {
                const cartBtn = document.getElementById('cart-count');
                if (cartBtn) {
                    const totalQty = rawCart.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
                    cartBtn.textContent = `Giỏ hàng (${totalQty})`;
                }
            }

            alert(`Đã thêm "${product.name}" vào giỏ hàng thành công!`);
        } catch (error) {
            console.error('[ChatbotWidget] Add to cart error:', error);
        }
    }

    function viewProduct(productId, productName) {
        // If on index.html with search input
        const searchInput = document.getElementById('home-search');
        if (searchInput) {
            searchInput.value = productName;
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            document.getElementById('products-section')?.scrollIntoView({ behavior: 'smooth' });
            closeChatWindow();
        } else {
            // Navigate to storefront with query
            window.location.href = `/?search=${encodeURIComponent(productName)}`;
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', buildWidgetDom);
    } else {
        buildWidgetDom();
    }

    // Expose global controller
    window.RevoChatbot = {
        open: openChatWindow,
        close: closeChatWindow,
        toggle: toggleChatWindow,
        sendMessage,
        getState: () => state
    };
})();
