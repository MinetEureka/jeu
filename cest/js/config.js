// maxCards を指定すると reponses.js の maxVerbe より優先します。
window.gameConfig = Object.freeze({
  maxCards: null,
  rounds: 5,
  answerSeconds: 12,

  // 1区画10秒
  segmentSpacing: 10,
  segmentOffset: 0,
  segmentSeconds: 7,

  // audio.m4a: 各語につき質問2本だけ（a, c）
  // 01a=0秒, 01c=10秒, 02a=20秒, 02c=30秒 ...
  mainAudio: 'audio.m4a',

  // audioRe.m4a: 各語につき答え4本（a, b, c, d）
  // 01a=0秒, 01b=10秒, 01c=20秒, 01d=30秒,
  // 02a=40秒 ...
  reviewAudio: 'audioRe.m4a'
});
