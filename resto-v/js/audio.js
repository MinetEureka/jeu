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

  function preload() {
    try {
      const player = document.getElementById("audio-player");
      if (player) player.src = config.mainAudio;
    } catch (_) {}

    // Web Audioの先読みは失敗してもゲーム本体には影響させない。
    try {
      void loadBuffer().catch(() => {});
    } catch (_) {}
  }

  window.addEventListener("pagehide", stop);

  return Object.freeze({ play, stop, preload });
})();
