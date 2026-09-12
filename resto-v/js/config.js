// 画像を見て、制限時間内にフランス語で答えるゲーム
window.gameConfig = Object.freeze({
  maxCards: null,       // nullならreponses.jsのmaxVerbeを使用。指定する場合は1〜50。
  rounds: 5,           // 出題数
  answerSeconds: 7,     // 回答時間。5秒にしたい場合は 5 に変更。

  // 練習・終了後確認で使う正解音声。
  // 01=最初の区間、02=次の区間…。
  segmentSpacing: 10,
  segmentOffset: 2,
  segmentSeconds: 5,
  mainAudio: 'audio.m4a'
});
