/**
 * Admin UI Utilities - Enhanced user experience functions
 */

/**
 * Show a notification message
 * @param {string} message - Message to display
 * @param {string} type - 'success', 'error', 'info', 'loading'
 * @param {HTMLElement} container - Where to show the message
 * @param {number} duration - Auto dismiss after ms (0 = no auto dismiss)
 */
function showMessage(message, type = 'info', container = null, duration = 5000) {
    if (!container) {
        container = document.querySelector('[data-message-container]') || document.body;
    }

    const messageEl = document.createElement('div');
    messageEl.className = `account-message ${type}`;
    messageEl.textContent = message;

    if (type === 'loading') {
        const spinner = document.createElement('span');
        spinner.className = 'loading-spinner';
        messageEl.insertBefore(spinner, messageEl.firstChild);
    }

    container.insertBefore(messageEl, container.firstChild);

    if (duration > 0 && type !== 'loading') {
        setTimeout(() => {
            messageEl.style.animation = 'slideDown 0.3s ease reverse';
            setTimeout(() => messageEl.remove(), 300);
        }, duration);
    }

    return messageEl;
}

/**
 * Clear all messages in a container
 * @param {HTMLElement} container - Container with messages
 */
function clearMessages(container = null) {
    if (!container) {
        container = document.querySelector('[data-message-container]') || document.body;
    }

    const messages = container.querySelectorAll('.account-message');
    messages.forEach(msg => {
        msg.style.animation = 'slideDown 0.3s ease reverse';
        setTimeout(() => msg.remove(), 300);
    });
}

/**
 * Show a confirmation modal
 * @param {string} title - Modal title
 * @param {string} message - Modal message
 * @param {Object} options - {confirmText, cancelText, isDangerous}
 * @returns {Promise<boolean>}
 */
function showConfirmModal(title, message, options = {}) {
    return new Promise((resolve) => {
        const {
            confirmText = 'Xác nhận',
            cancelText = 'Hủy',
            isDangerous = false
        } = options;

        // Create overlay and modal
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';

        const modal = document.createElement('div');
        modal.className = 'modal';

        const header = document.createElement('div');
        header.className = 'modal-header';
        header.innerHTML = `<h2>${escapeHtml(title)}</h2>`;

        const body = document.createElement('div');
        body.className = 'modal-body';
        body.textContent = message;

        const footer = document.createElement('div');
        footer.className = 'modal-footer';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'secondary-btn';
        cancelBtn.textContent = cancelText;
        cancelBtn.onclick = () => {
            overlay.remove();
            resolve(false);
        };

        const confirmBtn = document.createElement('button');
        confirmBtn.className = isDangerous ? 'delete-btn' : 'primary-btn';
        confirmBtn.textContent = confirmText;
        confirmBtn.onclick = () => {
            overlay.remove();
            resolve(true);
        };

        footer.appendChild(cancelBtn);
        footer.appendChild(confirmBtn);

        modal.appendChild(header);
        modal.appendChild(body);
        modal.appendChild(footer);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
                resolve(false);
            }
        });

        // Focus confirm button for keyboard navigation
        confirmBtn.focus();
    });
}

/**
 * Helper function to escape HTML
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Add loading state to a button
 * @param {HTMLElement} button - Button element
 * @param {boolean} isLoading - Loading state
 */
function setButtonLoading(button, isLoading = true) {
    if (isLoading) {
        button.disabled = true;
        button.dataset.originalText = button.textContent;
        const spinner = document.createElement('span');
        spinner.className = 'loading-spinner';
        button.innerHTML = '';
        button.appendChild(spinner);
        button.appendChild(document.createTextNode(' Đang xử lý...'));
    } else {
        button.disabled = false;
        button.textContent = button.dataset.originalText || 'Lưu';
    }
}

/**
 * Format Vietnamese currency
 * @param {number} value
 * @returns {string}
 */
function formatCurrency(value) {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value);
}

/**
 * Format date to Vietnamese format
 * @param {string|Date} date
 * @returns {string}
 */
function formatDate(date) {
    const d = new Date(date);
    return d.toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Add form validation feedback
 * @param {HTMLElement} input - Input element
 * @param {string} error - Error message or empty for valid
 */
function setInputError(input, error) {
    if (error) {
        input.style.borderColor = '#ef4444';
        input.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.1)';
        input.title = error;
    } else {
        input.style.borderColor = '#d1d5db';
        input.style.boxShadow = '';
        input.title = '';
    }
}

/**
 * Debounce function for search inputs
 * @param {Function} func
 * @param {number} wait
 * @returns {Function}
 */
function debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Show tab content
 * @param {string} tabName
 * @param {string} tabContainerId
 */
function showTab(tabName, tabContainerId = 'admin-tabs') {
    // Hide all tabs
    const tabsContainer = document.getElementById(tabContainerId);
    if (!tabsContainer) return;

    const sections = tabsContainer.querySelectorAll('.tab-content');
    sections.forEach(section => {
        section.hidden = true;
    });

    // Show selected tab
    const selectedTab = document.getElementById(tabName);
    if (selectedTab) {
        selectedTab.hidden = false;
    }

    // Update active tab button
    const buttons = tabsContainer.querySelectorAll('[data-tab]');
    buttons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tabName) {
            btn.classList.add('active');
        }
    });
}

/**
 * Initialize form validation
 * @param {HTMLElement} form
 */
function initializeFormValidation(form) {
    form.addEventListener('submit', (e) => {
        if (!form.checkValidity()) {
            e.preventDefault();
            e.stopPropagation();
            const invalidInputs = form.querySelectorAll(':invalid');
            invalidInputs.forEach(input => {
                setInputError(input, input.validationMessage || 'Trường này là bắt buộc');
            });
        }
    });

    // Clear error on input change
    form.querySelectorAll('input, select, textarea').forEach(input => {
        input.addEventListener('change', () => {
            setInputError(input, '');
        });
        input.addEventListener('input', () => {
            setInputError(input, '');
        });
    });
}

/**
 * Table row selection management
 * @param {HTMLElement} table
 * @returns {Object} with select/deselect methods
 */
function initializeTableSelection(table) {
    const selectedRows = new Set();

    return {
        selectRow(row) {
            selectedRows.add(row);
            row.style.backgroundColor = '#fef3c7';
        },
        deselectRow(row) {
            selectedRows.delete(row);
            row.style.backgroundColor = '';
        },
        clearSelection() {
            selectedRows.forEach(row => {
                row.style.backgroundColor = '';
            });
            selectedRows.clear();
        },
        getSelectedRows() {
            return Array.from(selectedRows);
        }
    };
}

/**
 * Initialize search with debounce
 * @param {HTMLElement} input
 * @param {Function} onSearch - Callback with search value
 */
function initializeSearch(input, onSearch) {
    const handler = debounce((value) => {
        onSearch(value.trim());
    }, 300);

    input.addEventListener('input', (e) => {
        handler(e.target.value);
    });
}

/**
 * Sort table by column
 * @param {HTMLElement} table
 * @param {number} columnIndex
 * @param {boolean} ascending
 */
function sortTable(table, columnIndex, ascending = true) {
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));

    rows.sort((a, b) => {
        const aVal = a.cells[columnIndex].textContent.trim();
        const bVal = b.cells[columnIndex].textContent.trim();

        // Try numeric sort first
        if (!isNaN(aVal) && !isNaN(bVal)) {
            return ascending ? parseFloat(aVal) - parseFloat(bVal) : parseFloat(bVal) - parseFloat(aVal);
        }

        // Fallback to string sort
        return ascending ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });

    rows.forEach(row => tbody.appendChild(row));
}

/**
 * Export table to CSV
 * @param {HTMLElement} table
 * @param {string} filename
 */
function exportTableToCSV(table, filename = 'export.csv') {
    const csv = [];
    const rows = table.querySelectorAll('tr');

    rows.forEach(row => {
        const cols = row.querySelectorAll('td, th');
        const csvRow = Array.from(cols)
            .map(col => `"${col.textContent.trim()}"`)
            .join(',');
        csv.push(csvRow);
    });

    const csvContent = csv.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
}

// Export functions for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        showMessage,
        clearMessages,
        showConfirmModal,
        setButtonLoading,
        formatCurrency,
        formatDate,
        setInputError,
        debounce,
        showTab,
        initializeFormValidation,
        initializeTableSelection,
        initializeSearch,
        sortTable,
        exportTableToCSV
    };
}
