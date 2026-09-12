'use strict';

let turn = 0, score = 0;
let selectedImages = [], correctImages = [];
let studentId = '', currentAudioId = '';
let history = [];
let turnLocked = false;

const config = window.gameConfig;
const maxImage = config.maxCards ?? (typeof maxVerbe !== 'undefined' ? maxVerbe : NaN);
let phase = 'idle';
let questionIds = [];

function showToast(message) {
  const node = document.getElementById('toast');
  node.textContent = message;
  node.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => node.hidden = true, 4000);
}

function playAudioSegment(id) {
  return window.segmentAudio.play('main', id).catch(() => {
    showToast('音声を再生できません。再生ボタンを押して再試行してください。');
    return false;
  });
}

function toImageId(value) {
  const s = String(value).trim();
  if (!/^\d{1,3}$/.test(s)) return null;
  return String(+s).padStart(2, '0');
}

// 1枚問題は "03" でも ["03"] でも可。
// 2枚問題は ["03", "12"] のように指定します。
function normalizeAnswerSet(raw) {
  const values = Array.isArray(raw) ? raw : [raw];
  return values.map(toImageId).filter(Boolean);
}

function sameSet(a, b) {
  if (a.length !== b.length) return false;
  const aa = [...new Set(a)].sort();
  const bb = [...new Set(b)].sort();
  return aa.length === bb.length && aa.every((v, i) => v === bb[i]);
}

function validateSetup() {
  if (!Number.isInteger(maxImage) || maxImage < 1 || maxImage > 100) {
    throw Error('maxCards（またはmaxVerbe）は1〜100の整数にしてください。');
  }
  if (!Number.isInteger(config.choices) || config.choices < 2 || !Number.isInteger(config.rounds) || config.rounds < 1) {
    throw Error('選択肢数・問題数を確認してください。');
  }
  if (![config.segmentSpacing, config.segmentOffset, config.segmentSeconds].every(Number.isFinite)
      || config.segmentSpacing <= 0 || config.segmentOffset < 0 || config.segmentSeconds <= 0
      || config.segmentOffset + config.segmentSeconds > config.segmentSpacing) {
    throw Error('音声区間の設定を確認してください。');
  }
  if (!window.responses || typeof window.responses !== 'object') {
    throw Error('js/reponses.jsを読み込めません。');
  }

  questionIds = Object.keys(window.responses)
    .filter(id => /^\d{1,3}$/.test(id))
    .sort((a, b) => +a - +b);

  if (questionIds.length < 1) throw Error('reponses.jsに問題がありません。');

  for (const qid of questionIds) {
    const answers = normalizeAnswerSet(window.responses[qid]);
    if (answers.length < 1 || answers.length > 2) {
      throw Error(`${qid}の正解は1枚または2枚にしてください。`);
    }
    if (new Set(answers).size !== answers.length) {
      throw Error(`${qid}の正解画像が重複しています。`);
    }
    for (const id of answers) {
      const n = +id;
      if (n < 1 || n > maxImage) {
        throw Error(`${qid}の正解画像 ${id} は1〜${maxImage}の範囲にしてください。`);
      }
    }
    if (config.choices < answers.length) {
      throw Error('選択肢数が正解画像数より少なくなっています。');
    }
  }

  // 任意：window.dummies = { "01":["05"], ... } を指定すると、
  // その問題で必ず出したい紛らわしい画像を追加できます。
  if (window.dummies != null) {
    if (typeof window.dummies !== 'object') throw Error('dummiesの設定を確認してください。');
    for (const qid of questionIds) {
      if (window.dummies[qid] == null) continue;
      const raw = Array.isArray(window.dummies[qid]) ? window.dummies[qid] : [window.dummies[qid]];
      for (const value of raw) {
        const id = toImageId(value);
        if (!id || +id < 1 || +id > maxImage) {
          throw Error(`${qid}のダミー画像を1〜${maxImage}の番号にしてください。`);
        }
      }
    }
  }

  if (typeof window.computePassword !== 'function') {
    throw Error('提出コードの計算ファイルを読み込めません。');
  }
  window.computePassword('0000', 0);
}

function renderTodayVerbs() {
  const c = document.getElementById('today-list');
  c.innerHTML = '';

  questionIds.forEach(qid => {
    const answers = normalizeAnswerSet(window.responses[qid]);
    const row = document.createElement('div');
    row.className = 'today-row';

    const left = document.createElement('div');
    left.className = 'today-left';
    left.style.gap = '4px';

    answers.forEach(idx => {
      const img = document.createElement('img');
      img.src = `image/image-${idx}.png`;
      img.alt = `image/image-${idx}`;
      img.style.width = answers.length === 2 ? '48%' : '100%';
      img.style.maxHeight = '80px';
      img.style.objectFit = 'contain';
      left.appendChild(img);
    });

    const right = document.createElement('div');
    const line = document.createElement('div');
    line.className = 'pair-line';
    const span = document.createElement('span');
    span.className = 'tag';
    span.textContent = `${qid}：音声`;
    const btn = document.createElement('button');
    btn.className = 'play';
    btn.textContent = '▶';
    btn.onclick = () => playAudioSegment(qid);
    line.appendChild(span);
    line.appendChild(btn);
    right.appendChild(line);

    row.appendChild(left);
    row.appendChild(right);
    c.appendChild(row);
  });
}

function ensureConfirmButton() {
  let btn = document.getElementById('confirm-button');
  if (btn) return btn;

  btn = document.createElement('button');
  btn.id = 'confirm-button';
  btn.textContent = '決定';
  btn.style.display = 'none';
  btn.style.margin = '0 auto 12px';
  btn.disabled = true;
  btn.onclick = () => confirmSelection(true);

  const grid = document.getElementById('image-grid');
  grid.insertAdjacentElement('afterend', btn);
  return btn;
}

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('audio-player').src = config.mainAudio;
  ensureConfirmButton();
  try {
    validateSetup();
    renderTodayVerbs();
  } catch (error) {
    document.getElementById('start-btn').disabled = true;
    document.getElementById('today-title').textContent = error.message;
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

  try { validateSetup(); }
  catch (error) { alert(error.message); return; }

  turn = 0;
  score = 0;
  history = [];

  for (const id of ['start-section', 'intro-image', 'today-section']) {
    document.getElementById(id).style.display = 'none';
  }
  document.getElementById('game-info').style.display = 'block';
  document.getElementById('image-grid').style.display = 'grid';

  nextTurn();
  playAudioSegment(currentAudioId);
}

// 問題（=音声区間）を均等ランダムで選びます。
function pickQuestionId() {
  return questionIds[Math.floor(Math.random() * questionIds.length)];
}

// 正解1〜2枚 + 任意のダミー + ランダム補充でconfig.choices枚にします。
function pickChoices(questionId, corrects) {
  const set = new Set(corrects);

  if (window.dummies && window.dummies[questionId] != null) {
    const ds = Array.isArray(window.dummies[questionId]) ? window.dummies[questionId] : [window.dummies[questionId]];
    ds.forEach(value => {
      const id = toImageId(value);
      if (id && +id >= 1 && +id <= maxImage) set.add(id);
    });
  }

  const pool = Array.from({ length: maxImage }, (_, i) => String(i + 1).padStart(2, '0'))
    .filter(id => !set.has(id));

  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const target = Math.min(config.choices, maxImage);
  return [...set, ...pool.slice(0, Math.max(0, target - set.size))].slice(0, target);
}

function nextTurn() {
  window.segmentAudio.stop();
  phase = 'choosing';
  turn++;
  turnLocked = false;
  selectedImages = [];

  document.getElementById('turn-info').innerText = `${turn}ターン目`;
  document.getElementById('score-info').innerText = `スコア：${score}/${config.rounds}`;

  const grid = document.getElementById('image-grid');
  grid.innerHTML = '';
  grid.style.display = 'grid';

  document.getElementById('listen-button').style.display = 'none';
  const confirm = ensureConfirmButton();
  confirm.style.display = 'inline-block';
  confirm.disabled = true;

  currentAudioId = pickQuestionId();
  correctImages = normalizeAnswerSet(window.responses[currentAudioId]);

  const indices = pickChoices(currentAudioId, correctImages);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  indices.forEach(idx => {
    const img = document.createElement('img');
    img.src = `image/image-${idx}.png`;
    // 選択肢画像は100×100pxの枠内に収め、縦横比を維持して中央配置。
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    img.style.objectPosition = 'center';

    const div = document.createElement('div');
    div.className = 'image-button';
    div.dataset.imageId = idx;
    // 枠そのものを100×100pxに固定。画像が縦長・横長でも余白側を中央寄せ。
    div.style.width = '100px';
    div.style.height = '100px';
    div.style.boxSizing = 'border-box';
    div.style.display = 'flex';
    div.style.alignItems = 'center';
    div.style.justifyContent = 'center';
    div.style.margin = '0 auto';

    const renderedTurn = turn;
    div.onclick = () => {
      if (phase !== 'choosing' || renderedTurn !== turn || turnLocked) return;
      toggleImage(idx);
    };

    const check = document.createElement('div');
    check.className = 'checkmark';
    check.innerText = '✓';

    div.appendChild(img);
    div.appendChild(check);
    grid.appendChild(div);
  });

  document.getElementById('listen-button').style.display = 'inline';
}

function toggleImage(idx) {
  if (phase !== 'choosing' || turnLocked) return;

  const pos = selectedImages.indexOf(idx);
  if (pos >= 0) {
    selectedImages.splice(pos, 1);
  } else {
    // 正解数は見せず、回答者は1枚でも2枚でも選んで「決定」できます。
    if (selectedImages.length >= 2) {
      showToast('選べる画像は2つまでです。');
      return;
    }
    selectedImages.push(idx);
  }

  document.querySelectorAll('.image-button').forEach(div => {
    div.classList.toggle('selected', selectedImages.includes(div.dataset.imageId));
  });

  const confirm = ensureConfirmButton();
  confirm.disabled = selectedImages.length < 1;
}

function confirmSelection(triggerNextByGesture = false) {
  if (phase !== 'choosing' || turnLocked || selectedImages.length < 1) return;

  turnLocked = true;
  phase = 'submitting';
  document.querySelectorAll('.image-button').forEach(div => div.onclick = null);
  ensureConfirmButton().disabled = true;

  const chosen = [...selectedImages];
  const correct = [...correctImages];
  const isCorrect = sameSet(chosen, correct);

  history.push({
    turn,
    audioId: currentAudioId,
    correctImages: correct,
    chosenImages: chosen,
    isCorrect
  });

  if (isCorrect) score++;
  document.getElementById('score-info').innerText = `スコア：${score}/${config.rounds}`;

  if (turn < config.rounds) {
    nextTurn();
    // 「決定」ボタンのクリックというユーザー操作の中で次問音声を再生し、
    // iOS等の自動再生制限に引っかかりにくくします。
    if (triggerNextByGesture) playAudioSegment(currentAudioId);
  } else {
    endGame();
  }
}

function renderImageList(ids, prefix) {
  return ids.map(id =>
    `<img src="image/image-${id}.png" alt="${prefix}-${id}" style="width:64px;height:auto;margin:2px;">`
  ).join('');
}

function endGame() {
  phase = 'finished';
  window.segmentAudio.stop();

  const gi = document.getElementById('game-info');
  if (gi) gi.style.display = 'none';

  const lb = document.getElementById('listen-button');
  if (lb) lb.style.display = 'none';

  const cb = document.getElementById('confirm-button');
  if (cb) cb.style.display = 'none';

  const grid = document.getElementById('image-grid');
  if (grid) {
    grid.innerHTML = '';
    grid.style.display = 'none';
  }

  score = history.filter(h => h.isCorrect).length;

  let finalPassword = '';
  try { finalPassword = window.computePassword(studentId, score); }
  catch (error) { showToast('提出コードの生成に失敗しました。設定を確認してください。'); }

  const resultDiv = document.getElementById('result');
  resultDiv.style.display = 'block';
  resultDiv.innerHTML = `<p>スコア：${score}/${config.rounds}</p>
    <p>パスワード：<span id="final-password"></span></p>
    <button id="copy-btn" onclick="copyPassword()">コピー</button>
    <p>パスワードをコピーして、元のFormsで提出してください</p>
    <button onclick="returnToForms()">Formsへ戻る</button>`;

  document.getElementById('final-password').textContent = finalPassword || '(生成エラー)';
  document.getElementById('copy-btn').disabled = !finalPassword;

  let historyHtml = `<table><tr><th>問題</th><th>音声</th><th>正解</th><th>あなたの答え</th><th>判定</th></tr>`;
  history.forEach(h => {
    historyHtml += `<tr>
      <td>${h.turn}</td>
      <td><button onclick="playAudioSegment('${h.audioId}')">▶</button></td>
      <td>${renderImageList(h.correctImages, 'correct')}</td>
      <td>${renderImageList(h.chosenImages, 'chosen')}</td>
      <td>${h.isCorrect ? '〇' : '×'}</td>
    </tr>`;
  });
  historyHtml += `</table>`;
  resultDiv.insertAdjacentHTML('beforeend', '<div class="history-scroll">' + historyHtml + '</div>');
  resultDiv.scrollIntoView({ behavior: 'smooth' });

  if (finalPassword) {
    try {
      navigator.clipboard.writeText(finalPassword)
        .then(() => showToast('パスワードを自動コピーしました。'))
        .catch(() => {});
    } catch (_) {}
  }
}

async function copyPassword() {
  const button = document.getElementById('copy-btn');
  if (!button || button.disabled) return;
  const pw = document.getElementById('final-password').textContent;
  try {
    await navigator.clipboard.writeText(pw);
    showToast('パスワードをコピーしました。');
  } catch (_) {
    window.prompt('以下を選択してコピーしてください。', pw);
  }
}

function returnToForms() {
  if (window.history.length > 1) window.history.back();
  else alert('元のFormsのタブに戻り、パスワードを貼り付けてください。');
}
