// Store — LUÔN đọc/ghi trực tiếp localStorage, KHÔNG cache
// Mọi thay đổi được phản hồi ngay lập tức
const LS_PREFIX = 'smc_';

export function loadData(name, defaults = []) {
  try {
    const stored = localStorage.getItem(LS_PREFIX + name);
    if (stored) return JSON.parse(stored);
  } catch (e) {
    // Ignore parse errors
  }
  return defaults;
}

export function saveData(name, data) {
  try {
    localStorage.setItem(LS_PREFIX + name, JSON.stringify(data));
  } catch (e) {
    // Ignore quota errors
  }
}

export function loadFromStorage(name, defaults = []) {
  return loadData(name, defaults);
}

export function resetData(name, defaults) {
  try {
    localStorage.removeItem(LS_PREFIX + name);
  } catch (e) {
    // Ignore
  }
  return defaults;
}

export function genId(prefix) {
  return (prefix || 'id-') + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
