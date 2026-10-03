'use strict';

const config = window.gameConfig;
const responses = window.responses || {};
const maxCards = config.maxCards ?? (typeof maxVerbe !== 'undefined' ? maxVerbe : NaN);
const suffixes = ['a', 'b', 'c', 'd'];

let phase = 'idle';
let studentId = '';
let turn = 0;
let score = 0;
let countdown = null;
let answerDeadline = 0;
let timerStarted = false;
let history = [];

let baseId = '';
let currentAnswerId = '';
let currentQuestionId = '';
let displayedImageId = '';
let selectedYesNo = '';
let correctYesNo = '';
let correctAnswer = '';
let isPlural = false;
let currentPreviewId = '';

function normalizeAnswer(value) {
  return String(value)
    .normalize('NFC')
    .trim()
    .toLowerCase()
    .replace(/’/g, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/[.,!?;:…]+$/g, '')
    .replace(/\s+/g, ' ');
}

function acceptedAnswersFor(answerId) {
  const raw = responses[answerId];
  const list = Array.isArray(raw) ? raw : [raw];
  return list.map(normalizeAnswer);
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  })[char]);
}

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.style.display = 'block';
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => {
    toast.style.display = 'none';
  }, 1300);
}

function questionIdFromAnswerId(answerId) {
  const match = /^(\d{2})([a-d])$/.exec(answerId);
  if (!match) throw new Error('Invalid answer id');

  const id = match[1];
  const suffix = match[2];

  return id + ((suffix === 'a' || suffix === 'b') ? 'a' : 'c');
}

function validateSetup() {
  if (!Number.isInteger(maxCards) || maxCards < 2 || maxCards > 50) {
    throw new Error('カードの種類数は2〜50の整数で指定してください。');
  }

  if (!Number.isInteger(config.rounds) || config.rounds < 1) {
    throw new Error('問題数は1以上の整数で指定してください。');
  }

  if (!Number.isFinite(config.answerSeconds) || config.answerSeconds <= 0) {
    throw new Error('answerSeconds を確認してください。');
  }

  if (
    ![config.segmentSpacing, config.segmentOffset, config.segmentSeconds].every(Number.isFinite) ||
    config.segmentSpacing <= 0 ||
    config.segmentOffset < 0 ||
    config.segmentSeconds <= 0 ||
    config.segmentOffset + config.segmentSeconds > config.segmentSpacing
  ) {
    throw new Error('音声区間の設定を確認してください。');
  }

  for (let n = 1; n <= maxCards; n++) {
    const id = String(n).padStart(2, '0');

    for (const suffix of suffixes) {
      const key = id + suffix;
      const response = responses[key];
      const valid =
        (typeof response === 'string' && response.trim()) ||
        (
          Array.isArray(response) &&
          response.length > 0 &&
          response.every(item => typeof item === 'string' && item.trim())
        );

      if (!valid) {
        throw new Error(`回答データ ${key} がありません。reponses.jsを確認してください。`);
      }
    }
  }

  if (typeof window.computePassword !== 'function') {
    throw new Error('パスワード計算ファイルを読み込めません。');
  }

  window.computePassword('0000', 0);
}

function randomBaseId() {
  return String(
    Math.floor(Math.random() * maxCards) + 1
  ).padStart(2, '0');
}

function randomIdExcept(excludedId) {
  let id;
  do {
    id = randomBaseId();
  } while (id === excludedId);
  return id;
}

/* ===== 練習パート ===== */
function renderTodayItems() {
  const container = document.getElementById('today-list');
  if (!container) return;

  container.innerHTML = '';

  for (let n = 1; n <= maxCards; n++) {
    const id = String(n).padStart(2, '0');

    const card = document.createElement('div');
    card.className = 'preview-card';

    const image = document.createElement('img');
    image.src = `image/image-${id}.png`;
    image.alt = `image-${id}`;

    card.appendChild(image);
    card.onclick = () => openPreview(id);
    container.appendChild(card);
  }
}

function renderPreviewControls() {
  const controls = document.getElementById('preview-controls');
  controls.innerHTML = '';

  suffixes.forEach(suffix => {
    const answerId = currentPreviewId + suffix;
    const questionId = questionIdFromAnswerId(answerId);

    const questionButton = document.createElement('button');
    questionButton.type = 'button';
    questionButton.textContent = `${suffix.toUpperCase()}：質問`;
    questionButton.onclick = () => playQuestion(questionId);

    const answerButton = document.createElement('button');
    answerButton.type = 'button';
    answerButton.textContent = `${suffix.toUpperCase()}：答え`;
    answerButton.onclick = () => playReviewAnswer(answerId);

    controls.appendChild(questionButton);
    controls.appendChild(answerButton);
  });
}

function openPreview(id) {
  currentPreviewId = id;

  const layer = document.getElementById('preview-layer');
  const image = document.getElementById('preview-img');

  image.src = `image/image-${id}.png`;
  image.alt = `image-${id}`;

  document.getElementById('preview-title').textContent = '';

  renderPreviewControls();
  layer.style.display = 'flex';
}

function closePreview() {
  document.getElementById('preview-layer').style.display = 'none';
  window.segmentAudio.stop();
}

function playQuestion(questionId) {
  void window.segmentAudio.play('main', questionId).catch(() => {
    showToast('質問音声を再生できません。');
  });
}

function playReviewAnswer(answerId) {
  void window.segmentAudio.play('review', answerId).catch(() => {
    showToast('答え音声を再生できません。');
  });
}

/* ===== 本番 ===== */
function renderImages() {
  const container = document.getElementById('question-images');
  container.innerHTML = '';
  container.className = isPlural ? 'plural' : 'single';

  const count = isPlural ? 2 : 1;

  for (let i = 0; i < count; i++) {
    const image = document.createElement('img');
    image.src = `image/image-${displayedImageId}.png`;
    image.alt = `image-${displayedImageId}`;
    container.appendChild(image);
  }
}

function resetControls() {
  selectedYesNo = '';
  timerStarted = false;

  const yes = document.getElementById('yes-btn');
  const no = document.getElementById('no-btn');
  const input = document.getElementById('text-input');
  const ok = document.getElementById('ok-btn');
  const next = document.getElementById('next-btn');

  yes.disabled = false;
  no.disabled = false;
  yes.classList.remove('selected');
  no.classList.remove('selected');

  input.value = '';
  input.disabled = true;
  ok.disabled = true;

  const guide = document.getElementById('input-guide');
  if (guide) guide.textContent = 'Oui / Nonを選びましょう';

  next.style.display = 'none';
  next.textContent = '次へ';
}

function selectYesNo(value) {
  if (phase !== 'answering') return;

  selectedYesNo = value;

  document.getElementById('yes-btn')
    .classList.toggle('selected', value === 'oui');

  document.getElementById('no-btn')
    .classList.toggle('selected', value === 'non');

  const input = document.getElementById('text-input');
  const ok = document.getElementById('ok-btn');

  input.disabled = false;
  ok.disabled = false;

  const guide = document.getElementById('input-guide');
  if (guide) guide.textContent = 'キーボードのマイクで答えてください';

  // 最初に Oui / Non を選んだときだけカウントダウン開始。
  // 途中で Oui ⇄ Non を押し直しても残り時間はリセットしない。
  if (!timerStarted) {
    timerStarted = true;
    startTimer();
  }

  input.focus();
}

function startTimer() {
  clearInterval(countdown);

  const counter = document.getElementById('counter');
  const bar = document.getElementById('timer-bar');

  answerDeadline = Date.now() + config.answerSeconds * 1000;

  const update = () => {
    const remaining = Math.max(0, answerDeadline - Date.now());
    const ratio = remaining / (config.answerSeconds * 1000);

    counter.textContent = String(Math.ceil(remaining / 1000));
    bar.style.transform = `scaleX(${ratio})`;

    if (remaining <= 0) {
      clearInterval(countdown);
      finalizeAnswer(true, false);
    }
  };

  update();
  countdown = setInterval(update, 100);
}

function nextTurn() {
  clearInterval(countdown);
  window.segmentAudio.stop();

  turn++;
  phase = 'answering';
  resetControls();

  baseId = randomBaseId();

  const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
  currentAnswerId = baseId + suffix;
  currentQuestionId = questionIdFromAnswerId(currentAnswerId);

  isPlural = suffix === 'c' || suffix === 'd';

  const yesCase = suffix === 'a' || suffix === 'c';
  correctYesNo = yesCase ? 'oui' : 'non';

  displayedImageId = yesCase
    ? baseId
    : randomIdExcept(baseId);

  correctAnswer = acceptedAnswersFor(currentAnswerId)[0];

  document.getElementById('turn-info').textContent =
    `${turn} / ${config.rounds}`;

  document.getElementById('score-info').textContent =
    `スコア：${score}`;

  renderImages();

  playQuestion(currentQuestionId);
}


function replayCurrentQuestion() {
  if (phase !== 'answering') return;
  playQuestion(currentQuestionId);
}

function submitAnswer() {
  if (phase !== 'answering') return;

  // ENTER / OK は明示的なユーザー操作なので、
  // 回答確定後そのまま次問へ進み、次の質問音声再生のトリガーに使います。
  finalizeAnswer(false, true);
}

function finalizeAnswer(timedOut, autoAdvance = false) {
  if (phase !== 'answering') return;

  phase = 'locked';
  clearInterval(countdown);
  window.segmentAudio.stop();

  const userAnswer = normalizeAnswer(
    document.getElementById('text-input').value || ''
  );

  const choiceCorrect = selectedYesNo === correctYesNo;
  const acceptedAnswers = acceptedAnswersFor(currentAnswerId);
  const speechCorrect = acceptedAnswers.includes(userAnswer);
  const isCorrect = choiceCorrect && speechCorrect;

  if (isCorrect) score++;

  history.push({
    turn,
    baseId,
    answerId: currentAnswerId,
    questionId: currentQuestionId,
    displayedImageId,
    plural: isPlural,
    selectedYesNo,
    correctYesNo,
    user: userAnswer,
    correct: correctAnswer,
    timedOut,
    isCorrect
  });

  document.getElementById('score-info').textContent =
    `スコア：${score}`;

  document.getElementById('yes-btn').disabled = true;
  document.getElementById('no-btn').disabled = true;
  document.getElementById('text-input').disabled = true;
  document.getElementById('ok-btn').disabled = true;

  document.getElementById('counter').textContent = '';
  document.getElementById('timer-bar').style.transform = 'scaleX(0)';

  const next = document.getElementById('next-btn');

  if (autoAdvance) {
    // ENTER / OK で送信できた場合は「次へ」を挟まない。
    // 送信操作そのものを次問の質問音声再生トリガーにします。
    next.style.display = 'none';

    if (history.length >= config.rounds) {
      endGame();
    } else {
      nextTurn();
    }
    return;
  }

  // タイムアウト時だけ、次問の音声再生にユーザー操作が必要なので
  // 「次へ / 結果を見る」を表示します。
  next.style.display = 'inline-block';
  next.textContent =
    history.length >= config.rounds ? '結果を見る' : '次へ';
}

function goNext() {
  if (phase !== 'locked') return;

  if (history.length >= config.rounds) {
    endGame();
  } else {
    nextTurn();
  }
}

function reviewImagesHTML(item) {
  const count = item.plural ? 2 : 1;
  let html = '<div class="review-images">';

  for (let i = 0; i < count; i++) {
    html += `
      <img
        src="image/image-${item.displayedImageId}.png"
        alt="image-${item.displayedImageId}"
      >
    `;
  }

  html += '</div>';
  return html;
}

function endGame() {
  phase = 'finished';
  clearInterval(countdown);
  window.segmentAudio.stop();

  document.getElementById('game-area').style.display = 'none';

  let finalPassword = '';

  try {
    finalPassword = window.computePassword(studentId, score);
  } catch (error) {
    console.error(error);
  }

  const result = document.getElementById('result');
  result.style.display = 'block';

  result.innerHTML = `
    <p>スコア：${score}/${config.rounds}</p>
    <p>
      パスワード：
      <span id="final-password">
        ${escapeHTML(finalPassword || '(生成エラー)')}
      </span>
    </p>
    <button
      onclick="copyPassword()"
      ${finalPassword ? '' : 'disabled'}
    >
      コピー
    </button>
    <p>パスワードをコピーして、元のFormsで提出してください</p>
    <button onclick="returnToForms()">Formsへ戻る</button>
  `;

  let table = `
    <div class="history-scroll">
      <table>
        <tr>
          <th>問題</th>
          <th>表示</th>
          <th>Oui / Non</th>
          <th>あなたの答え</th>
          <th>正解</th>
          <th>質問音声</th>
          <th>答え音声</th>
          <th>正誤</th>
        </tr>
  `;

  history.forEach(item => {
    table += `
      <tr>
        <td>${item.turn}</td>
        <td>${reviewImagesHTML(item)}</td>
        <td>
          ${escapeHTML(item.selectedYesNo || '未選択')}
          / 正解 ${escapeHTML(item.correctYesNo)}
        </td>
        <td>${escapeHTML(item.user || '未入力')}</td>
        <td>${escapeHTML(item.correct)}</td>
        <td>
          <button type="button" onclick="playQuestion('${item.questionId}')">
            ▶
          </button>
        </td>
        <td>
          <button type="button" onclick="playReviewAnswer('${item.answerId}')">
            ▶
          </button>
        </td>
        <td>${item.isCorrect ? '✅' : '❌'}</td>
      </tr>
    `;
  });

  table += '</table></div>';
  result.insertAdjacentHTML('beforeend', table);

  if (finalPassword) {
    try {
      navigator.clipboard.writeText(finalPassword)
        .then(() => {
          showToast('パスワードを自動コピーしました。');
        })
        .catch(() => {});
    } catch (_) {}
  }
}

async function copyPassword() {
  const password =
    document.getElementById('final-password').textContent;

  try {
    await navigator.clipboard.writeText(password);
    showToast('パスワードをコピーしました。');
  } catch (_) {
    window.prompt(
      'コピーできませんでした。以下を選択してコピーしてください。',
      password
    );
  }
}

function returnToForms() {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    alert(
      '元のFormsのタブに戻って、パスワードを貼り付けてください。'
    );
  }
}

function startGame() {
  if (phase !== 'idle') return;

  studentId =
    document.getElementById('student-id').value.trim();

  if (!/^\d{4}$/.test(studentId)) {
    alert('学籍番号の下4桁を半角数字で入力してください。');
    return;
  }

  try {
    validateSetup();
  } catch (error) {
    alert(error.message);
    return;
  }

  turn = 0;
  score = 0;
  history = [];

  closePreview();

  document.getElementById('start-section').style.display = 'none';
  document.getElementById('intro-image').style.display = 'none';
  document.getElementById('today-section').style.display = 'none';
  document.getElementById('game-area').style.display = 'block';

  nextTurn();
}

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('audio-player').src = config.mainAudio;

  // 本番用の「聞き直す」ボタンを追加。
  // 再生してもカウントダウンは停止・リセットしません。
  if (!document.getElementById('replay-question-btn')) {
    const replayButton = document.createElement('button');
    replayButton.id = 'replay-question-btn';
    replayButton.type = 'button';
    replayButton.textContent = '🔊 聞き直す';
    replayButton.addEventListener('click', replayCurrentQuestion);

    const yesNoRow = document.getElementById('yes-no-row');
    if (yesNoRow && yesNoRow.parentNode) {
      yesNoRow.parentNode.insertBefore(replayButton, yesNoRow);
    }
  }
  document.getElementById('audio-re-player').src = config.reviewAudio;

  try {
    validateSetup();
    renderTodayItems();
  } catch (error) {
    document.getElementById('start-btn').disabled = true;
    document.getElementById('today-title').textContent = error.message;
    return;
  }

  window.segmentAudio.preload();

  document.getElementById('text-input')
    .addEventListener('beforeinput', event => {
      if (
        phase !== 'answering' ||
        Date.now() >= answerDeadline
      ) {
        event.preventDefault();
      }
    });
});
