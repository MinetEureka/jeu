// 正解音声は「練習」と「終了後の答え合わせ」でのみ使用。
// 本番中は game.js からこの再生関数を呼びません。
window.segmentAudio = (() => {
  const config = window.gameConfig;
  const REACTION_AUDIO = 'reaction.m4a';
  const REACTION_SECONDS = 2;
  let startupPromise = null;
  let reactionPromise = null;
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




  async function loadReaction() {
    if (reactionPromise) return reactionPromise;
    reactionPromise = (async () => {
      const ctx = getContext();
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), 30000);
      try {
        const response = await fetch(REACTION_AUDIO, {
          cache: 'force-cache',
          signal: abort.signal
        });
        if (!response.ok) throw new Error(`Audio HTTP ${response.status}`);
        return await ctx.decodeAudioData(await response.arrayBuffer());
      } finally {
        clearTimeout(timer);
      }
    })();
    reactionPromise.catch(() => { reactionPromise = null; });
    return reactionPromise;
  }

  function waitForReactionEvent(element, event, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      let done = false;
      let timer = null;
      const cleanup = () => {
        if (timer) clearTimeout(timer);
        element.removeEventListener(event, ready);
        element.removeEventListener('error', failed);
      };
      const finish = (error) => {
        if (done) return;
        done = true;
        cleanup();
        error ? reject(error) : resolve();
      };
      const ready = () => finish();
      const failed = () => finish(new Error('Reaction audio loading failed'));
      element.addEventListener(event, ready, { once: true });
      element.addEventListener('error', failed, { once: true });
      timer = setTimeout(() => finish(new Error('Reaction audio timed out')), timeoutMs);
    });
  }

  async function playReaction(isCorrect) {
    stop();
    const request = generation;
    const offset = isCorrect ? 0 : 10;

    try {
      const ctx = getContext();
      const resumed = ctx.state === 'running' ? Promise.resolve() : ctx.resume();
      const [buffer] = await Promise.all([loadReaction(), resumed]);
      if (request !== generation) return false;
      if (ctx.state !== 'running') throw new Error('Audio context suspended');
      if (offset >= buffer.duration) throw new Error('Reaction segment outside audio');

      source = ctx.createBufferSource();
      const playing = source;
      playing.buffer = buffer;
      playing.connect(ctx.destination);
      playing.onended = () => {
        playing.disconnect();
        if (source === playing) source = null;
      };
      playing.start(0, offset, Math.min(REACTION_SECONDS, buffer.duration - offset));
      return true;
    } catch (error) {
      if (request !== generation) return false;
      if (source) {
        try { source.stop(); } catch (_) {}
        try { source.disconnect(); } catch (_) {}
        source = null;
      }

      const element = document.getElementById('audio-reaction-player');
      if (!element) throw error;
      media = element;
      try {
        if (element.readyState < 1) {
          element.load();
          await waitForReactionEvent(element, 'loadedmetadata');
        }
        if (request !== generation) return false;
        if (offset >= element.duration) throw new Error('Reaction segment outside audio');
        if (Math.abs(element.currentTime - offset) > 0.001) {
          element.currentTime = offset;
          await waitForReactionEvent(element, 'seeked');
        }
        if (request !== generation) return false;
        await element.play();
        if (request !== generation) return false;

        const end = Math.min(offset + REACTION_SECONDS, element.duration);
        stopTimer = setTimeout(() => {
          if (request === generation) stop();
        }, Math.max(0, end - offset) * 1000);
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

  function prepareStartupAudioData() {
    if (!startupPromise) {
      startupPromise = (async () => {
        const ctx = getContext();

        async function fetchData(src) {
          const abort = new AbortController();
          const timer = setTimeout(() => abort.abort(), 30000);
          try {
            const response = await fetch(src, { cache: 'force-cache', signal: abort.signal });
            if (!response.ok) throw new Error(`Audio HTTP ${response.status}`);
            return await response.arrayBuffer();
          } finally {
            clearTimeout(timer);
          }
        }

        // main と reaction の転送が両方終わってからデコード段階へ移ります。
        const [mainData, reactionData] = await Promise.all([
          fetchData(config.mainAudio),
          fetchData(REACTION_AUDIO)
        ]);

        beginDecodeStage();

        const [mainBuffer, reactionBuffer] = await Promise.all([
          ctx.decodeAudioData(mainData),
          ctx.decodeAudioData(reactionData)
        ]);
        return { main: mainBuffer, reaction: reactionBuffer };
      })();

      const mainReady = startupPromise.then(buffers => buffers.main);
      const reactionReady = startupPromise.then(buffers => buffers.reaction);
      bufferPromise = mainReady;
      reactionPromise = reactionReady;
      startupPromise.catch(() => {
        startupPromise = null;
        if (bufferPromise === mainReady) bufferPromise = null;
        if (reactionPromise === reactionReady) reactionPromise = null;
      });
    }
    return startupPromise;
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
    const reactionElement = document.getElementById('audio-reaction-player');

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

    const tasks = [
      waitUntilPlayable(mainElement, config.mainAudio)
    ];

    // reaction.m4a はフォールバック用HTMLAudioもユーザー操作中に準備しますが、
    // iOSでは canplay 到達をスタート条件にはしません。
    // 実際の必須条件は下の Web Audio fetch + decode 完了です。
    if (reactionElement) {
      try {
        if (reactionElement.getAttribute('src') !== REACTION_AUDIO) {
          reactionElement.src = REACTION_AUDIO;
        }
        reactionElement.preload = 'auto';
        reactionElement.load();
      } catch (_) {}
    }

    if (location.protocol === 'http:' || location.protocol === 'https:') {
      // GitHub Pages / smartphone: main + reaction の fetch と decode 完了を必須にします。
      tasks.push(prepareStartupAudioData());
    } else {
      // file:// のローカル確認では fetch が使えないため、HTMLAudio 側で reaction を確認します。
      tasks.push(waitUntilPlayable(reactionElement, REACTION_AUDIO));
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

  return Object.freeze({ play, playReaction, stop, preload, prepare: beginAudioPreparation });
})();
