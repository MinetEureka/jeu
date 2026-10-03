// 正解音声は「練習」と「終了後の答え合わせ」でのみ使用。
// 本番中は game.js からこの再生関数を呼びません。
window.segmentAudio = (() => {
  const config = window.gameConfig;
  let context = null;
  let bufferPromise = null;
  let source = null;
  let media = null;
  let stopTimer = null;
  let generation = 0;

  function getContext() {
    const Constructor = window.AudioContext || window.webkitAudioContext;
    if (!Constructor) throw new Error("Web Audio unavailable");
    if (!context) context = new Constructor();
    return context;
  }

  function loadBuffer() {
    if (!bufferPromise) {
      bufferPromise = (async () => {
        const ctx = getContext();
        const response = await fetch(config.mainAudio, { cache: "force-cache" });
        if (!response.ok) throw new Error(`Audio HTTP ${response.status}`);
        return await ctx.decodeAudioData(await response.arrayBuffer());
      })();
      bufferPromise.catch(() => {
        bufferPromise = null;
      });
    }
    return bufferPromise;
  }

  function stop() {
    generation++;
    clearTimeout(stopTimer);

    if (source) {
      source.onended = null;
      try { source.stop(); } catch (_) {}
      try { source.disconnect(); } catch (_) {}
      source = null;
    }

    if (media) {
      try { media.pause(); } catch (_) {}
      media = null;
    }
  }

  async function play(id) {
    stop();

    const match = /^(\d{2})$/.exec(String(id));
    if (!match) throw new Error("Invalid segment");

    const numericId = +match[1];
    if (numericId < 1 || numericId > 50) throw new Error("Invalid segment");

    const request = generation;
    const offset =
      (numericId - 1) * config.segmentSpacing + config.segmentOffset;

    try {
      const ctx = getContext();
      if (ctx.state !== "running") await ctx.resume();

      const buffer = await loadBuffer();
      if (request !== generation) return false;
      if (offset >= buffer.duration) throw new Error("Segment outside audio");

      source = ctx.createBufferSource();
      const playing = source;
      playing.buffer = buffer;
      playing.connect(ctx.destination);
      playing.onended = () => {
        try { playing.disconnect(); } catch (_) {}
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

      const element = document.getElementById("audio-player");
      if (!element) throw error;

      media = element;
      element.src = config.mainAudio;

      if (element.readyState < 1) {
        await new Promise((resolve, reject) => {
          const ready = () => cleanup(resolve);
          const failed = () => cleanup(() => reject(new Error("Audio loading failed")));
          const cleanup = callback => {
            element.removeEventListener("loadedmetadata", ready);
            element.removeEventListener("error", failed);
            callback();
          };
          element.addEventListener("loadedmetadata", ready, { once: true });
          element.addEventListener("error", failed, { once: true });
          element.load();
        });
      }

      if (request !== generation) return false;
      if (offset >= element.duration) throw new Error("Segment outside audio");

      element.currentTime = offset;
      await element.play();

      const duration = Math.min(
        config.segmentSeconds,
        element.duration - offset
      );

      stopTimer = setTimeout(() => {
        if (request === generation) stop();
      }, duration * 1000);

      return true;
    }
  }


  let preparing = false;
  let progressFrame = 0;
  let progressStartedAt = 0;
  let displayedProgress = 0;

  function setProgress(value) {
    displayedProgress = Math.max(0, Math.min(100, value));
    const bar = document.getElementById('audio-progress-bar');
    if (bar) bar.style.width = displayedProgress.toFixed(1) + '%';
  }

  function startFakeProgress() {
    cancelAnimationFrame(progressFrame);
    progressStartedAt = performance.now();
    displayedProgress = 0;
    setProgress(0);

    const tick = now => {
      const seconds = (now - progressStartedAt) / 1000;
      let value;

      // 10秒を目安にした表示。5秒で約50%、その後は90%前後で減速します。
      if (seconds <= 5) {
        value = seconds * 10;
      } else {
        value = 50 + 42 * (1 - Math.exp(-(seconds - 5) / 2.2));
      }

      setProgress(Math.min(value, 92));
      progressFrame = requestAnimationFrame(tick);
    };

    progressFrame = requestAnimationFrame(tick);
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
    setProgress(0);
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

      timer = setTimeout(
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
    const progressWrap = document.getElementById('audio-progress-wrap');
    const mainElement = document.getElementById('audio-player');
    const reviewElement = document.getElementById('audio-re-player');

    if (gateButton) gateButton.disabled = true;

    // Commencer の実クリック中に Safari の user activation を確保します。
    try {
      const ctx = getContext();
      if (ctx.state !== 'running') void ctx.resume().catch(() => {});
    } catch (_) {}

    // 暗転はすぐ解除。学籍番号入力などを進めながら音声を準備します。
    if (gate) gate.style.display = 'none';
    if (status) status.style.display = 'block';
    if (progressWrap) progressWrap.style.display = 'block';
    if (startButton) startButton.style.display = 'none';
    startFakeProgress();

    const tasks = [
      waitUntilPlayable(mainElement, config.mainAudio)
    ];

    // HTTP/HTTPSではmainのfetch＋decodeAudioData完了まで待ちます。
    // file://ではfetchを使わず、HTMLAudioの準備完了でローカル確認できます。
    if (location.protocol === 'http:' || location.protocol === 'https:') {
      tasks.push(loadBuffer());
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


  window.addEventListener("pagehide", stop);

  return Object.freeze({ play, stop, preload, prepare: beginAudioPreparation });
})();
