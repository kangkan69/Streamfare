// Replaces native <select> menus with a styled dropdown.
//
// The browser draws the native option list itself, so CSS can't style it.
// This keeps the real <select> in the page (hidden), so existing code that reads
// select.value or listens for "change" keeps working untouched. It also watches
// the <select> for added/removed options, so menus filled later (like Quality)
// stay in sync.

const SPACE_NEEDED = 260; // px below the button before we open upwards

export function enhanceSelects(root = document) {
  root.querySelectorAll('select').forEach(enhance);
}

function enhance(select) {
  if (select.dataset.enhanced) return;
  select.dataset.enhanced = 'true';

  const wrap = document.createElement('div');
  wrap.className = 'dropdown';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'dropdown-button';
  button.setAttribute('aria-haspopup', 'listbox');
  button.setAttribute('aria-expanded', 'false');

  const list = document.createElement('ul');
  list.className = 'dropdown-list';
  list.setAttribute('role', 'listbox');

  select.classList.add('dropdown-native');
  select.tabIndex = -1;
  select.before(wrap);
  wrap.append(select, button, list);

  let activeIndex = select.selectedIndex;

  function render() {
    list.innerHTML = '';
    [...select.options].forEach((option, index) => {
      const item = document.createElement('li');
      item.setAttribute('role', 'option');
      item.textContent = option.textContent;
      item.dataset.index = index;
      item.classList.toggle('selected', index === select.selectedIndex);
      item.classList.toggle('active', index === activeIndex);
      list.append(item);
    });
    button.textContent = select.selectedOptions[0]?.textContent ?? '';
  }

  function isOpen() {
    return wrap.classList.contains('open');
  }

  function open() {
    const room = window.innerHeight - button.getBoundingClientRect().bottom;
    wrap.classList.toggle('up', room < SPACE_NEEDED);
    activeIndex = select.selectedIndex;
    render();
    wrap.classList.add('open');
    button.setAttribute('aria-expanded', 'true');
  }

  function close() {
    wrap.classList.remove('open');
    button.setAttribute('aria-expanded', 'false');
  }

  function choose(index) {
    select.selectedIndex = index;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    render();
    close();
  }

  function moveActive(step) {
    const last = select.options.length - 1;
    activeIndex = Math.max(0, Math.min(last, activeIndex + step));
    render();
  }

  button.addEventListener('click', () => (isOpen() ? close() : open()));

  list.addEventListener('click', (e) => {
    const item = e.target.closest('li');
    if (item) choose(Number(item.dataset.index));
  });

  button.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') return close();

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen()) return open();
      moveActive(e.key === 'ArrowDown' ? 1 : -1);
    }
    if ((e.key === 'Enter' || e.key === ' ') && isOpen()) {
      e.preventDefault();
      choose(activeIndex);
    }
  });

  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) close();
  });

  // clicking the <label> should focus the visible button
  if (select.id) {
    document.querySelector(`label[for="${select.id}"]`)?.addEventListener('click', () => button.focus());
  }

  new MutationObserver(render).observe(select, { childList: true });
  render();
}
