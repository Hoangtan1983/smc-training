/**
 * SMC Training — Formatting Utilities
 * Dùng chung toàn bộ app để đảm bảo hiển thị nhất quán
 */

/**
 * Format số tiền sang VND
 * @param {number|string} amount - Số tiền (VND)
 * @param {object} options
 * @param {boolean} options.symbol - Hiển thị ký hiệu ₫ (default: true)
 * @param {boolean} options.compact - Rút gọn: "5.5 triệu" (default: false)
 * @returns {string} VD: "15.000.000 ₫"
 */
export function formatCurrency(amount, options = {}) {
  const { symbol = true, compact = false } = options;
  const n = Number(amount);
  if (isNaN(n) || n === 0) return symbol ? '0 ₫' : '0';

  if (compact && n >= 1_000_000) {
    const millions = n / 1_000_000;
    const label = millions % 1 === 0 ? `${millions.toFixed(0)} triệu` : `${millions.toFixed(1)} triệu`;
    return symbol ? `${label} ₫` : label;
  }
  if (compact && n >= 1_000) {
    return symbol ? `${(n / 1_000).toFixed(0)}k ₫` : `${(n / 1_000).toFixed(0)}k`;
  }

  const formatted = new Intl.NumberFormat('vi-VN').format(n);
  return symbol ? `${formatted} ₫` : formatted;
}

/**
 * Format ngày tháng sang tiếng Việt
 * @param {string|Date} dateStr - Ngày tháng
 * @returns {string} VD: "06/08/2026"
 */
export function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('vi-VN');
  } catch {
    return '—';
  }
}

/**
 * Format ngày giờ đầy đủ
 * @param {string|Date} dateStr
 * @returns {string} VD: "06/08/2026 14:30"
 */
export function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('vi-VN') + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

/**
 * Format phần trăm
 * @param {number} value - VD: 0.28 hoặc 28
 * @returns {string} VD: "28%"
 */
export function formatPercent(value) {
  const n = Number(value);
  if (isNaN(n)) return '0%';
  const percent = n <= 1 ? Math.round(n * 100) : Math.round(n);
  return percent + '%';
}

/**
 * Confirm modal thay thế window.confirm() gốc
 * @returns {Promise<boolean>}
 */
export function showConfirm({ title, message, confirmText = 'Xác nhận', cancelText = 'Hủy', danger = false }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4';
    overlay.style.animation = 'fadeIn 0.15s ease-out';
    overlay.innerHTML = `
      <div class="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl" style="animation: slideUp 0.2s ease-out">
        ${title ? `<h3 class="text-lg font-bold text-gray-900 mb-2">${title}</h3>` : ''}
        <p class="text-sm text-gray-600 mb-6">${message}</p>
        <div class="flex gap-3">
          <button data-action="cancel" class="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors">${cancelText}</button>
          <button data-action="confirm" class="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} transition-colors">${confirmText}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const cleanup = (result) => {
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.15s';
      setTimeout(() => overlay.remove(), 150);
      resolve(result);
    };

    overlay.querySelector('[data-action="confirm"]').onclick = () => cleanup(true);
    overlay.querySelector('[data-action="cancel"]').onclick = () => cleanup(false);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(false); });

    // Keyboard shortcut
    const onKey = (e) => {
      if (e.key === 'Escape') { cleanup(false); document.removeEventListener('keydown', onKey); }
    };
    document.addEventListener('keydown', onKey);
  });
}

/**
 * Prompt modal thay thế window.prompt() gốc
 * @returns {Promise<string|null>} — null nếu cancel
 */
export function showPrompt({ title, message, placeholder = '', required = true, defaultValue = '' }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4';
    overlay.style.animation = 'fadeIn 0.15s ease-out';
    overlay.innerHTML = `
      <div class="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl" style="animation: slideUp 0.2s ease-out">
        ${title ? `<h3 class="text-lg font-bold text-gray-900 mb-2">${title}</h3>` : ''}
        <p class="text-sm text-gray-600 mb-3">${message}</p>
        <input data-input type="text" class="input-field w-full" placeholder="${placeholder}" value="${defaultValue}" autofocus />
        <p data-error class="text-xs text-red-500 mt-1 hidden">Vui lòng nhập giá trị</p>
        <div class="flex gap-3 mt-4">
          <button data-action="cancel" class="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors">Hủy</button>
          <button data-action="ok" class="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors">OK</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const input = overlay.querySelector('[data-input]');
    const errorEl = overlay.querySelector('[data-error]');
    setTimeout(() => input.focus(), 100);

    const cleanup = (value) => {
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.15s';
      setTimeout(() => overlay.remove(), 150);
      resolve(value);
    };

    const submit = () => {
      const val = input.value.trim();
      if (required && !val) {
        errorEl.classList.remove('hidden');
        input.focus();
        return;
      }
      cleanup(val || null);
    };

    overlay.querySelector('[data-action="ok"]').onclick = submit;
    overlay.querySelector('[data-action="cancel"]').onclick = () => cleanup(null);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(null); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
      if (e.key === 'Escape') cleanup(null);
    });
  });
}
