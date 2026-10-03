'use strict';
let turn=0, score=0;
let selectedImage="", correctImage="";
let studentId="", currentAudioId="";
let history=[]; let turnLocked=false;

const config = window.gameConfig;
const maxImage = config.maxCards ?? (typeof maxVerbe !== 'undefined' ? maxVerbe : NaN);
let phase = 'idle';
function showToast(message) {
  const node=document.getElementById('toast'); node.textContent=message; node.hidden=false;
  clearTimeout(showToast.timer); showToast.timer=setTimeout(()=>node.hidden=true, 4000);
}
function playAudioSegment(id) {
  return window.segmentAudio.play('main', id).catch(()=>{
    showToast('音声を再生できません。再生ボタンを押して再試行してください。');
    return false;
  });
}
function validateSetup() {
  if (!Number.isInteger(maxImage) || maxImage<1 || maxImage>50) throw Error('maxCardsは1〜50の整数にしてください。');
  if (!Number.isInteger(config.choices) || config.choices<1 || !Number.isInteger(config.rounds) || config.rounds<1) throw Error('選択肢数・問題数を確認してください。');
  if (![config.segmentSpacing,config.segmentOffset,config.segmentSeconds].every(Number.isFinite) || config.segmentSpacing<=0 || config.segmentOffset<0 || config.segmentSeconds<=0 || config.segmentOffset+config.segmentSeconds>config.segmentSpacing) throw Error('音声区間の設定を確認してください。');
  if (!window.responses || typeof window.responses!=='object') throw Error('js/reponses.jsを読み込めません。');
  for(let n=1;n<=maxImage;n++) {
    const id=String(n).padStart(2,'0'); const dummy=window.responses[id];
    if (dummy == null || dummy === '') continue;
    if (!/^\d{1,2}$/.test(String(dummy)) || +dummy<1 || +dummy>maxImage) throw Error(`${id}のダミー解答がカード範囲外です。reponses.jsを確認してください。`);
    if (+dummy!==n && config.choices<2) throw Error('ダミー解答を表示するため選択肢数を2以上にしてください。');
  }
  if (typeof window.computePassword!=='function') throw Error('提出コードの計算ファイルを読み込めません。');
  window.computePassword('0000',0);
}

function renderTodayVerbs(){
  const c = document.getElementById('today-list'); c.innerHTML='';
  for (let n=1;n<=maxImage;n++){
    const idx = String(n).padStart(2,'0');
    const row = document.createElement('div'); row.className='today-row';
    const left = document.createElement('div'); left.className='today-left';
    const img = document.createElement('img'); img.src=`image/image-${idx}.png`; img.alt=`image/image-${idx}`; left.appendChild(img);
    const right = document.createElement('div');
    const line = document.createElement('div'); line.className='pair-line';
    const span = document.createElement('span'); span.className='tag'; span.textContent = `${idx}：音声`;
    const btn = document.createElement('button'); btn.className='play'; btn.textContent='▶'; btn.onclick=()=>playAudioSegment(idx);
    line.appendChild(span); line.appendChild(btn); right.appendChild(line);
    row.appendChild(left); row.appendChild(right); c.appendChild(row);
  }
}

window.addEventListener('DOMContentLoaded', ()=>{
  document.getElementById('audio-player').src=config.mainAudio;
  try { validateSetup(); renderTodayVerbs(); }
  catch(error) { document.getElementById('start-btn').disabled=true; document.getElementById('today-title').textContent=error.message; return; }
  window.segmentAudio.preload();
});
function startGame(){
  if(phase!=='idle') return;
  studentId=document.getElementById('student-id').value.trim();
  if(!/^\d{4}$/.test(studentId)){ alert('学籍番号の下4桁を半角数字で入力してください。'); return; }
  try { validateSetup(); } catch(error) { alert(error.message); return; }
  turn=0;score=0;history=[];
  for(const id of ['start-section','intro-image','today-section']) document.getElementById(id).style.display='none';
  document.getElementById('game-info').style.display='block';
  nextTurn();
  playAudioSegment(currentAudioId);
}

// 正解は設定された全種類から均等ランダム
function pickCorrectId(){
  return String(Math.floor(Math.random()*maxImage)+1).padStart(2,'0');
}

// 選択肢: 正解 + reponses.jsで指定されたペア + ランダムで設定枚数まで補充
function pickChoices(correct){
  const set=new Set([correct]);
  const dummy=window.responses[correct];
  if(dummy != null && dummy !== '') set.add(String(dummy).padStart(2,'0'));
  const pool=Array.from({length:maxImage},(_,i)=>String(i+1).padStart(2,'0')).filter(id=>!set.has(id));
  for(let i=pool.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [pool[i],pool[j]]=[pool[j],pool[i]]; }
  const target=Math.min(config.choices,maxImage);
  return [...set,...pool.slice(0,Math.max(0,target-set.size))];
}

function nextTurn(){
  window.segmentAudio.stop(); phase='choosing';
  turn++; turnLocked=false; selectedImage="";
  document.getElementById('turn-info').innerText = `${turn}ターン目`;
  document.getElementById('score-info').innerText = `スコア：${score}/${config.rounds}`;
  document.getElementById('image-grid').innerHTML='';
  document.getElementById('listen-button').style.display='none';
  correctImage = pickCorrectId();
  currentAudioId = correctImage;
  const indices = pickChoices(correctImage);
  for (let i=indices.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [indices[i],indices[j]]=[indices[j],indices[i]]; }
  indices.forEach(idx=>{
    const img = document.createElement('img'); img.src=`image/image-${idx}.png`; img.style.width='100%';
    const div = document.createElement('div'); div.className='image-button';
    // 1回目タップ：選択、2回目タップ：確定（次の問題の音声再生トリガー）
    const renderedTurn=turn;
    div.onclick=()=>{
      if (phase!=='choosing' || renderedTurn!==turn || turnLocked) return;
      if (selectedImage===idx){
        confirmSelection(/* userGesture */ true);
      } else {
        selectImage(idx);
      }
    };
    const check = document.createElement('div'); check.className='checkmark'; check.innerText='✓';
    div.appendChild(img); div.appendChild(check); document.getElementById('image-grid').appendChild(div);
  });
  document.getElementById('listen-button').style.display='inline';
}

function selectImage(idx){
  if(phase!=='choosing' || turnLocked) return;
  selectedImage = idx;
  document.querySelectorAll('.image-button').forEach(div=>div.classList.remove('selected'));
  const btns = document.querySelectorAll('.image-button');
  const imgs = document.querySelectorAll('.image-button img');
  const i = Array.from(imgs).findIndex(img=>img.src.includes(`image/image-${idx}.png`));
  if (i>=0) btns[i].classList.add('selected');
}
function confirmSelection(triggerNextByGesture=false){
  if (phase!=='choosing' || turnLocked || !selectedImage) return; turnLocked=true; phase='submitting';
  document.querySelectorAll('.image-button').forEach(div=>div.onclick=null);
  const isCorrect = (selectedImage === correctImage);
  history.push({
    turn,
    image: correctImage,
    chosenImage: selectedImage,
    audioId: correctImage,
    userAudioId: selectedImage,
    isCorrect
  });
  if (isCorrect) score++;
  document.getElementById('score-info').innerText = `スコア：${score}/${config.rounds}`;
  if (turn < config.rounds) {
    nextTurn();
    if (triggerNextByGesture) {
      playAudioSegment(currentAudioId);
    }
  } else {
    endGame();
  }
}

function endGame(){
  phase='finished'; window.segmentAudio.stop();
  const gi = document.getElementById('game-info'); if (gi) gi.style.display = 'none';
  const lb = document.getElementById('listen-button'); if (lb) lb.style.display = 'none';
  const grid = document.getElementById('image-grid'); if (grid) { grid.innerHTML=''; grid.style.display='none'; }
  score=history.filter(h=>h.isCorrect).length;
  let finalPassword='';
  try { finalPassword=window.computePassword(studentId,score); }
  catch(error) { showToast('提出コードの生成に失敗しました。設定を確認してください。'); }
  const resultDiv = document.getElementById('result');
  resultDiv.style.display='block';
  document.getElementById('image-grid').style.display='none';
  resultDiv.innerHTML = `<p>スコア：${score}/${config.rounds}</p>
    <p>パスワード：<span id="final-password"></span></p>
    <button id="copy-btn" onclick="copyPassword()">コピー</button>
    <p>パスワードをコピーして、元のFormsで提出してください</p>
    <button onclick="returnToForms()">Formsへ戻る</button>`;
  document.getElementById('final-password').textContent=finalPassword || '(生成エラー)';
  document.getElementById('copy-btn').disabled=!finalPassword;
  let historyHtml = `<table><tr><th>問題</th><th>正解</th><th>正解音声</th><th>あなたの答え</th><th>あなたの答えの音声</th><th>判定</th></tr>`;
  history.forEach(h=>{
    historyHtml += `<tr>
      <td>${h.turn}</td>
      <td><img src=\"image/image-${h.image}.png\" alt=\"correct-${h.image}\" style=\"width:72px;height:auto;\"></td>
      <td><button onclick=\"playAudioSegment('${h.audioId}')\">▶</button></td>
      <td><img src=\"image/image-${h.chosenImage}.png\" alt=\"chosen-${h.chosenImage}\" style=\"width:72px;height:auto;\"></td>
      <td><button onclick=\"playAudioSegment('${h.userAudioId}')\">▶</button></td>
      <td>${h.isCorrect ? '〇' : '×'}</td>
    </tr>`;
  });
  historyHtml += `</table>`; resultDiv.insertAdjacentHTML('beforeend','<div class="history-scroll">'+historyHtml+'</div>');
  resultDiv.scrollIntoView({behavior:'smooth'});
  
 if (finalPassword) {
     try {
      navigator.clipboard.writeText(finalPassword)
        .then(() => {
         showToast('パスワードを自動コピーしました。');
         })
         .catch(() => {
        // 自動コピーが拒否された場合は手動ボタンを使います。
         });
      } catch (_) {
    // Clipboard APIが使えない場合も結果表示を続けます。
      }
    }
}
async function copyPassword(){
  const button=document.getElementById('copy-btn'); if(!button || button.disabled) return;
  const pw=document.getElementById('final-password').textContent;
  try { await navigator.clipboard.writeText(pw); showToast('パスワードをコピーしました。'); }
  catch (_) { window.prompt('以下を選択してコピーしてください。',pw); }
}
function returnToForms(){
  if(window.history.length>1) window.history.back();
  else alert('元のFormsのタブに戻り、パスワードを貼り付けてください。');
}
