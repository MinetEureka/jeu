// maxCardsを指定すると、reponses.jsのmaxVerbeより優先します。
window.gameConfig = Object.freeze({
  maxCards: null, // null: 既存maxVerbeを使用。指定する場合は1〜50。
  choices: 6,
  rounds: 10,
  leadMs: 2000,
  answerSeconds: 5,
  segmentSpacing: 10,
  segmentOffset: 2, // 最初の修正版と同じく、各区間の先頭から再生
  segmentSeconds: 5,
  mainAudio: 'audio.m4a', // M4Aを使う場合はここを変更
  reviewAudio: 'audioRe.m4a'
});
