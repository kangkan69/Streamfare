// Everything the viewer can adjust: volume, picture filters, speed, quality,
// the toolbar buttons and keyboard shortcuts.

import { $ } from './ui.js';

const LIVE_BEHIND_SECONDS = 8; // further than this from the edge = "behind live"

export function initControls(video, player, box) {
  initVolume(video);
  initPicture(video);
  initPlayback(video, player);
  initToolbar(video, player, box);
  initShortcuts(video, player, box);
}

function percent(value) {
  return Math.round(value * 100) + '%';
}

// ---------- audio ----------

function initVolume(video) {
  const slider = $('volume');
  const label = $('volumeValue');

  slider.addEventListener('input', () => {
    video.volume = slider.value;
    video.muted = false;
    label.textContent = percent(slider.value);
    updateMuteLabel(video);
  });
  label.textContent = percent(slider.value);
}

function updateMuteLabel(video) {
  $('mute').textContent = video.muted ? 'Unmute' : 'Mute';
}

// ---------- picture ----------

function initPicture(video) {
  const names = ['brightness', 'contrast', 'saturation'];

  const apply = () => {
    video.style.filter = names.map((name) => `${name}(${$(name).value})`).join(' ');
    names.forEach((name) => ($(name + 'Value').textContent = percent($(name).value)));
  };

  names.forEach((name) => $(name).addEventListener('input', apply));
  apply();

  $('fit').addEventListener('change', (e) => (video.style.objectFit = e.target.value));
}

// ---------- quality + speed ----------

function initPlayback(video, player) {
  $('quality').addEventListener('change', (e) => player.setQuality(parseInt(e.target.value, 10)));
  $('speed').addEventListener('change', (e) => (video.playbackRate = parseFloat(e.target.value)));
}

// ---------- toolbar ----------

function initToolbar(video, player, box) {
  const liveButton = $('live');

  liveButton.addEventListener('click', () => {
    player.goLive();
    liveButton.classList.remove('behind');
  });

  // grey the LIVE button while the viewer is behind the live edge
  setInterval(() => {
    const edge = player.liveEdge();
    if (edge === null) return;
    liveButton.classList.toggle('behind', edge - video.currentTime > LIVE_BEHIND_SECONDS);
  }, 1000);

  $('mute').addEventListener('click', () => {
    video.muted = !video.muted;
    updateMuteLabel(video);
  });

  $('pip').addEventListener('click', () => {
    if (document.pictureInPictureElement) document.exitPictureInPicture();
    else video.requestPictureInPicture?.();
  });

  $('fullscreen').addEventListener('click', () => toggleFullscreen(box));
}

function toggleFullscreen(box) {
  if (document.fullscreenElement) document.exitFullscreen();
  else box.requestFullscreen();
}

// ---------- keyboard ----------

function initShortcuts(video, player, box) {
  document.addEventListener('keydown', (e) => {
    const active = document.activeElement;
    const typing = ['INPUT', 'SELECT'].includes(active.tagName) && active.type !== 'range';
    if (typing) return;

    switch (e.key) {
      case ' ':
        e.preventDefault();
        video.paused ? video.play() : video.pause();
        break;
      case 'l': player.goLive(); break;
      case 'm': $('mute').click(); break;
      case 'f': toggleFullscreen(box); break;
      case 'ArrowUp':
        video.volume = Math.min(1, video.volume + 0.05);
        $('volume').value = video.volume;
        break;
      case 'ArrowDown':
        video.volume = Math.max(0, video.volume - 0.05);
        $('volume').value = video.volume;
        break;
    }
  });
}
