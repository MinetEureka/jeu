// 金額問題用：audio.m4a を一定間隔で50区画まで再生します。
// 同時再生は1つだけにし、古い非同期リクエストは無効化します。
window.segmentAudio = (() => {
  const config = window.gameConfig;
  let context, source, media, stopTimer, controller, generation = 0;
  let loadPromise = null;

  function getContext() {
    const Constructor = window.AudioContext || window.webkitAudioContext;
    if (!Constructor) throw new Error('Web Audio unavailable');
    if (!context) context = new Constructor();
    return context;
  }

  function load() {
    if (!loadPromise) {
      loadPromise = (async () => {
        const ctx = getContext();
        const abort = new AbortController();
        const timer = setTimeout(() => abort.abort(), 30000);
        try {
          const response = await fetch(config.mainAudio, {
            cache: 'force-cache',
            signal: abort.signal
          });
          if (!response.ok) throw new Error(`Audio HTTP ${response.status}`);
          return await ctx.decodeAudioData(await response.arrayBuffer());
        } finally {
          clearTimeout(timer);
        }
      })();
      loadPromise.catch(() => { loadPromise = null; });
    }
    return loadPromise;
  }

  function stop() {
    generation++;
    clearTimeout(stopTimer);
    if (controller) { controller.abort(); controller = null; }
    if (source) {
      source.onended = null;
      try { source.stop(); } catch (_) {}
      source.disconnect();
      source = null;
    }
    if (media) {
      media.pause();
      media = null;
    }
  }

  function waitFor(element, event, signal, action) {
    return new Promise((resolve, reject) => {
      const finish = error => {
        clearTimeout(timer);
        element.removeEventListener(event, ready);
        element.removeEventListener('error', failed);
        signal.removeEventListener('abort', cancelled);
        error ? reject(error) : resolve();
      };
      const ready = () => finish();
      const failed = () => finish(new Error('Audio loading failed'));
      const cancelled = () => finish(new DOMException('Cancelled', 'AbortError'));
      const timer = setTimeout(() => finish(new Error('Audio timed out')), 15000);
      element.addEventListener(event, ready, { once: true });
      element.addEventListener('error', failed, { once: true });
      signal.addEventListener('abort', cancelled, { once: true });
      if (signal.aborted) { cancelled(); return; }
      try { action(); } catch (error) { finish(error); }
    });
  }

  async function play(id) {
    stop();
    const request = generation;
    const match = /^(\d{1,2})$/.exec(String(id));
    const number = match ? Number(match[1]) : NaN;
    if (!Number.isInteger(number) || number < 1 || number > 50)
      throw new Error('Invalid segment');

    const offset = (number - 1) * config.segmentSpacing + config.segmentOffset;

    try {
      const ctx = getContext();
      const resumed = ctx.state === 'running' ? Promise.resolve() : ctx.resume();
      const [buffer] = await Promise.all([load(), resumed]);
      if (request !== generation) return false;
      if (ctx.state !== 'running') throw new Error('Audio context suspended');
      if (offset >= buffer.duration) throw new Error('Segment outside audio');

      source = ctx.createBufferSource();
      const playing = source;
      playing.buffer = buffer;
      playing.connect(ctx.destination);
      playing.onended = () => {
        playing.disconnect();
        if (source === playing) source = null;
      };
      playing.start(0, offset, Math.min(config.segmentSeconds, buffer.duration - offset));
      return true;
    } catch (error) {
      if (request !== generation) return false;
      if (source) {
        try { source.stop(); } catch (_) {}
        source.disconnect();
        source = null;
      }

      const element = document.getElementById('audio-player');
      if (!element) throw error;
      media = element;
      controller = new AbortController();
      const signal = controller.signal;

      try {
        if (element.readyState < 1)
          await waitFor(element, 'loadedmetadata', signal, () => element.load());
        if (request !== generation) return false;
        if (offset >= element.duration) throw new Error('Segment outside audio');

        if (Math.abs(element.currentTime - offset) > 0.001) {
          await waitFor(element, 'seeked', signal, () => {
            element.currentTime = offset;
          });
        }
        if (request !== generation) return false;

        await element.play();
        if (request !== generation) return false;

        const end = Math.min(offset + config.segmentSeconds, element.duration);
        const finish = () => { if (request === generation) stop(); };
        element.addEventListener('timeupdate', () => {
          if (element.currentTime >= end) finish();
        }, { signal });
        element.addEventListener('ended', finish, { once: true, signal });
        element.addEventListener('error', finish, { once: true, signal });
        stopTimer = setTimeout(finish, Math.max(0, end - offset) * 1000);
        return true;
      } catch (fallbackError) {
        if (request !== generation) return false;
        stop();
        throw fallbackError;
      }
    }
  }

  function preload() {
    void load().catch(() => {});
  }

  window.addEventListener('pagehide', stop);
  return Object.freeze({ play, stop, preload });
})();
