// ============================================================
// APP.JS — Screen routing + orchestration for both game modes
// ============================================================

const App = {
  mode: null, // 'offline' | 'online'
  cardDefs: null,
  playerName: 'You',
  numPlayers: 4,
  numRounds: 5,
  policeRewardPoints: 100,
  botDifficulty: 'normal',
  game: null, // ChorPoliceGame instance (offline)
  humanId: 'human_1',
  // online-specific
  roomCode: null,
  myCard: null,
  unsubRoom: null,
  unsubCard: null,
  latestRoom: null,
  settings: { sfxOn: true, musicOn: true, animOn: true, haptics: true },
};

function $(sel) { return document.querySelector(sel); }
function $all(sel) { return Array.from(document.querySelectorAll(sel)); }

function showScreen(id) {
  $all('.screen').forEach(s => s.classList.remove('active'));
  $(`#${id}`).classList.add('active');
}

function haptic(ms = 15) {
  if (App.settings.haptics && navigator.vibrate) navigator.vibrate(ms);
}

function bindClick(id, fn) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', (...args) => { CP_Sound.buttonClick(); haptic(); fn(...args); });
}

// ---------------------------------------------------------------
// INIT
// ---------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  App.cardDefs = CP_Cards.defaultCardSet();
  renderCardEditor();
  wireHome();
  wireSetup();
  wireGameScreen();
  wireSettings();
  wireOnlineScreens();
  showScreen('screen-home');
});

// ---------------------------------------------------------------
// HOME / MODE SELECT / HOW TO PLAY / SETTINGS
// ---------------------------------------------------------------
function wireHome() {
  bindClick('btn-play-offline', () => { App.mode = 'offline'; showScreen('screen-setup'); $('#setup-online-only').style.display = 'none'; $('#setup-title').textContent = 'Play vs Bots'; });
  bindClick('btn-play-online', () => { showScreen('screen-online-choice'); });
  bindClick('btn-how-to-play', () => showScreen('screen-how-to-play'));
  bindClick('btn-settings', () => showScreen('screen-settings'));
  $all('.btn-back-home').forEach(b => b.addEventListener('click', () => { CP_Sound.buttonClick(); showScreen('screen-home'); }));

  bindClick('btn-online-create', () => { App.mode = 'online'; showScreen('screen-setup'); $('#setup-online-only').style.display = 'block'; $('#setup-title').textContent = 'Create Room'; });
  bindClick('btn-online-join', () => showScreen('screen-join'));
  bindClick('btn-join-submit', async () => {
    const code = $('#join-room-code').value.trim().toUpperCase();
    const name = $('#join-player-name').value.trim() || 'Player';
    if (code.length < 4) return alert('Enter a valid room code.');
    try {
      await ensureFirebaseReady();
      App.playerName = name;
      App.roomCode = code;
      await CP_Online.joinRoom(code, name);
      enterOnlineLobby(code);
    } catch (e) { alert(e.message); }
  });
}

// ---------------------------------------------------------------
// CARD EDITOR (shared by offline + online setup)
// ---------------------------------------------------------------
function renderCardEditor() {
  const list = $('#card-list');
  list.innerHTML = '';
  App.cardDefs.forEach(card => {
    const row = document.createElement('div');
    row.className = 'card-row';
    const locked = card.locked;
    row.innerHTML = `
      <span class="card-row-icon">${card.icon}</span>
      <input class="card-row-name" type="text" value="${card.name}" ${locked ? 'disabled' : ''} data-id="${card.id}" data-field="name">
      <input class="card-row-value" type="${card.type === 'police' ? 'text' : 'number'}" value="${card.value}" ${card.type !== 'normal' ? 'disabled' : ''} data-id="${card.id}" data-field="value">
      ${card.type === 'normal' ? `<label class="card-row-reveal"><input type="checkbox" ${card.revealed ? 'checked' : ''} data-id="${card.id}" data-field="revealed"> Show</label>` : `<span class="card-row-reveal-fixed">${card.type === 'police' ? 'Always shown' : 'Hidden'}</span>`}
      ${locked ? '' : `<button class="card-row-remove" data-id="${card.id}">✕</button>`}
    `;
    list.appendChild(row);
  });

  list.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('change', e => {
      const { id, field } = e.target.dataset;
      const card = App.cardDefs.find(c => c.id === id);
      if (field === 'revealed') card.revealed = e.target.checked;
      else if (field === 'value') card.value = Number(e.target.value);
      else card.name = e.target.value;
    });
  });
  list.querySelectorAll('.card-row-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      App.cardDefs = App.cardDefs.filter(c => c.id !== btn.dataset.id);
      renderCardEditor();
    });
  });
}

function wireSetup() {
  bindClick('btn-add-card', () => {
    const name = $('#new-card-name').value.trim();
    const value = Number($('#new-card-value').value);
    const icon = $('#new-card-icon').value.trim() || '🎴';
    if (!name || Number.isNaN(value)) return alert('Enter a card name and numeric value.');
    App.cardDefs.push({ id: CP_Cards.makeId('card'), name, value, icon, type: 'normal', revealed: false });
    $('#new-card-name').value = ''; $('#new-card-value').value = ''; $('#new-card-icon').value = '';
    renderCardEditor();
  });

  bindClick('btn-players-minus', () => setPlayerCount(App.numPlayers - 1));
  bindClick('btn-players-plus', () => setPlayerCount(App.numPlayers + 1));
  bindClick('btn-rounds-minus', () => setRoundCount(App.numRounds - 1));
  bindClick('btn-rounds-plus', () => setRoundCount(App.numRounds + 1));

  bindClick('btn-setup-continue', () => {
    App.numRounds = Number($('#rounds-count').textContent);
    App.policeRewardPoints = Number($('#police-reward').value) || 100;
    App.botDifficulty = $('#bot-difficulty').value;
    App.settings.animOn = $('#toggle-3d').checked;
    App.settings.sfxOn = $('#toggle-sfx').checked;
    App.settings.musicOn = $('#toggle-music').checked;
    CP_Sound.setSfxOn(App.settings.sfxOn);
    CP_Sound.setMusicOn(App.settings.musicOn);

    if (App.cardDefs.length < 3) return alert('Add at least one custom card besides Police & Thief.');

    if (App.mode === 'offline') startOfflineGame();
    else createOnlineRoomFlow();
  });

  setPlayerCount(4);
  setRoundCount(5);
}

function setPlayerCount(n) {
  App.numPlayers = Math.max(4, Math.min(10, n));
  $('#players-count').textContent = App.numPlayers;
}
function setRoundCount(n) {
  App.numRounds = Math.max(1, Math.min(20, n));
  $('#rounds-count').textContent = App.numRounds;
}

// ---------------------------------------------------------------
// OFFLINE MODE
// ---------------------------------------------------------------
function startOfflineGame() {
  const botNames = CP_Bots.pickBotNames(App.numPlayers - 1);
  const players = [
    { id: App.humanId, name: App.playerName || 'You', avatar: '🧑', isHost: true, isBot: false },
    ...botNames.map((name, i) => ({ id: `bot_${i}`, name, avatar: '🤖', isHost: false, isBot: true, botDifficulty: App.botDifficulty })),
  ];
  App.game = new CP_Game.ChorPoliceGame({
    players, cardDefs: App.cardDefs, numRounds: App.numRounds, policeRewardPoints: App.policeRewardPoints,
  });
  showScreen('screen-game');
  CP_Sound.startMusic();
  App.game.startRound();
  runOfflineRoundSequence();
}

async function runOfflineRoundSequence() {
  const game = App.game;
  renderRoundBanner(game);
  showStage('stage-shuffle');
  CP_Sound.cardShuffle();
  await wait(App.settings.animOn ? 1600 : 300);

  game.advanceToDealing();
  showStage('stage-deal');
  renderDealtCardsOffline(game);
  CP_Sound.cardDeal();
  await wait(App.settings.animOn ? 1400 : 300);

  game.advanceToPublicReveal();
  revealPublicCardsOffline(game);
  await wait(App.settings.animOn ? 900 : 200);

  game.advanceToPoliceIdentified();
  CP_Sound.policeIdentified();
  showStage('stage-police-identified');
  renderPoliceIdentified(game);
  await wait(1400);

  game.advanceToPoliceGuess();
  showStage('stage-guess');
  if (game.policeId === App.humanId) {
    renderHumanGuessUI(game);
  } else {
    renderWaitingOnBot(game);
    await wait(1200);
    const suspects = game.suspects();
    const publicInfo = game.publicRevealState();
    const bot = game.players.find(p => p.id === game.policeId);
    const suspectId = CP_Bots.botChooseSuspect(bot.id, suspects, publicInfo, bot.botDifficulty || 'normal');
    submitOfflineGuess(suspectId);
  }
}

function submitOfflineGuess(suspectId) {
  const game = App.game;
  game.submitGuess(suspectId);
  showStage('stage-result');
  renderResult(game);
  if (game.correctGuessResult) CP_Sound.correctGuess(); else CP_Sound.wrongGuess();

  setTimeout(() => {
    game.advanceToRoundEnd();
    showStage('stage-scoreboard');
    renderScoreboard(game);
    CP_Sound.roundComplete();

    setTimeout(() => {
      if (game.hasNextRound()) {
        game.advanceToNextRoundOrFinal();
        runOfflineRoundSequence();
      } else {
        game.state = 'FINAL_RESULT';
        showFinalResults(game.leaderboard(), game.winner());
      }
    }, 2600);
  }, 2200);
}

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

// ---------------------------------------------------------------
// GAME SCREEN RENDERING (shared visuals; data source differs by mode)
// ---------------------------------------------------------------
function showStage(id) {
  $all('.stage').forEach(s => s.classList.remove('active'));
  $(`#${id}`).classList.add('active');
}

function renderRoundBanner(game) {
  $('#round-banner').textContent = `ROUND ${game.round} / ${game.numRounds}`;
}

function playerChip(p, extra = '') {
  return `<div class="player-chip ${extra}" data-pid="${p.id}">
    <div class="player-avatar">${p.avatar || '🧑'}</div>
    <div class="player-name">${escapeHtml(p.name)}</div>
    <div class="player-total">${p.score ?? 0}</div>
  </div>`;
}

function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

function renderDealtCardsOffline(game) {
  const wrap = $('#deal-players');
  wrap.innerHTML = game.players.map(p => {
    const isHuman = p.id === App.humanId;
    const card = game.assignment[p.id];
    return `<div class="deal-slot">
      <div class="mini-card ${isHuman ? 'flip-in' : 'card-back'}" data-pid="${p.id}">
        ${isHuman ? cardFaceHtml(card) : '<div class="card-back-face">🂠</div>'}
      </div>
      <div class="deal-slot-name">${escapeHtml(p.name)}${isHuman ? ' (You)' : ''}</div>
    </div>`;
  }).join('');
}

function cardFaceHtml(card) {
  return `<div class="card-face type-${card.type}">
    <div class="card-icon">${card.icon}</div>
    <div class="card-name">${escapeHtml(card.name)}</div>
    <div class="card-value">${card.value}</div>
  </div>`;
}

function revealPublicCardsOffline(game) {
  const { revealedCardsByPlayer } = game.publicRevealState();
  Object.entries(revealedCardsByPlayer).forEach(([pid, card]) => {
    if (!card || pid === App.humanId) return;
    const el = document.querySelector(`#deal-players .mini-card[data-pid="${pid}"]`);
    if (el) { el.classList.remove('card-back'); el.classList.add('flip-in'); el.innerHTML = cardFaceHtml(card); CP_Sound.cardFlip(); }
  });
}

function renderPoliceIdentified(game) {
  const police = game.players.find(p => p.id === game.policeId);
  const isYou = police.id === App.humanId;
  $('#police-identified-text').innerHTML = isYou
    ? `🕵️ <strong>YOU ARE THE POLICE</strong>`
    : `🕵️ <strong>${escapeHtml(police.name).toUpperCase()} IS THE POLICE</strong>`;
}

function renderHumanGuessUI(game) {
  const wrap = $('#suspect-list');
  const suspects = game.players.filter(p => p.id !== game.policeId);
  wrap.innerHTML = suspects.map(p => `<button class="suspect-btn" data-pid="${p.id}">
    <div class="player-avatar">${p.avatar}</div>${escapeHtml(p.name)}
  </button>`).join('');
  $('#guess-heading').textContent = 'WHO IS THE THIEF?';
  $('#guess-confirm').classList.remove('active');

  wrap.querySelectorAll('.suspect-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      CP_Sound.selecting(); haptic();
      wrap.querySelectorAll('.suspect-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      $('#confirm-suspect-name').textContent = btn.textContent.trim();
      $('#guess-confirm').classList.add('active');
      $('#btn-catch-him').onclick = () => submitOfflineGuess(btn.dataset.pid);
      $('#btn-cancel-guess').onclick = () => { $('#guess-confirm').classList.remove('active'); btn.classList.remove('selected'); };
    });
  });
}

function renderWaitingOnBot(game) {
  const police = game.players.find(p => p.id === game.policeId);
  $('#guess-heading').textContent = `${police.name.toUpperCase()} is deciding...`;
  $('#suspect-list').innerHTML = '';
  $('#guess-confirm').classList.remove('active');
}

function renderResult(game) {
  const thief = game.players.find(p => p.id === game.thiefId);
  const police = game.players.find(p => p.id === game.policeId);
  if (game.correctGuessResult) {
    $('#result-banner').innerHTML = `🎉 <strong>THIEF CAUGHT!</strong><br><span class="result-sub">${escapeHtml(thief.name)} was the Thief. ${escapeHtml(police.name)} +${game.policeRewardPoints}</span>`;
    $('#result-banner').className = 'result-banner correct';
  } else {
    $('#result-banner').innerHTML = `💨 <strong>THE THIEF ESCAPED!</strong><br><span class="result-sub">${escapeHtml(thief.name)} was the Thief. ${escapeHtml(thief.name)} +${game.policeRewardPoints}</span>`;
    $('#result-banner').className = 'result-banner wrong';
  }
}

function renderScoreboard(game) {
  const entry = game.roundHistory[game.roundHistory.length - 1];
  $('#scoreboard-title').textContent = `ROUND ${entry.round} RESULTS`;
  $('#scoreboard-list').innerHTML = entry.scores
    .slice().sort((a, b) => b.total - a.total)
    .map(s => `<div class="score-row"><span>${escapeHtml(s.name)}</span><span class="score-delta">+${s.roundScore}</span><span class="score-total">${s.total}</span></div>`)
    .join('');
}

function showFinalResults(leaderboard, winner) {
  showStage('stage-final');
  CP_Sound.victory();
  $('#final-winner').textContent = `🏆 ${winner.name.toUpperCase()} WINS!`;
  $('#final-list').innerHTML = leaderboard.map((p, i) => {
    const medal = ['🥇', '🥈', '🥉'][i] || `${i + 1}.`;
    return `<div class="final-row ${i === 0 ? 'winner' : ''}"><span>${medal} ${escapeHtml(p.name)}</span><span>${p.score}</span></div>`;
  }).join('');
}

function wireGameScreen() {
  bindClick('btn-play-again', () => {
    if (App.mode === 'offline') startOfflineGame();
    else showScreen('screen-home');
  });
  bindClick('btn-final-home', () => { CP_Sound.stopMusic(); showScreen('screen-home'); });
}

function wireSettings() {
  const s = App.settings;
  $('#toggle-sfx').checked = s.sfxOn;
  $('#toggle-music').checked = s.musicOn;
  $('#toggle-3d').checked = s.animOn;
  $('#toggle-haptics').checked = s.haptics;
  $('#toggle-sfx').addEventListener('change', e => { s.sfxOn = e.target.checked; CP_Sound.setSfxOn(s.sfxOn); });
  $('#toggle-music').addEventListener('change', e => { s.musicOn = e.target.checked; CP_Sound.setMusicOn(s.musicOn); });
  $('#toggle-3d').addEventListener('change', e => { s.animOn = e.target.checked; });
  $('#toggle-haptics').addEventListener('change', e => { s.haptics = e.target.checked; });
  $('#sfx-volume').addEventListener('input', e => CP_Sound.setSfxVolume(Number(e.target.value)));
  $('#music-volume').addEventListener('input', e => CP_Sound.setMusicVolume(Number(e.target.value)));
}

// ---------------------------------------------------------------
// ONLINE MODE
// ---------------------------------------------------------------
let firebaseReady = false;
async function ensureFirebaseReady() {
  if (firebaseReady) return;
  if (!window.FIREBASE_CONFIG || !window.FIREBASE_CONFIG.apiKey) {
    throw new Error('Firebase isn\'t configured yet — add your project keys to js/firebase-config.js.');
  }
  await CP_Online.initFirebase(window.FIREBASE_CONFIG);
  firebaseReady = true;
}

function wireOnlineScreens() {
  bindClick('btn-lobby-start', async () => {
    if (!App.latestRoom || App.latestRoom.hostId !== CP_Online.uid) return;
    await CP_Online.hostStartGame(App.roomCode);
  });
  bindClick('btn-lobby-copy', () => {
    navigator.clipboard?.writeText(App.roomCode);
    $('#btn-lobby-copy').textContent = 'Copied!';
    setTimeout(() => { $('#btn-lobby-copy').textContent = 'Copy Code'; }, 1200);
  });
  bindClick('btn-lobby-leave', async () => {
    await CP_Online.leaveRoom(App.roomCode);
    cleanupOnlineListeners();
    showScreen('screen-home');
  });
}

async function createOnlineRoomFlow() {
  try {
    await ensureFirebaseReady();
    const code = await CP_Online.createRoom(App.playerName || 'Host', {
      numRounds: App.numRounds, cardDefs: App.cardDefs, policeRewardPoints: App.policeRewardPoints,
      maxPlayers: 10,
    });
    App.roomCode = code;
    enterOnlineLobby(code);
  } catch (e) { alert(e.message); }
}

function enterOnlineLobby(code) {
  showScreen('screen-lobby');
  $('#lobby-room-code').textContent = code;

  App.unsubRoom = CP_Online.listenToRoom(code, room => {
    App.latestRoom = room;
    if (room.state === 'LOBBY') renderLobby(room);
    else if (room.state !== 'LOBBY') driveOnlineGame(room);
  });
  App.unsubCard = CP_Online.listenToMyPrivateCard(code, card => { App.myCard = card; });
}

function renderLobby(room) {
  const players = Object.values(room.players).filter(p => p.isConnected);
  $('#lobby-players-count').textContent = `${players.length} / ${room.maxPlayers}`;
  $('#lobby-rounds').textContent = room.numRounds;
  $('#lobby-player-list').innerHTML = players.map(p =>
    `<div class="lobby-player">${p.isHost ? '👑' : '👤'} ${escapeHtml(p.name)}${p.id === CP_Online.uid ? ' (You)' : ''}</div>`
  ).join('');
  const isHost = room.hostId === CP_Online.uid;
  $('#btn-lobby-start').style.display = isHost ? 'block' : 'none';
  $('#lobby-waiting-text').style.display = isHost ? 'none' : 'block';
  $('#btn-lobby-start').disabled = players.length < 4;
}

let lastRenderedState = null;
let lastRenderedRound = null;
async function driveOnlineGame(room) {
  if (showScreen && !document.getElementById('screen-game').classList.contains('active')) {
    showScreen('screen-game');
    CP_Sound.startMusic();
  }
  renderRoundBanner({ round: room.round, numRounds: room.numRounds });

  const stateChanged = room.state !== lastRenderedState || room.round !== lastRenderedRound;
  lastRenderedState = room.state; lastRenderedRound = room.round;
  if (!stateChanged) return; // avoid re-triggering animations on unrelated field updates

  const players = Object.values(room.players).filter(p => p.isConnected);

  if (room.state === 'PUBLIC_REVEAL') {
    showStage('stage-deal');
    renderDealtCardsOnline(room, players);
    CP_Sound.cardDeal();
    await wait(App.settings.animOn ? 900 : 200);
    revealPublicCardsOnline(room, players);
  }
  if (room.state === 'RESULT' || room.state === 'SCORE_UPDATE' || room.state === 'FINAL_RESULT') {
    // Host performs the authoritative resolution once.
    if (room.hostId === CP_Online.uid && room.state === 'RESULT') {
      await CP_Online.hostResolveRound(App.roomCode);
      return; // the resulting snapshot re-triggers this function
    }
  }
  if (room.state === 'RESULT') return; // wait for host to resolve

  if (room.state === 'SCORE_UPDATE' || room.state === 'FINAL_RESULT') {
    showStage('stage-result');
    const police = players.find(p => p.id === room.policeId);
    const thief = players.find(p => p.id === room.thiefId);
    const correct = room.result === 'CORRECT';
    if (police && thief) {
      $('#result-banner').innerHTML = correct
        ? `🎉 <strong>THIEF CAUGHT!</strong><br><span class="result-sub">${escapeHtml(thief.name)} was the Thief. ${escapeHtml(police.name)} +${room.policeRewardPoints}</span>`
        : `💨 <strong>THE THIEF ESCAPED!</strong><br><span class="result-sub">${escapeHtml(thief.name)} was the Thief. ${escapeHtml(thief.name)} +${room.policeRewardPoints}</span>`;
      $('#result-banner').className = `result-banner ${correct ? 'correct' : 'wrong'}`;
    }
    correct ? CP_Sound.correctGuess() : CP_Sound.wrongGuess();

    setTimeout(() => {
      showStage('stage-scoreboard');
      const last = room.roundHistory[room.roundHistory.length - 1];
      $('#scoreboard-title').textContent = `ROUND ${last.round} RESULTS`;
      $('#scoreboard-list').innerHTML = last.scores.slice().sort((a, b) => b.total - a.total)
        .map(s => `<div class="score-row"><span>${escapeHtml(s.name)}</span><span class="score-delta">+${s.roundScore}</span><span class="score-total">${s.total}</span></div>`).join('');
      CP_Sound.roundComplete();

      if (room.state === 'FINAL_RESULT') {
        setTimeout(() => showFinalResults(Object.values(room.players).sort((a, b) => b.score - a.score), Object.values(room.players).sort((a, b) => b.score - a.score)[0]), 2400);
      } else if (room.hostId === CP_Online.uid) {
        setTimeout(() => CP_Online.hostNextRound(App.roomCode), 2600);
      }
    }, 2200);
    return;
  }

  if (room.policeId === CP_Online.uid && !room.guessedSuspectId && room.state === 'PUBLIC_REVEAL') {
    setTimeout(() => {
      showStage('stage-guess');
      $('#police-identified-text').innerHTML = `🕵️ <strong>YOU ARE THE POLICE</strong>`;
      renderHumanGuessUIOnline(room, players);
    }, 1800);
  } else if (room.state === 'PUBLIC_REVEAL') {
    const police = players.find(p => p.id === room.policeId);
    setTimeout(() => {
      showStage('stage-police-identified');
      $('#police-identified-text').innerHTML = police ? `🕵️ <strong>${escapeHtml(police.name).toUpperCase()} IS THE POLICE</strong>` : '';
      CP_Sound.policeIdentified();
    }, 900);
    setTimeout(() => showStage('stage-guess'), 2300);
    setTimeout(() => renderWaitingOnBot({ players, policeId: room.policeId }), 2300);
  }
}

function renderDealtCardsOnline(room, players) {
  const wrap = $('#deal-players');
  wrap.innerHTML = players.map(p => {
    const isMe = p.id === CP_Online.uid;
    return `<div class="deal-slot">
      <div class="mini-card ${isMe ? 'flip-in' : 'card-back'}" data-pid="${p.id}">
        ${isMe && App.myCard ? cardFaceHtml(App.myCard) : '<div class="card-back-face">🂠</div>'}
      </div>
      <div class="deal-slot-name">${escapeHtml(p.name)}${isMe ? ' (You)' : ''}</div>
    </div>`;
  }).join('');
}

function revealPublicCardsOnline(room, players) {
  Object.entries(room.revealedCardsByPlayer || {}).forEach(([pid, card]) => {
    if (!card || pid === CP_Online.uid) return;
    const el = document.querySelector(`#deal-players .mini-card[data-pid="${pid}"]`);
    if (el) { el.classList.remove('card-back'); el.classList.add('flip-in'); el.innerHTML = cardFaceHtml(card); CP_Sound.cardFlip(); }
  });
}

function renderHumanGuessUIOnline(room, players) {
  const wrap = $('#suspect-list');
  const suspects = players.filter(p => p.id !== room.policeId);
  wrap.innerHTML = suspects.map(p => `<button class="suspect-btn" data-pid="${p.id}">
    <div class="player-avatar">${p.avatar}</div>${escapeHtml(p.name)}
  </button>`).join('');
  $('#guess-heading').textContent = 'WHO IS THE THIEF?';
  $('#guess-confirm').classList.remove('active');

  wrap.querySelectorAll('.suspect-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      CP_Sound.selecting(); haptic();
      wrap.querySelectorAll('.suspect-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      $('#confirm-suspect-name').textContent = btn.textContent.trim();
      $('#guess-confirm').classList.add('active');
      $('#btn-catch-him').onclick = async () => {
        $('#guess-confirm').classList.remove('active');
        await CP_Online.submitGuess(App.roomCode, btn.dataset.pid);
      };
      $('#btn-cancel-guess').onclick = () => { $('#guess-confirm').classList.remove('active'); btn.classList.remove('selected'); };
    });
  });
}

function cleanupOnlineListeners() {
  if (App.unsubRoom) App.unsubRoom();
  if (App.unsubCard) App.unsubCard();
  App.unsubRoom = null; App.unsubCard = null;
}
