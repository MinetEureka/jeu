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

  function setStatus(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

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
      const cleanup = () => {
        clearTimeout(timer);
        element.removeEventListener('canplaythrough', ready);
        element.removeEventListener('canplay', ready);
        element.removeEventListener('error', failed);
      };
      const finish = (error) => {
        if (finished) return;
        finished = true;
        cleanup();
        error ? reject(error) : resolve();
      };
      const ready = () => finish();
      const failed = () => finish(new Error('Audio loading failed'));
      const timer = setTimeout(() => finish(new Error('Audio loading timed out')), timeoutMs);

      element.addEventListener('canplaythrough', ready, { once: true });
      element.addEventListener('canplay', ready, { once: true });
      element.addEventListener('error', failed, { once: true });

      // game.js normally sets src before calling preload(), but set it here too
      // so the readiness check remains self-contained.
      if (element.getAttribute('src') !== src) element.src = src;

      if (element.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
        finish();
        return;
      }

      element.preload = 'auto';
      try {
        element.load();
      } catch (error) {
        finish(error);
      }
    });
  }

  async function prepareAudioFiles() {
    if (preparing) return;
    preparing = true;

    const overlay = document.getElementById('audio-loading-overlay');
    const retry = document.getElementById('audio-loading-retry');
    const mainElement = document.getElementById('audio-player');
    const reviewElement = document.getElementById('audio-re-player');
    const needsReview = hasReviewAudio();

    if (overlay) overlay.style.display = 'flex';
    if (retry) retry.style.display = 'none';
    setStatus('audio-loading-title', '音声を準備しています……');
    setStatus('audio-main-status', '質問の音声をロードしています……');

    const reviewStatus = document.getElementById('audio-review-status');
    if (reviewStatus) {
      reviewStatus.style.display = needsReview ? '' : 'none';
      if (needsReview) reviewStatus.textContent = '答えの音声をロードしています……';
    }

    try {
      await waitUntilPlayable(mainElement, config.mainAudio);
      setStatus('audio-main-status', '質問の音声をロードしています……完了');

      if (needsReview) {
        await waitUntilPlayable(reviewElement, config.reviewAudio);
        setStatus('audio-review-status', '答えの音声をロードしています……完了');
      }

      if (overlay) overlay.style.display = 'none';

      // Preserve the original optimization: begin Web Audio decoding of main
      // after the media files are ready, without blocking the UI.
      void load('main').catch(() => {});
    } catch (error) {
      console.error('Audio preparation failed:', error);
      setStatus('audio-loading-title', '音声を読み込めませんでした');
      if (retry) retry.style.display = 'inline-block';
    } finally {
      preparing = false;
    }
  }

  function preload() {
    // 初回
    void prepareAudioFiles();

    // 5秒おきに、手動ボタンと同じ一行だけを呼ぶ
    const prepareRetryTimer = setInterval(() => {
      void prepareAudioFiles();
    }, 5000);

    // 30秒で自動呼び出しだけ終了。
    // 以後は従来どおり「もう一度読み込む」ボタンで再試行できる。
    setTimeout(() => {
      clearInterval(prepareRetryTimer);
    }, 30000);
  }


  window.addEventListener('pagehide', stop);
  return Object.freeze({ play, stop, preload });
})();
