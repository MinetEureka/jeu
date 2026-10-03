// 質問(audio.m4a)と答え(audioRe.m4a)で区間構造が異なるため、別々に計算します。
window.segmentAudio = (() => {
  const config = window.gameConfig;

  let context, source, media, stopTimer, controller, generation = 0;
  const loads = new Map();

  function getContext() {
    const Constructor = window.AudioContext || window.webkitAudioContext;
    if (!Constructor) throw new Error('Web Audio unavailable');
    if (!context) context = new Constructor();
    return context;
  }

  function srcFor(which) {
    if (which === 'main') return config.mainAudio;
    if (which === 'review') return config.reviewAudio;
    throw new Error('Invalid audio type');
  }

  function elementFor(which) {
    return document.getElementById(which === 'main' ? 'audio-player' : 'audio-re-player');
  }

  function load(which) {
    if (!loads.has(which)) {
      const promise = (async () => {
        const ctx = getContext();
        const abort = new AbortController();
        const timer = setTimeout(() => abort.abort(), 30000);
        try {
          const response = await fetch(srcFor(which), {
            cache: 'force-cache',
            signal: abort.signal
          });
          if (!response.ok) throw new Error(`Audio HTTP ${response.status}`);
          return await ctx.decodeAudioData(await response.arrayBuffer());
        } finally {
          clearTimeout(timer);
        }
      })();

      loads.set(which, promise);
      promise.catch(() => {
        if (loads.get(which) === promise) loads.delete(which);
      });
    }
    return loads.get(which);
  }

  function stop() {
    generation++;
    clearTimeout(stopTimer);

    if (controller) {
      controller.abort();
      controller = null;
    }

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

      if (signal.aborted) {
        cancelled();
        return;
      }

      try {
        action();
      } catch (error) {
        finish(error);
      }
    });
  }

  function getOffset(which, id) {
    const match = /^(\d{2})([a-d])$/.exec(id);
    if (!match) throw new Error('Invalid segment');

    const number = Number(match[1]);
    const suffix = match[2];

    if (number < 1 || number > 50) throw new Error('Invalid segment');

    if (which === 'main') {
      // 質問ファイルには a と c しかありません。
      if (suffix !== 'a' && suffix !== 'c') {
        throw new Error('Question audio accepts only a/c');
      }
      const qIndex = suffix === 'a' ? 0 : 1;
      return ((number - 1) * 2 + qIndex) * config.segmentSpacing + config.segmentOffset;
    }

    if (which === 'review') {
      const suffixIndex = ['a', 'b', 'c', 'd'].indexOf(suffix);
      if (suffixIndex < 0) throw new Error('Invalid segment');
      return ((number - 1) * 4 + suffixIndex) * config.segmentSpacing + config.segmentOffset;
    }

    throw new Error('Invalid audio type');
  }

  async function play(which, id) {
    stop();
    const request = generation;
    const offset = getOffset(which, id);

    try {
      const ctx = getContext();
      const resumed = ctx.state === 'running' ? Promise.resolve() : ctx.resume();
      const [buffer] = await Promise.all([load(which), resumed]);

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

      playing.start(
        0,
        offset,
        Math.min(config.segmentSeconds, buffer.duration - offset)
      );
      return true;
    } catch (error) {
      if (request !== generation) return false;

      const element = elementFor(which);
      media = element;
      controller = new AbortController();
      const signal = controller.signal;

      try {
        if (element.readyState < 1) {
          await waitFor(element, 'loadedmetadata', signal, () => element.load());
        }

        if (request !== generation) return false;
        if (offset >= element.duration) throw new Error('Segment outside audio');

        if (Math.abs(element.currentTime - offset) > 0.001) {
          await waitFor(element, 'seeked', signal, () => {
            element.currentTime = offset;
          });
        }

        if (request !== generation) return false;

        await element.play();

        const end = Math.min(offset + config.segmentSeconds, element.duration);
        const finish = () => {
          if (request === generation) stop();
        };

        element.addEventListener('timeupdate', () => {
          if (element.currentTime >= end) finish();
        }, { signal });
        element.addEventListener('ended', finish, { once: true, signal });
        element.addEventListener('error', finish, { once: true, signal });

        stopTimer = setTimeout(finish, (end - offset) * 1000);
        return true;
      } catch (fallbackError) {
        if (request !== generation) return false;
        stop();
        throw fallbackError;
      }
    }
  }

  function preload() {
    // 本番で最初に使う質問側だけを先読み。
    void load('main').catch(() => {});
  }

  window.addEventListener('pagehide', stop);
  return Object.freeze({ play, stop, preload });
})();
