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



  let preparing = false;
  let progressFrame = 0;
  let progressStartedAt = 0;
  let decodeStartedAt = 0;
  let displayedProgress = 0;
  let progressPhase = 'loading';

  function setStatus(text) {
    const status = document.getElementById('audio-load-status');
    if (status) status.textContent = text;
  }

  function setProgress(value) {
    displayedProgress = Math.max(0, Math.min(100, value));
    const bar = document.getElementById('audio-progress-bar');
    if (bar) bar.style.width = displayedProgress.toFixed(1) + '%';
  }

  function startFakeProgress() {
    cancelAnimationFrame(progressFrame);
    progressStartedAt = performance.now();
    decodeStartedAt = 0;
    displayedProgress = 0;
    progressPhase = 'loading';
    setStatus('音声を読み込んでいます…');
    setProgress(0);

    const tick = now => {
      let value;
      if (progressPhase === 'loading') {
        const seconds = (now - progressStartedAt) / 1000;
        value = Math.min(seconds * 10, 50);
      } else {
        const seconds = (now - decodeStartedAt) / 1000;
        value = 50 + 42 * (1 - Math.exp(-seconds / 2.2));
      }
      setProgress(Math.max(displayedProgress, Math.min(value, 92)));
      progressFrame = requestAnimationFrame(tick);
    };

    progressFrame = requestAnimationFrame(tick);
  }

  function beginDecodeStage() {
    if (progressPhase === 'decoding') return;
    progressPhase = 'decoding';
    decodeStartedAt = performance.now();
    if (displayedProgress < 50) setProgress(50);
    setStatus('音声を準備しています…');
  }

  function finishProgress() {
    cancelAnimationFrame(progressFrame);
    return new Promise(resolve => {
      const start = performance.now();
      const from = displayedProgress;
      const duration = 320;
      const tick = now => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        setProgress(from + (100 - from) * eased);
        if (t < 1) {
          progressFrame = requestAnimationFrame(tick);
        } else {
          setProgress(100);
          resolve();
        }
      };
      progressFrame = requestAnimationFrame(tick);
    });
  }

  function resetProgress() {
    cancelAnimationFrame(progressFrame);
    progressFrame = 0;
    progressPhase = 'loading';
    decodeStartedAt = 0;
    setProgress(0);
    setStatus('音声を読み込んでいます…');
  }

  function waitUntilPlayable(element, src, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      if (!element || !src) {
        reject(new Error('Audio element or source is missing'));
        return;
      }

      let finished = false;
      let timer = null;
      const finish = error => {
        if (finished) return;
        finished = true;
        if (timer) clearTimeout(timer);
        element.removeEventListener('canplaythrough', ready);
        element.removeEventListener('canplay', ready);
        element.removeEventListener('error', failed);
        error ? reject(error) : resolve();
      };
      const ready = () => finish();
      const failed = () => finish(new Error('Audio loading failed'));

      element.addEventListener('canplaythrough', ready, { once: true });
      element.addEventListener('canplay', ready, { once: true });
      element.addEventListener('error', failed, { once: true });

      if (element.getAttribute('src') !== src) element.src = src;
      element.preload = 'auto';

      if (element.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
        finish();
        return;
      }

      timer = setTimeout(() => finish(new Error('Audio loading timed out')), timeoutMs);

      try {
        element.load();
      } catch (error) {
        finish(error);
      }
    });
  }

  function prepareMainAudioData() {
    if (!loadPromise) {
      const promise = (async () => {
        const ctx = getContext();
        const abort = new AbortController();
        const timer = setTimeout(() => abort.abort(), 30000);
        try {
          const response = await fetch(config.mainAudio, { cache: 'force-cache', signal: abort.signal });
          if (!response.ok) throw new Error(`Audio HTTP ${response.status}`);
          const data = await response.arrayBuffer();
          beginDecodeStage();
          return await ctx.decodeAudioData(data);
        } finally {
          clearTimeout(timer);
        }
      })();
      loadPromise = promise;
      promise.catch(() => { if (loadPromise === promise) loadPromise = null; });
    }
    return loadPromise;
  }

  function beginAudioPreparation() {
    if (preparing) return;
    preparing = true;

    const gate = document.getElementById('audio-start-gate');
    const gateButton = document.getElementById('audio-start-gate-button');
    const gateText = document.getElementById('audio-start-gate-text');
    const startButton = document.getElementById('start-btn');
    const status = document.getElementById('audio-load-status');
    const progressWrap = document.getElementById('audio-progress-wrap');
    const mainElement = document.getElementById('audio-player');
    const reviewElement = document.getElementById('audio-re-player');

    if (gateButton) gateButton.disabled = true;

    try {
      const ctx = getContext();
      if (ctx.state !== 'running') void ctx.resume().catch(() => {});
    } catch (_) {}

    if (gate) gate.style.display = 'none';
    if (status) status.style.display = 'block';
    if (progressWrap) progressWrap.style.display = 'block';
    if (startButton) startButton.style.display = 'none';
    startFakeProgress();

    const tasks = [waitUntilPlayable(mainElement, config.mainAudio)];

    if (reviewElement && typeof config.reviewAudio === 'string' && config.reviewAudio.trim()) {
      try {
        if (reviewElement.getAttribute('src') !== config.reviewAudio) {
          reviewElement.src = config.reviewAudio;
        }
        reviewElement.preload = 'auto';
        reviewElement.load();
      } catch (_) {}
    }

    if (location.protocol === 'http:' || location.protocol === 'https:') {
      tasks.push(prepareMainAudioData());
    }

    Promise.all(tasks).then(async () => {
      await finishProgress();
      preparing = false;
      if (status) status.style.display = 'none';
      if (progressWrap) progressWrap.style.display = 'none';
      if (startButton) startButton.style.display = '';

    }).catch(error => {
      console.error('Audio preparation failed:', error);
      preparing = false;
      resetProgress();
      if (status) status.style.display = 'none';
      if (progressWrap) progressWrap.style.display = 'none';
      if (gateText) gateText.textContent = '音声を準備できませんでした。もう一度押してください';
      if (gateButton) gateButton.disabled = false;
      if (gate) gate.style.display = 'flex';
    });
  }

  function preload() {
    // ユーザー操作前には音声準備を開始しません。
  }



  window.addEventListener('pagehide', stop);
  return Object.freeze({ play, stop, preload, prepare: beginAudioPreparation });
})();
