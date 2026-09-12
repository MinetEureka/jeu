"use strict";

const config = window.gameConfig;
const responses = window.responses || {};
const maxCards = config.maxCards ?? (typeof maxVerbe !== "undefined" ? maxVerbe : NaN);

const normalizeAnswer = value =>
  String(value ?? "")
    .normalize("NFC")
    .trim()
    .toLowerCase()
    .replace(/’/g, "'");

const escapeHTML = value =>
  String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);

let phase = "idle";
let turn = 0;
let score = 0;
let studentId = "";
let currentImage = "";
let correctAnswer = "";
let answerDeadline = 0;
let timerFrame = 0;
let history = [];
let questionOrder = [];
let orderIndex = 0;

function showToast(message) {
  const node = document.getElementById("toast");
  if (!node) return;

  node.textContent = message;
  node.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    node.hidden = true;
  }, 1800);
}

function validateSetup() {
  if (!Number.isInteger(maxCards) || maxCards < 1 || maxCards > 50) {
    throw new Error("カードの種類数は1〜50の整数にしてください。");
  }

  if (!Number.isInteger(config.rounds) || config.rounds < 1) {
    throw new Error("問題数は1以上の整数にしてください。");
  }

  if (!Number.isFinite(config.answerSeconds) || config.answerSeconds <= 0) {
    throw new Error("回答時間を確認してください。");
  }

  if (
    ![config.segmentSpacing, config.segmentOffset, config.segmentSeconds]
      .every(Number.isFinite) ||
    config.segmentSpacing <= 0 ||
    config.segmentOffset < 0 ||
    config.segmentSeconds <= 0 ||
    config.segmentOffset + config.segmentSeconds > config.segmentSpacing
  ) {
    throw new Error("音声区間の設定を確認してください。");
  }

  for (let n = 1; n <= maxCards; n++) {
    const id = String(n).padStart(2, "0");
    if (typeof responses[id] !== "string" || !responses[id].trim()) {
      throw new Error(`回答データ ${id} がありません。reponses.jsを確認してください。`);
    }
  }

  if (typeof window.computePassword !== "function") {
    throw new Error("提出コードの計算ファイルを読み込めません。");
  }

  if (!window.segmentAudio || typeof window.segmentAudio.play !== "function") {
    throw new Error("audio.jsを読み込めません。");
  }

  window.computePassword("0000", 0);
}

function shuffledIds() {
  const ids = Array.from(
    { length: maxCards },
    (_, i) => String(i + 1).padStart(2, "0")
  );

  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }

  return ids;
}

function buildQuestionOrder() {
  const result = [];

  while (result.length < config.rounds) {
    result.push(...shuffledIds());
  }

  return result.slice(0, config.rounds);
}

/* ===== 練習 =====
   テキストは表示しない。
   イラストと正解音声の再生ボタンだけ。
*/
function renderPractice() {
  const container = document.getElementById("today-list");
  if (!container) return;

  container.innerHTML = "";

  for (let n = 1; n <= maxCards; n++) {
    const id = String(n).padStart(2, "0");

    const card = document.createElement("div");
    card.className = "practice-card";

    const img = document.createElement("img");
    img.src = `image/image-${id}.png`;
    img.alt = `練習イラスト ${id}`;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "practice-play";
    button.textContent = "▶";
    button.setAttribute("aria-label", `音声 ${id} を再生`);
    button.onclick = () => playCorrectAudio(id);

    card.appendChild(img);
    card.appendChild(button);
    container.appendChild(card);
  }
}

function playCorrectAudio(id) {
  if (phase === "answering" || phase === "timedout" || phase === "submitting") {
    return;
  }

  void window.segmentAudio.play(id).catch(() => {
    showToast("音声を再生できません。もう一度押してください。");
  });
}

/* ===== 初期化 ===== */
window.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("text-input");
  const action = document.getElementById("action-button");
  const player = document.getElementById("audio-player");

  if (player) player.src = config.mainAudio;

  try {
    validateSetup();
    renderPractice();
  } catch (error) {
    document.getElementById("start-btn").disabled = true;
    document.getElementById("today-title").textContent = error.message;
    return;
  }

  input.addEventListener("beforeinput", event => {
    if (phase !== "answering" || Date.now() >= answerDeadline) {
      event.preventDefault();
    }
  });

  input.addEventListener("keydown", event => {
    if (
      event.key === "Enter" &&
      !event.isComposing &&
      !event.repeat
    ) {
      event.preventDefault();

      if (phase === "answering") {
        submitAnswer();
      } else if (phase === "timedout") {
        goNext();
      }
    }
  });

  action.addEventListener("click", () => {
    if (phase === "answering") {
      submitAnswer();
    } else if (phase === "timedout") {
      goNext();
    }
  });

  // 練習用音声だけ先読み。
  window.segmentAudio.preload();
});

/* ===== 本番 ===== */
function startGame() {
  if (phase !== "idle") return;

  studentId = document.getElementById("student-id").value.trim();

  if (!/^\d{4}$/.test(studentId)) {
    alert("学籍番号の下4桁を半角数字で入力してください。");
    return;
  }

  try {
    validateSetup();
  } catch (error) {
    alert(error.message);
    return;
  }

  // 練習中の音声が残っていれば止める。
  window.segmentAudio.stop();

  turn = 0;
  score = 0;
  history = [];
  questionOrder = buildQuestionOrder();
  orderIndex = 0;

  document.getElementById("start-section").style.display = "none";
  document.getElementById("intro-image").style.display = "none";
  document.getElementById("today-section").style.display = "none";
  document.getElementById("game-info").style.display = "flex";
  document.getElementById("result").style.display = "none";

  nextTurn();
}

function nextTurn() {
  cancelAnimationFrame(timerFrame);
  window.segmentAudio.stop();

  if (orderIndex >= questionOrder.length) {
    endGame();
    return;
  }

  phase = "answering";
  turn++;
  currentImage = questionOrder[orderIndex++];
  correctAnswer = normalizeAnswer(responses[currentImage]);

  document.getElementById("turn-info").textContent =
    `${turn} / ${config.rounds}`;
  document.getElementById("question-progress").textContent =
    `${turn} / ${config.rounds}`;
  document.getElementById("score-info").textContent =
    `スコア：${score}/${config.rounds}`;

  const overlay = document.getElementById("overlay");
  const image = document.getElementById("question-image");
  const input = document.getElementById("text-input");
  const action = document.getElementById("action-button");
  const timeoutMessage = document.getElementById("timeout-message");
  const progress = document.getElementById("timer-progress");

  image.src = `image/image-${currentImage}.png`;
  image.alt = `問題 ${currentImage}`;

  input.value = "";
  input.disabled = false;
  action.textContent = "OK";
  timeoutMessage.hidden = true;
  progress.style.transform = "scaleX(1)";
  overlay.style.display = "flex";

  answerDeadline = Date.now() + config.answerSeconds * 1000;

  try {
    input.focus({ preventScroll: true });
  } catch (_) {
    input.focus();
  }

  // 重要：本番では音声再生を一切行わない。
  updateTimerBar();
}

function updateTimerBar() {
  if (phase !== "answering") return;

  const now = Date.now();
  const remaining = Math.max(0, answerDeadline - now);
  const total = config.answerSeconds * 1000;
  const ratio = total > 0 ? remaining / total : 0;

  document.getElementById("timer-progress").style.transform =
    `scaleX(${ratio})`;

  if (remaining <= 0) {
    forceTimeout();
    return;
  }

  timerFrame = requestAnimationFrame(updateTimerBar);
}

function makeHistoryEntry(userAnswer, timedOut) {
  const normalizedUser = normalizeAnswer(userAnswer);
  const isCorrect = normalizedUser === correctAnswer;

  const entry = {
    turn,
    image: currentImage,
    user: normalizedUser,
    correct: correctAnswer,
    isCorrect,
    timedOut
  };

  history.push(entry);

  if (isCorrect) score++;

  document.getElementById("score-info").textContent =
    `スコア：${score}/${config.rounds}`;

  return entry;
}

function submitAnswer() {
  if (phase !== "answering") return;

  if (Date.now() >= answerDeadline) {
    forceTimeout();
    return;
  }

  phase = "submitting";
  cancelAnimationFrame(timerFrame);

  const input = document.getElementById("text-input");
  makeHistoryEntry(input.value, false);

  if (history.length >= config.rounds) {
    endGame();
  } else {
    nextTurn();
  }
}

function forceTimeout() {
  if (phase !== "answering") return;

  phase = "timedout";
  cancelAnimationFrame(timerFrame);

  const input = document.getElementById("text-input");
  const action = document.getElementById("action-button");
  const timeoutMessage = document.getElementById("timeout-message");
  const progress = document.getElementById("timer-progress");

  // 0秒時点で入力欄に存在する内容を強制確定。
  makeHistoryEntry(input.value, true);

  input.disabled = true;
  input.blur();
  progress.style.transform = "scaleX(0)";
  timeoutMessage.hidden = false;
  action.textContent =
    history.length >= config.rounds ? "結果へ" : "次へ";
}

function goNext() {
  if (phase !== "timedout") return;

  if (history.length >= config.rounds) {
    endGame();
  } else {
    nextTurn();
  }
}

/* ===== 終了後 ===== */
function recomputeScoreFromHistory() {
  score = history.filter(item => item.isCorrect).length;
}

function endGame() {
  phase = "finished";
  cancelAnimationFrame(timerFrame);
  window.segmentAudio.stop();

  recomputeScoreFromHistory();

  document.getElementById("overlay").style.display = "none";
  document.getElementById("game-info").style.display = "none";

  let finalPassword = "";

  try {
    finalPassword = window.computePassword(studentId, score);
  } catch (error) {
    console.error(error);
  }

  const result = document.getElementById("result");
  result.style.display = "block";

  result.innerHTML = `
    <p>スコア：${score}/${config.rounds}</p>
    <p>パスワード：<span id="final-password">${escapeHTML(finalPassword || "(生成エラー)")}</span></p>
    <button id="copy-btn" onclick="copyPassword()" ${finalPassword ? "" : "disabled"}>コピー</button>
    <p>パスワードをコピーして、元のFormsで提出してください</p>
    <button onclick="returnToForms()">Formsへ戻る</button>
  `;

  // ここで初めて正解テキストを表示する。
  let historyHtml =
    "<table><tr>" +
    "<th>問題</th>" +
    "<th>イラスト</th>" +
    "<th>あなたの答え</th>" +
    "<th>正解</th>" +
    "<th>音声</th>" +
    "<th>判定</th>" +
    "<th>時間</th>" +
    "</tr>";

  history.forEach(item => {
    historyHtml += `
      <tr>
        <td>${item.turn}</td>
        <td><img src="image/image-${item.image}.png" alt="image-${item.image}" style="width:72px;height:auto;"></td>
        <td>${escapeHTML(item.user)}</td>
        <td>${escapeHTML(item.correct)}</td>
        <td><button class="review-play" onclick="playCorrectAudio('${item.image}')">▶</button></td>
        <td>${item.isCorrect ? "〇" : "×"}</td>
        <td>${item.timedOut ? "時間切れ" : ""}</td>
      </tr>
    `;
  });

  historyHtml += "</table>";

  result.insertAdjacentHTML(
    "beforeend",
    `<div class="history-scroll">${historyHtml}</div>`
  );

  if (finalPassword) {
    try {
      navigator.clipboard.writeText(finalPassword)
        .then(() => showToast("パスワードを自動コピーしました。"))
        .catch(() => {});
    } catch (_) {}
  }

  result.scrollIntoView({ behavior: "smooth" });
}

async function copyPassword() {
  const node = document.getElementById("final-password");
  if (!node) return;

  const password = node.textContent;

  try {
    await navigator.clipboard.writeText(password);
    showToast("パスワードをコピーしました。");
  } catch (_) {
    window.prompt("以下を選択してコピーしてください。", password);
  }
}

function returnToForms() {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    alert("元のFormsのタブに戻って、パスワードを貼り付けてください。");
  }
}
