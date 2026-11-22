// Thin localStorage wrapper. Storage can be blocked (private mode etc.),
// so every call is guarded and falls back quietly.

const PREFIX = 'streamfare:';

export const store = {
  get(key, fallback = '') {
    try {
      const value = localStorage.getItem(PREFIX + key);
      return value === null ? fallback : value;
    } catch {
      return fallback;
    }
  },

  set(key, value) {
    try { localStorage.setItem(PREFIX + key, value); } catch { /* ignore */ }
  },

  remove(key) {
    try { localStorage.removeItem(PREFIX + key); } catch { /* ignore */ }
  },
};
