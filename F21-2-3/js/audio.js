// 質問・回答を通して同時再生は1つ。古い非同期リクエストは無効化します。
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

  function load(which) {
    if (!loads.has(which)) {
      const promise = (async () => {
        const ctx = getContext();
        const abort = new AbortController();
        const timer = setTimeout(() => abort.abort(), 30000);
        try {
          const response = await fetch(which === 'main' ? config.mainAudio : config.reviewAudio,
            { cache: 'force-cache', signal: abort.signal });
          if (!response.ok) throw new Error(`Audio HTTP ${response.status}`);
          return await ctx.decodeAudioData(await response.arrayBuffer());
        } finally { clearTimeout(timer); }
      })();
      loads.set(which, promise);
      promise.catch(() => { if (loads.get(which) === promise) loads.delete(which); });
    }
    return loads.get(which);
  }

  function stop() {
    generation++;
    clearTimeout(stopTimer);
    if (controller) { controller.abort(); controller = null; }
    if (source) {
      source.onended = null;
      try { source.stop(); } catch (_) {}
      source.disconnect(); source = null;
    }
    if (media) { media.pause(); media = null; }
  }

  // eventリスナーは成功・失敗・キャンセルの全経路で除去します。
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

  async function play(which, id) {
    stop();
    const request = generation;
    const match = /^(\d{2})([ab])$/.exec(id);
    if (!match || +match[1] < 1 || +match[1] > 50) throw new Error('Invalid segment');
    const offset = ((+match[1] - 1) * 2 + (match[2] === 'b' ? 1 : 0)) * config.segmentSpacing + config.segmentOffset;
    try {
      // ユーザー操作の呼び出し中にresumeを実行します。
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
      playing.onended = () => { playing.disconnect(); if (source === playing) source = null; };
      playing.start(0, offset, Math.min(config.segmentSeconds, buffer.duration - offset));
      return true;
    } catch (error) {
      if (request !== generation) return false;
      if (source) { try { source.stop(); } catch (_) {} source.disconnect(); source = null; }
      // Web Audioが利用できない環境では、seekedを待ってから再生します。
      const element = document.getElementById(which === 'main' ? 'audio-player' : 'audio-re-player');
      media = element;
      controller = new AbortController();
      const signal = controller.signal;
      try {
        if (element.readyState < 1) await waitFor(element, 'loadedmetadata', signal, () => element.load());
        if (request !== generation) return false;
        if (offset >= element.duration) throw new Error('Segment outside audio');
        if (Math.abs(element.currentTime - offset) > 0.001) {
          await waitFor(element, 'seeked', signal, () => { element.currentTime = offset; });
        }
        if (request !== generation) return false;
        await element.play();
        if (request !== generation) {
          // 次のリクエストが同じ要素を使っている場合、その再生を止めません。
          if (media !== element) element.pause();
          return false;
        }
        const end = Math.min(offset + config.segmentSeconds, element.duration);
        const finish = () => { if (request === generation) stop(); };
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

  let preparing = false;

  function hasReviewAudio() {
    return typeof config.reviewAudio === 'string' && config.reviewAudio.trim() !== '';
  }

  function waitUntilPlayable(element, src, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      if (!element || !src) {
        reject(new Error('Audio element or source is missing'));
        return;
      }

      let finished = false;
      const finish = error => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
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

      // すでに使用可能なら即完了。
      if (element.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
        finish();
        return;
      }

      const timer = setTimeout(
        () => finish(new Error('Audio loading timed out')),
        timeoutMs
      );

      try {
        element.load();
      } catch (error) {
        finish(error);
      }
    });
  }

  function beginAudioPreparation() {
    if (preparing) return;
    preparing = true;

    const gate = document.getElementById('audio-start-gate');
    const gateButton = document.getElementById('audio-start-gate-button');
    const gateText = document.getElementById('audio-start-gate-text');
    const startButton = document.getElementById('start-btn');
    const status = document.getElementById('audio-load-status');
    const mainElement = document.getElementById('audio-player');
    const reviewElement = document.getElementById('audio-re-player');

    if (gateButton) gateButton.disabled = true;

    // Commencer の実クリック中に Safari の user activation を確保。
    try {
      const ctx = getContext();
      if (ctx.state !== 'running') void ctx.resume().catch(() => {});
    } catch (_) {}

    // 暗転はすぐ解除。学生は学籍番号入力などを進められる。
    if (gate) gate.style.display = 'none';
    if (status) status.style.display = 'inline';
    if (startButton) startButton.style.display = 'none';

    const tasks = [
      waitUntilPlayable(mainElement, config.mainAudio)
    ];
    if (hasReviewAudio()) {
      tasks.push(waitUntilPlayable(reviewElement, config.reviewAudio));
    }

    // HTTP/HTTPS では、実際のゲームで使う Web Audio の
    // fetch + decodeAudioData 完了まで「準備中」として待ちます。
    // file:// では fetch() が使えないため、HTMLAudio の準備だけを待ちます。
    if (location.protocol === 'http:' || location.protocol === 'https:') {
      tasks.push(load('main'));
      if (hasReviewAudio()) tasks.push(load('review'));
    }

    Promise.all(tasks).then(() => {
      preparing = false;
      if (status) status.style.display = 'none';
      if (startButton) startButton.style.display = '';
    }).catch(error => {
      console.error('Audio preparation failed:', error);
      preparing = false;
      if (status) status.style.display = 'none';
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
