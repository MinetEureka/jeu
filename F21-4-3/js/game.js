    'use strict';
    const config = window.gameConfig;
    const responses = window.responses || {};
    const maxCards = config.maxCards ?? (typeof maxVerbe !== 'undefined' ? maxVerbe : NaN);
    const nbrVariants = config.nbrVerbe ?? (typeof nbrVerbe !== 'undefined' ? nbrVerbe : 2);
    const suffixes = ['a', 'b', 'c', 'd'].slice(0, nbrVariants);
    let phase = 'idle', answerDeadline = 0;
    const normalizeAnswer = value => String(value).normalize('NFC').trim().toLowerCase().replace(/’/g, "'");
    const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
    })[char]);

    function validateSetup() {
      if (!Number.isInteger(maxCards) || maxCards < 1 || maxCards > 50)
        throw new Error('カードの種類数は1〜50の整数で指定してください。');
      if (!Number.isInteger(nbrVariants) || nbrVariants < 2 || nbrVariants > 4)
        throw new Error('nbrVerbe は2〜4の整数で指定してください。');
      if (!Number.isInteger(config.choices) || config.choices < 1 ||
          !Number.isInteger(config.rounds) || config.rounds < 1)
        throw new Error('選択肢数・問題数は1以上の整数で指定してください。');
      if (![config.leadMs, config.answerSeconds, config.segmentSpacing, config.segmentOffset, config.segmentSeconds].every(Number.isFinite) ||
          config.leadMs < 0 || config.answerSeconds <= 0 || config.segmentSpacing <= 0 ||
          config.segmentOffset < 0 || config.segmentSeconds <= 0 ||
          config.segmentOffset + config.segmentSeconds > config.segmentSpacing)
        throw new Error('時間の設定を確認してください。');
      for (let n = 1; n <= maxCards; n++) {
        const id = String(n).padStart(2, '0');
        for (const key of [id, ...suffixes.map(suffix => id + suffix)]) {
          if (typeof responses[key] !== 'string' || !responses[key].trim())
            throw new Error(`回答データ ${key} がありません。reponses.jsを確認してください。`);
        }
      }
      if (typeof window.computePassword !== 'function')
        throw new Error('パスワード計算ファイルを読み込めません。');
      window.computePassword('0000', 0);
    }

    // ===== 状態 =====
    let turn = 0, score = 0;
    let selectedImage = "", correctAnswer = "", correctImage = "";
    let countdown = null, studentId = "", currentAudioId = "";
    let history = [];
    let inGame = false;

    function showToast(msg){
      const t=document.getElementById('toast'); if(!t) return;
      t.textContent=msg; t.style.display='block';
      clearTimeout(t._hideTimer);
      t._hideTimer=setTimeout(()=>{ t.style.display='none'; }, 1300);
    }

    function lockZoom(){
      const m=document.querySelector('meta[name="viewport"]'); if(!m) return;
      const c=m.getAttribute('content') || 'width=device-width, initial-scale=1.0';
      if(!/maximum-scale/.test(c)) m.setAttribute('content', c + ', maximum-scale=1, user-scalable=no');
    }
    function unlockZoom(){
      const m=document.querySelector('meta[name="viewport"]'); if(!m) return;
      m.setAttribute('content','width=device-width, initial-scale=1.0');
    }

    // ===== 予習パート：イラストのみ表示 → クリックでレイヤー =====
    let currentPreviewId = '';
    function renderTodayVerbs(){
      const container=document.getElementById('today-list'); if(!container) return;
      container.innerHTML='';
      for(let n=1;n<=maxCards;n++){
        const idx=String(n).padStart(2,'0');
        const card=document.createElement('div');
        card.className='preview-card';
        const img=document.createElement('img');
        img.src=`image/image-${idx}.png`;
        img.alt=`image/image-${idx}`;
        card.appendChild(img);
        card.onclick=()=>openPreview(idx);
        container.appendChild(card);
      }
    }
    function renderPreviewControls(){
      const controls = document.getElementById('preview-controls');
      if (!controls) return;
      controls.innerHTML = '';
      suffixes.forEach(suffix => {
        const q = document.createElement('button');
        q.textContent = `${suffix.toUpperCase()}：質問`;
        q.onclick = () => playAudioSegment(currentPreviewId + suffix);
        const a = document.createElement('button');
        a.textContent = `${suffix.toUpperCase()}：答え`;
        a.onclick = () => playReviewSegment(currentPreviewId + suffix);
        controls.appendChild(q);
        controls.appendChild(a);
      });
    }

    function openPreview(idx){
      currentPreviewId = idx;
      const layer = document.getElementById('preview-layer');
      const title = document.getElementById('preview-title');
      const img = document.getElementById('preview-img');
      img.src = `image/image-${idx}.png`;
      img.alt = `image-${idx}`;
      title.textContent = responses[idx] || '';
      layer.style.display='flex';
    }
    function closePreview(){
      const layer = document.getElementById('preview-layer');
      layer.style.display='none';
      window.segmentAudio.stop();
    }

    window.addEventListener('DOMContentLoaded', () => {
      document.getElementById('audio-player').src = config.mainAudio;
      document.getElementById('audio-re-player').src = config.reviewAudio;
      try { validateSetup(); renderTodayVerbs(); renderPreviewControls(); }
      catch (error) {
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
        alert('学籍番号の下4桁を半角数字で入力してください。'); return;
      }
      try { validateSetup(); } catch (error) { alert(error.message); return; }
      turn = 0; score = 0; history = []; inGame = true;
      closePreview();
      document.getElementById('start-section').style.display='none';
      document.getElementById('intro-image').style.display='none';
      document.getElementById('today-section').style.display='none';
      document.getElementById('game-info').style.display='block';
      nextTurn();
    }

    function nextTurn(){
      clearInterval(countdown);
      window.segmentAudio.stop();
      phase = 'choosing';
      selectedImage=''; correctAnswer=''; correctImage=''; currentAudioId='';
      turn++;
      document.getElementById('turn-info').innerText = `${turn}ターン目`;
      document.getElementById('score-info').innerText = `スコア：${score}/${config.rounds}`;
      document.getElementById('image-grid').innerHTML='';
      document.getElementById('listen-button').style.display='none';
      document.getElementById('confirm-button').style.display='none';

      const indices = Array.from({length: maxCards}, (_, i) => String(i + 1).padStart(2, '0'));
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      indices.length = Math.min(config.choices, maxCards);
      correctImage = indices[Math.floor(Math.random() * indices.length)];
      const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
      currentAudioId = `${correctImage}${suffix}`;
      correctAnswer = normalizeAnswer(responses[currentAudioId]);

      indices.forEach(idx=>{
        let img=document.createElement('img'); img.src=`image/image-${idx}.png`; img.style.width='100%'; img.alt=responses[idx];
        let div=document.createElement('div'); div.className='image-button';
        div.onclick=()=>{ if(selectedImage===idx){ confirmSelection(); } else { selectImage(idx); } };
        let check=document.createElement('div'); check.className='checkmark'; check.innerText='✓';
        div.appendChild(img); div.appendChild(check);
        document.getElementById('image-grid').appendChild(div);
      });
      document.getElementById('listen-button').style.display='inline';
      document.getElementById('image-grid').style.display='grid';
      playAudioSegment(currentAudioId);
    }
    function selectImage(idx){
      if (phase !== 'choosing') return;
      selectedImage = idx;
      document.querySelectorAll('.image-button').forEach(div=>div.classList.remove('selected'));
      const btns=document.querySelectorAll('.image-button');
      const imgs=document.querySelectorAll('.image-button img');
      const i=Array.from(imgs).findIndex(img=>img.src.includes(`image/image-${idx}.png`));
      if(i>=0) btns[i].classList.add('selected');
      document.getElementById('confirm-button').style.display='inline';
    }
    function confirmSelection() {
      if (phase !== 'choosing' || !selectedImage) return;
      phase = 'answering';
      window.segmentAudio.stop();
      clearInterval(countdown);
      document.querySelectorAll('.image-button').forEach(div => div.onclick = null);
      document.getElementById('confirm-button').style.display = 'none';
      document.getElementById('overlay').style.display = 'flex';
      lockZoom();
      const counterEl = document.getElementById('counter');
      const inputEl = document.getElementById('text-input');
      inputEl.value = '';
      inputEl.disabled = false;
      inputEl.style.display = '';
      inputEl.focus();
      const visibleFrom = Date.now() + config.leadMs;
      answerDeadline = visibleFrom + config.answerSeconds * 1000;
      const update = () => {
        const now = Date.now();
        counterEl.style.visibility = now < visibleFrom ? 'hidden' : 'visible';
        counterEl.textContent = Math.max(0, Math.ceil((answerDeadline - now) / 1000));
        if (now >= answerDeadline) {
          clearInterval(countdown);
          inputEl.disabled = true;
          inputEl.style.display = 'none';
        }
      };
      update();
      countdown = setInterval(update, 100);
    }
    function enforceDeadline(event) {
      if (phase !== 'answering' || Date.now() >= answerDeadline) event.preventDefault();
    }
    document.getElementById('text-input').addEventListener('beforeinput', enforceDeadline);

    function submitAnswer(){
      if (phase !== 'answering') return;
      phase = 'submitting';
      clearInterval(countdown);
      const overlay = document.getElementById('overlay');
      const inputEl = document.getElementById('text-input');
      let input = normalizeAnswer(inputEl.value || '');
      overlay.style.display='none';
      unlockZoom();
      history.push({ turn, image: correctImage, chosenImage: selectedImage, audioId: currentAudioId, correct: correctAnswer, user: input, isCorrect: (selectedImage===correctImage && input===correctAnswer) });
      if(selectedImage===correctImage && input===correctAnswer) score++;
      if(history.length < config.rounds){
        nextTurn();
      } else {
        endGame();
      }
    }
    function recomputeScoreFromHistory(){
      score = history.filter(h=>h.isCorrect).length;
      const scoreInfo = document.getElementById('score-info');
      if(scoreInfo) scoreInfo.innerText = `スコア：${score}/${config.rounds}`;
    }
    function endGame(){
      phase = 'finished';
      clearInterval(countdown);
      window.segmentAudio.stop();
      inGame=false; recomputeScoreFromHistory();
      document.getElementById('listen-button').style.display='none';
      document.getElementById('confirm-button').style.display='none';
      const grid=document.getElementById('image-grid'); if(grid){ grid.innerHTML=''; grid.style.display='none'; }
      const gi=document.getElementById('game-info'); if(gi){ gi.style.display='none'; }
      document.getElementById('overlay').style.display='none'; unlockZoom();
      let finalPassword = '';
      try { finalPassword = window.computePassword(studentId, score); }
      catch (error) { console.error(error); }
      const result=document.getElementById('result');
      result.style.display='block';
      result.innerHTML = `
        <p>スコア：${score}/${config.rounds}</p>
        <p>パスワード：<span id="final-password">${escapeHTML(finalPassword || '(生成エラー)')}</span></p>
        <button onclick="copyPassword()" ${finalPassword ? '' : 'disabled'}>コピー</button>
        <p>パスワードをコピーして、元のFormsで提出してください</p>
        <button onclick="returnToForms()">Formsへ戻る</button>
      `;
      let historyHtml = '<table><tr><th>問題</th><th>動詞</th><th>選んだ動詞</th><th>質問</th><th>選んだ動詞の音声</th><th>正解音声</th><th>あなたの答え</th><th>正解</th><th>正誤</th></tr>';
      history.forEach(h=>{
        const suffix = h.audioId.slice(-1);
        const chosenQ = `${h.chosenImage}${suffix}`;
        historyHtml += `<tr>
          <td>${h.turn}</td>
          <td><img src="image/image-${h.image}.png" alt="correct-${h.image}" style="width:72px;height:auto;"></td>
          <td><img src="image/image-${h.chosenImage}.png" alt="chosen-${h.chosenImage}" style="width:72px;height:auto;"></td>
          <td><button onclick="playAudioSegment('${h.audioId}');">▶</button></td>
          <td><button onclick="playAudioSegment('${chosenQ}');">▶</button></td>
          <td><button onclick="playReviewSegment('${h.audioId}');">▶</button></td>
          <td>${escapeHTML(h.user)}</td>
          <td>${escapeHTML(h.correct)}</td>
          <td>${h.isCorrect ? '✅' : '❌'}</td>
        </tr>`;
      });
      historyHtml += '</table>';
      result.insertAdjacentHTML('beforeend', '<div class="history-scroll">' + historyHtml + '</div>');
      
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
    async function copyPassword() {
      const pw = document.getElementById('final-password').textContent;
      try { await navigator.clipboard.writeText(pw); showToast('パスワードをコピーしました。'); }
      catch (_) { window.prompt('コピーできませんでした。以下を選択してコピーしてください。', pw); }
    }
    function returnToForms() {
      // Formsから同じタブで移動した場合は、直前の画面に戻ります。
      // 新しいタブで開いた場合は、元のFormsタブへ手動で戻ります。
      if (window.history.length > 1) {
        window.history.back();
      } else {
        alert('元のFormsのタブに戻って、パスワードを貼り付けてください。');
      }
    }
    function playAudioSegment(segmentId) {
      if (inGame && phase !== 'choosing') return;
      void window.segmentAudio.play('main', segmentId).catch(() => {
        showToast('音声を再生できません。「もう一度聞く」または再生ボタンを押してください。');
      });
    }
    function __replayCurrent() {
      if (phase === 'choosing' && currentAudioId) playAudioSegment(currentAudioId);
    }
    function playReviewSegment(segmentId) {
      if (inGame) return;
      void window.segmentAudio.play('review', segmentId).catch(() => {
        showToast('音声を再生できません。もう一度再生ボタンを押してください。');
      });
    }
