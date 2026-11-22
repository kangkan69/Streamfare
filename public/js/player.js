// StreamPlayer wraps hls.js / mpegts.js / the native <video> behind one small API.
//
//   const player = new StreamPlayer(videoEl, { onStatus, onQualities });
//   player.load(url, 'hls');
//
// onStatus(state, text)   state: 'loading' | 'playing' | 'error'
// onQualities(levels)     hls quality levels, [] when there are none

export class StreamPlayer {
  constructor(video, { onStatus = () => {}, onQualities = () => {} } = {}) {
    this.video = video;
    this.onStatus = onStatus;
    this.onQualities = onQualities;
    this.hls = null;
    this.mpegts = null;
  }

  load(src, type) {
    this.destroy();
    this.onStatus('loading', 'Loading...');

    switch (type) {
      case 'hls':
        return this.#loadHls(src);
      case 'flv':
      case 'mpegts':
        return this.#loadMpegts(src, type);
      default:
        return this.#loadNative(src);
    }
  }

  destroy() {
    this.hls?.destroy();
    this.mpegts?.destroy();
    this.hls = null;
    this.mpegts = null;
    this.onQualities([]);
  }

  setQuality(index) {
    if (this.hls) this.hls.currentLevel = index; // -1 = auto
  }

  // Time (in seconds) of the newest playable position, or null if unknown
  liveEdge() {
    const { video, hls } = this;
    if (hls?.liveSyncPosition) return hls.liveSyncPosition;
    if (video.seekable.length) return video.seekable.end(video.seekable.length - 1) - 0.5;
    if (video.buffered.length) return video.buffered.end(video.buffered.length - 1) - 0.5;
    return null;
  }

  goLive() {
    const edge = this.liveEdge();
    if (edge !== null) this.video.currentTime = edge;
    this.video.play().catch(() => {});
  }

  // ---------- engines ----------

  #loadHls(src) {
    if (!window.Hls?.isSupported()) return this.#loadNative(src);

    const hls = new Hls({ maxBufferLength: 30 });
    this.hls = hls;
    hls.loadSource(src);
    hls.attachMedia(this.video);

    hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
      this.onQualities(data.levels);
      this.video.play().catch(() => {});
      this.onStatus('playing', 'Playing (HLS)');
    });

    hls.on(Hls.Events.ERROR, (_, data) => {
      if (!data.fatal) return;
      this.onStatus('error', `Error: ${data.type} / ${data.details}`);
      // try to recover before giving up
      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
      else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
    });
  }

  #loadMpegts(src, type) {
    if (!window.mpegts?.isSupported()) return this.#loadNative(src);

    this.mpegts = window.mpegts.createPlayer({ type, isLive: true, url: src });
    this.mpegts.attachMediaElement(this.video);
    this.mpegts.load();
    this.mpegts.play();
    this.onStatus('playing', 'Playing (MPEG-TS/FLV)');
  }

  #loadNative(src) {
    this.video.src = src;
    this.video.play().catch(() => {});
    this.onStatus('playing', 'Playing (native)');
  }
}
