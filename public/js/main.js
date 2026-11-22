// Entry point: connects the form, the player and the UI pieces.

import { $, setStatus, initTheme, initCollapsible } from './ui.js';
import { store } from './storage.js';
import { HEADER_FIELDS, parseStreamLink, detectStreamType, buildProxyUrl } from './link.js';
import { StreamPlayer } from './player.js';
import { initControls } from './controls.js';
import { enhanceSelects } from './select.js';

const video = $('video');
const box = $('box');
const FORM_FIELDS = ['url', ...HEADER_FIELDS];

const sourcePanel = initCollapsible($('sourceCard'), $('sourceToggle'));
const player = new StreamPlayer(video, {
  onStatus: setStatus,
  onQualities: fillQualityMenu,
});

let collapseWhenPlaying = false;

// ---------- form ----------

function restoreForm() {
  FORM_FIELDS.forEach((name) => ($(name).value = store.get(name)));
}

function saveForm() {
  FORM_FIELDS.forEach((name) => store.set(name, $(name).value));
}

function clearForm() {
  FORM_FIELDS.forEach((name) => {
    store.remove(name);
    $(name).value = '';
  });
}

function readHeaders() {
  const headers = {};
  for (const name of HEADER_FIELDS) {
    const value = $(name).value.trim();
    if (value) headers[name] = value;
  }
  return headers;
}

// ---------- loading ----------

function loadStream() {
  // a pasted "url|Referer=..." link fills the header fields for us
  const { url, headers: fromLink } = parseStreamLink($('url').value);
  for (const [name, value] of Object.entries(fromLink)) $(name).value = value;
  $('url').value = url;

  if (!url) return setStatus('idle', 'Enter a stream URL');
  saveForm();

  const src = $('useProxy').checked ? buildProxyUrl(url, readHeaders()) : url;

  box.classList.add('has-src', 'busy');
  collapseWhenPlaying = true;
  player.load(src, detectStreamType(url));
}

function fillQualityMenu(levels) {
  const menu = $('quality');
  menu.innerHTML = '';
  menu.add(new Option('Auto', -1));
  levels.forEach((level, index) => {
    const size = level.height ? `${level.height}p` : `Level ${index}`;
    menu.add(new Option(`${size} (${Math.round(level.bitrate / 1000)} kbps)`, index));
  });
}

// ---------- video element events ----------

video.addEventListener('waiting', () => {
  if (box.classList.contains('has-src')) box.classList.add('busy');
});

['playing', 'canplay'].forEach((eventName) => {
  video.addEventListener(eventName, () => {
    box.classList.remove('busy');
    box.classList.add('playing');
    document.body.classList.add('watching');
    if (collapseWhenPlaying) {
      collapseWhenPlaying = false;
      sourcePanel.close();
    }
  });
});

video.addEventListener('error', () => {
  box.classList.remove('busy');
  document.body.classList.remove('watching');
  setStatus('error', 'Error: playback failed. Check the URL and headers, or toggle the proxy.');
});

// ---------- proxy availability ----------

// server.js answers 400 when /proxy has no url. A static host (Vercel, GitHub Pages)
// answers 404 instead, so the proxy option is switched off and explained.
async function checkProxyAvailable() {
  try {
    const response = await fetch('/proxy');
    if (response.status !== 404) return;
  } catch {
    // no server reachable: treat the proxy as missing
  }

  const checkbox = $('useProxy');
  const label = checkbox.closest('label');
  checkbox.checked = false;
  checkbox.disabled = true;
  label.classList.add('disabled');
  label.title = 'Custom headers need the local proxy. Run server.js on your own computer.';
  checkbox.nextSibling.textContent = ' Proxy unavailable here (run locally for headers)';
}

// ---------- start ----------

restoreForm();
checkProxyAvailable();
initTheme($('theme'));
initControls(video, player, box);
enhanceSelects();

$('load').addEventListener('click', loadStream);
$('clear').addEventListener('click', clearForm);