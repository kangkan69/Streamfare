// Small page-level UI helpers: status pill, theme switch, collapsible card.

import { store } from './storage.js';

export const $ = (id) => document.getElementById(id);

// state: 'idle' | 'loading' | 'playing' | 'error' (css colours the dot by data-state)
export function setStatus(state, text) {
  $('pill').dataset.state = state;
  $('status').textContent = text;
}

// ---------- theme ----------

function systemTheme() {
  return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function initTheme(button) {
  const apply = (theme) => {
    document.documentElement.dataset.theme = theme;
    button.textContent = theme === 'dark' ? '☀ Light' : '🌙 Dark';
    store.set('theme', theme);
  };

  apply(store.get('theme') || systemTheme());
  button.addEventListener('click', () => {
    apply(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  });
}

// ---------- collapsible card ----------

export function initCollapsible(card, toggleButton) {
  toggleButton.addEventListener('click', () => card.classList.toggle('closed'));
  return {
    close: () => card.classList.add('closed'),
    open: () => card.classList.remove('closed'),
  };
}
