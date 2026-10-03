'use strict';

const config = window.gameConfig;
const responseSource = window.responses ?? window.reponses ?? {};
const maxCards = config.maxCards ?? (typeof maxVerbe !== 'undefined' ? maxVerbe : NaN);

const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
})[char]);

// image-1 から image-10 まで、小さい額面順。
const MONEY = Object.freeze({
  1:  { value: 1,    label: '1c',  type: 'coin' },
  2:  { value: 2,    label: '2c',  type: 'coin' },
  3:  { value: 5,    label: '5c',  type: 'coin' },
  4:  { value: 10,   label: '10c', type: 'coin' },
  5:  { value: 20,   label: '20c', type: 'coin' },
  6:  { value: 50,   label: '50c', type: 'coin' },
  7:  { value: 100,  label: '1€',  type: 'coin' },
  8:  { value: 200,  label: '2€',  type: 'coin' },
  9:  { value: 500,  label: '5€',  type: 'bill' },
  10: { value: 1000, label: '10€', type: 'bill' }
});

let phase = 'idle';
let turn = 0;
let score = 0;
let studentId = '';
let currentAudioId = '';
let currentCorrectCents = 0;
let paymentCents = 0;
let history = [];
let questionDeck = [];
let inGame = false;
let placementSerial = 0;

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.style.display = 'block';
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => { toast.style.display = 'none'; }, 1300);
}

function normalizeId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 50 ? String(n).padStart(2, '0') : '';
}

// reponses.js の形式にある程度幅を持たせます。
// 推奨：responses["01"] = ["50", "20"]  -> 50€20
// また、[["1","50","20"], ...] や ["1","50","20","2",...] も読み取れます。
function getRawResponse(id) {
  const shortId = String(Number(id));
  const source = responseSource;

  if (Array.isArray(source)) {
    if (source.length && Array.isArray(source[0])) {
      const row = source.find(item => Array.isArray(item) && String(Number(item[0])) === shortId);
      return row ? row.slice(1, 3) : undefined;
    }
    for (let i = 0; i + 2 < source.length; i += 3) {
      if (String(Number(source[i])) === shortId) return [source[i + 1], source[i + 2]];
    }
    return undefined;
  }

  if (source && typeof source === 'object') {
    return source[id] ?? source[shortId];
  }

  return undefined;
}

function responseToCents(raw) {
  if (Array.isArray(raw)) {
    if (raw.length < 2) return NaN;
    const euros = Number(String(raw[0]).replace(',', '.'));
    const cents = Number(String(raw[1]).replace(/\D/g, ''));
    if (!Number.isInteger(euros) || euros < 0 || !Number.isInteger(cents) || cents < 0 || cents > 99) return NaN;
    return euros * 100 + cents;
  }

  if (raw && typeof raw === 'object') {
    const eurosRaw = raw.euros ?? raw.euro ?? raw.e ?? raw[0];
    const centsRaw = raw.centimes ?? raw.cents ?? raw.cent ?? raw.c ?? raw[1] ?? 0;
    const euros = Number(eurosRaw);
    const cents = Number(centsRaw);
    if (!Number.isInteger(euros) || euros < 0 || !Number.isInteger(cents) || cents < 0 || cents > 99) return NaN;
    return euros * 100 + cents;
  }

  if (typeof raw === 'number') {
    return Number.isInteger(raw) && raw >= 0 ? raw : NaN;
  }

  if (typeof raw !== 'string') return NaN;
  const text = raw.trim().toLowerCase();
  if (!text) return NaN;

  // 50€20 / 50e20 / 50 € 20 c
  let match = text.match(/^(\d+)\s*(?:€|e|euros?)\s*(\d{1,2})?\s*(?:c|ct|centimes?)?$/i);
  if (match) return Number(match[1]) * 100 + Number(match[2] || 0);

  // 50,20 / 50.20
  match = text.match(/^(\d+)[,.](\d{1,2})$/);
  if (match) return Number(match[1]) * 100 + Number(match[2].padEnd(2, '0'));

  // "50 20" / "50|20" / "50;20"
  match = text.match(/^(\d+)\s*[|;:\s]\s*(\d{1,2})$/);
  if (match) return Number(match[1]) * 100 + Number(match[2]);

  // 単独整数の文字列はユーロとして扱う（例："12" = 12€00）。
  if (/^\d+$/.test(text)) return Number(text) * 100;

  return NaN;
}

function formatCents(cents) {
  const safe = Math.max(0, Math.trunc(Number(cents) || 0));
  const euros = Math.floor(safe / 100);
  const centimes = safe % 100;
  return `${euros},${String(centimes).padStart(2, '0')} €`;
}

function updatePaymentTotal() {
  const total = document.getElementById('payment-total');
  if (total) total.textContent = `現在：${formatCents(paymentCents)}`;
}

function validateSetup() {
  if (!Number.isInteger(maxCards) || maxCards < 1 || maxCards > 50)
    throw new Error('maxVerbe は1〜50の整数で指定してください。');
  if (!Number.isInteger(config.rounds) || config.rounds < 1 || config.rounds > maxCards)
    throw new Error('問題数 rounds は1以上、maxVerbe以下にしてください。');
  if (![config.segmentSpacing, config.segmentOffset, config.segmentSeconds].every(Number.isFinite) ||
      config.segmentSpacing <= 0 || config.segmentOffset < 0 || config.segmentSeconds <= 0 ||
      config.segmentOffset + config.segmentSeconds > config.segmentSpacing)
    throw new Error('音声区間の設定を確認してください。');

  for (let n = 1; n <= maxCards; n++) {
    const id = String(n).padStart(2, '0');
    const amount = responseToCents(getRawResponse(id));
    if (!Number.isInteger(amount) || amount < 0)
      throw new Error(`回答データ ${n} の金額を読み取れません。reponses.jsを確認してください。`);
  }

  if (typeof window.computePassword !== 'function')
    throw new Error('パスワード計算ファイルを読み込めません。');
  window.computePassword('0000', 0);
}

function makeQuestionDeck() {
  const deck = Array.from({ length: maxCards }, (_, i) => String(i + 1).padStart(2, '0'));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck.slice(0, config.rounds);
}

function clearPaymentArea() {
  paymentCents = 0;
  placementSerial = 0;
  const area = document.getElementById('payment-area');
  area.querySelectorAll('.placed-money').forEach(node => node.remove());
  area.classList.remove('has-money');
  updatePaymentTotal();
}

function choosePlacement(area, itemWidth, itemHeight) {
  // PNGを端で切らず、そもそもカウンター中央寄りの座標だけを選ぶ。
  const sideMargin = Math.max(18, area.clientWidth * 0.10);
  const topMargin = Math.max(12, area.clientHeight * 0.08);
  const bottomMargin = Math.max(22, area.clientHeight * 0.18);

  const minX = sideMargin;
  const maxX = Math.max(minX, area.clientWidth - itemWidth - sideMargin);
  const minY = topMargin;
  const maxY = Math.max(minY, area.clientHeight - itemHeight - bottomMargin);

  const existing = Array.from(area.querySelectorAll('.placed-money')).map(node => ({
    x: node.offsetLeft,
    y: node.offsetTop,
    width: node.offsetWidth,
    height: node.offsetHeight
  }));

  let fallback = { x: minX, y: minY };
  for (let attempt = 0; attempt < 40; attempt++) {
    const x = minX + Math.random() * Math.max(0, maxX - minX);
    const y = minY + Math.random() * Math.max(0, maxY - minY);
    fallback = { x, y };

    // 少し重なるのは許すが、ほぼ同じ位置に積み重ならないようにする。
    const tooClose = existing.some(p => {
      const margin = 10;
      return !(
        x + itemWidth - margin < p.x ||
        x + margin > p.x + p.width ||
        y + itemHeight - margin < p.y ||
        y + margin > p.y + p.height
      );
    });

    if (!tooClose) return { x, y };
  }
  return fallback;
}

function addMoney(imageIndex, value, label, type) {
  if (phase !== 'choosing') return;

  const area = document.getElementById('payment-area');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `placed-money ${type}`;
  button.dataset.value = String(value);
  button.dataset.type = type;
  button.dataset.serial = String(++placementSerial);
  button.style.visibility = 'hidden';
  button.style.transform = `rotate(${(Math.random() * 16 - 8).toFixed(1)}deg)`;
  button.style.zIndex = String(10 + placementSerial);
  button.setAttribute('aria-label', `${label}を戻す`);

  const img = document.createElement('img');
  img.src = `image/image-${imageIndex}.png`;
  img.alt = label;
  button.appendChild(img);

  button.addEventListener('click', () => {
    if (phase !== 'choosing') return;
    paymentCents = Math.max(0, paymentCents - value);
    button.remove();
    updatePaymentTotal();
    if (!area.querySelector('.placed-money')) area.classList.remove('has-money');
  });

  paymentCents += value;
  updatePaymentTotal();
  area.appendChild(button);

  // 実際のPNG表示サイズを測ってから、中央寄りに制限した範囲へ配置します。
  const position = choosePlacement(area, button.offsetWidth, button.offsetHeight);
  button.style.left = `${position.x}px`;
  button.style.top = `${position.y}px`;
  button.style.visibility = 'visible';
  area.classList.add('has-money');
}

function bindMoneyButtons() {
  document.querySelectorAll('.money-source').forEach(button => {
    button.addEventListener('click', () => {
      const imageIndex = Number(button.dataset.image);
      const value = Number(button.dataset.value);
      const label = button.dataset.label || '';
      const money = MONEY[imageIndex];
      if (!money || money.value !== value) return;
      addMoney(imageIndex, value, label, money.type);
    });
  });
}

window.addEventListener('DOMContentLoaded', () => {
  const audio = document.getElementById('audio-player');
  if (audio) audio.src = config.mainAudio;
  bindMoneyButtons();

  try {
    validateSetup();
  } catch (error) {
    const startButton = document.getElementById('start-btn');
    const setupError = document.getElementById('setup-error');
    if (startButton) startButton.disabled = true;
    if (setupError) setupError.textContent = error.message;
    return;
  }

  window.segmentAudio.preload();
});

function startGame() {
  if (phase !== 'idle') return;

  studentId = document.getElementById('student-id').value.trim();
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
  questionDeck = makeQuestionDeck();
  inGame = true;
  phase = 'choosing';

  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('result').style.display = 'none';
  document.getElementById('game-screen').style.display = 'block';
  nextTurn();
}

function nextTurn() {
  window.segmentAudio.stop();
  clearPaymentArea();

  if (turn >= config.rounds) {
    endGame();
    return;
  }

  phase = 'choosing';
  currentAudioId = questionDeck[turn];
  currentCorrectCents = responseToCents(getRawResponse(currentAudioId));
  turn++;

  document.getElementById('turn-info').textContent = `${turn}/${config.rounds}問目`;
  document.getElementById('score-info').textContent = `スコア：${score}/${config.rounds}`;
  document.getElementById('pay-button').disabled = false;
  document.getElementById('listen-button').disabled = false;

  playAudioSegment(currentAudioId);
}

function submitPayment() {
  if (phase !== 'choosing') return;
  phase = 'submitting';
  window.segmentAudio.stop();

  document.getElementById('pay-button').disabled = true;
  document.getElementById('listen-button').disabled = true;

  const isCorrect = paymentCents === currentCorrectCents;
  if (isCorrect) score++;

  history.push({
    turn,
    audioId: currentAudioId,
    userCents: paymentCents,
    correctCents: currentCorrectCents,
    isCorrect
  });

  document.getElementById('score-info').textContent = `スコア：${score}/${config.rounds}`;

  if (history.length < config.rounds) {
    nextTurn();
  } else {
    endGame();
  }
}

function recomputeScoreFromHistory() {
  score = history.filter(item => item.isCorrect).length;
}

function endGame() {
  phase = 'finished';
  window.segmentAudio.stop();
  inGame = false;
  recomputeScoreFromHistory();
  clearPaymentArea();

  document.getElementById('game-screen').style.display = 'none';

  let finalPassword = '';
  try {
    finalPassword = window.computePassword(studentId, score);
  } catch (error) {
    console.error(error);
  }

  const result = document.getElementById('result');
  result.style.display = 'block';
  result.innerHTML = `
    <h2>結果</h2>
    <p>スコア：${score}/${config.rounds}</p>
    <p>パスワード：<span id="final-password">${escapeHTML(finalPassword || '(生成エラー)')}</span></p>
    <button type="button" onclick="copyPassword()" ${finalPassword ? '' : 'disabled'}>コピー</button>
    <p>パスワードをコピーして、元のFormsで提出してください</p>
    <button type="button" onclick="returnToForms()">Formsへ戻る</button>
  `;

  let historyHtml = '<table><tr><th>問題</th><th>音声</th><th>あなたの支払い</th><th>正解</th><th>正誤</th></tr>';
  history.forEach(item => {
    historyHtml += `<tr>
      <td>${item.turn}</td>
      <td><button type="button" onclick="playAudioSegment('${escapeHTML(item.audioId)}')">▶</button></td>
      <td>${escapeHTML(formatCents(item.userCents))}</td>
      <td>${escapeHTML(formatCents(item.correctCents))}</td>
      <td>${item.isCorrect ? '✅' : '❌'}</td>
    </tr>`;
  });
  historyHtml += '</table>';
  result.insertAdjacentHTML('beforeend', `<div class="history-scroll">${historyHtml}</div>`);

  if (finalPassword) {
    try {
      navigator.clipboard.writeText(finalPassword)
        .then(() => showToast('パスワードを自動コピーしました。'))
        .catch(() => {});
    } catch (_) {}
  }
}

async function copyPassword() {
  const element = document.getElementById('final-password');
  if (!element) return;
  const password = element.textContent;
  try {
    await navigator.clipboard.writeText(password);
    showToast('パスワードをコピーしました。');
  } catch (_) {
    window.prompt('コピーできませんでした。以下を選択してコピーしてください。', password);
  }
}

function returnToForms() {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    alert('元のFormsのタブに戻って、パスワードを貼り付けてください。');
  }
}

function playAudioSegment(segmentId) {
  if (inGame && phase !== 'choosing') return;
  void window.segmentAudio.play(segmentId).catch(() => {
    showToast('音声を再生できません。「もう一度聞く」を押してください。');
  });
}

function __replayCurrent() {
  if (phase === 'choosing' && currentAudioId) playAudioSegment(currentAudioId);
}
