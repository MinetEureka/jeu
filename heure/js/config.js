// このゲームは1画像につき音声1つ。01=0秒、02=10秒、…です。
window.gameConfig = Object.freeze({
  maxCards: null, // nullならreponses.jsのmaxVerbe（この時刻版は30）。指定する場合は1〜50。
  choices: 6,
  rounds: 10,
  segmentSpacing: 10,
  segmentOffset: 3,
  segmentSeconds: 5,
  mainAudio: 'audio.m4a' // 元のMP3を使う場合は 'audio.mp3' に変更。
});
