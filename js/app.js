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

function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

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
  wireChat();
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
  const grid = $('#card-list');
  grid.innerHTML = '';
  App.cardDefs.forEach(card => {
    const locked = card.locked;
    const tile = document.createElement('div');
    tile.className = `card-tile type-${card.type}`;
    tile.innerHTML = `
      ${locked ? '' : `<button class="card-tile-remove" data-id="${card.id}">✕</button>`}
      <div class="card-tile-icon">${card.icon}</div>
      <input class="card-tile-name" type="text" value="${card.name}" ${locked ? 'disabled' : ''} data-id="${card.id}" data-field="name">
      <input class="card-tile-value" type="${card.type === 'police' ? 'text' : 'number'}" value="${card.value}" ${card.type !== 'normal' ? 'disabled' : ''} data-id="${card.id}" data-field="value">
      ${card.type === 'normal'
        ? `<label class="card-tile-reveal"><input type="checkbox" ${card.revealed ? 'checked' : ''} data-id="${card.id}" data-field="revealed"> Show</label>`
        : `<span class="card-tile-reveal-fixed">${card.type === 'police' ? 'Always shown' : 'Hidden'}</span>`}
    `;
    grid.appendChild(tile);
  });

  grid.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('change', e => {
      const { id, field } = e.target.dataset;
      const card = App.cardDefs.find(c => c.id === id);
      if (field === 'revealed') card.revealed = e.target.checked;
      else if (field === 'value') card.value = Number(e.target.value);
      else card.name = e.target.value;
    });
  });
  grid.querySelectorAll('.card-tile-remove').forEach(btn => {
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
// SHARED BOARD RENDERING (used by both offline + online modes)
// ---------------------------------------------------------------

// Evenly spaces `n` seats around an ellipse inscribed in the table.
function positionsForPlayers(n) {
  const rx = 42, ry = 37; // percent of table box
  const positions = [];
  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i / n) - Math.PI / 2;
    positions.push({ x: 50 + rx * Math.cos(angle), y: 50 + ry * Math.sin(angle) });
  }
  return positions;
}

function setBoardStatus(html) { $('#board-status').innerHTML = html; }

function cardFaceHtml(card, extraClass = '') {
  return `<div class="card-face type-${card.type} ${extraClass}">
    <div class="card-icon">${card.icon}</div>
    <div class="card-name">${escapeHtml(card.name)}</div>
    <div class="card-value">${card.value}</div>
  </div>`;
}

// options: { players, myId, revealedCardsByPlayer, policeId, thiefId, selectable, myCard, animateDeal }
function renderBoard(opts) {
  const { players, myId, revealedCardsByPlayer = {}, policeId = null, thiefId = null, selectable = false, myCard = null, animateDeal = false } = opts;
  const table = $('#game-table');
  table.innerHTML = `<div class="table-center" id="table-center">
    <div class="shuffle-deck"><div class="deck-card"></div><div class="deck-card"></div><div class="deck-card"></div></div>
  </div>`;

  const positions = positionsForPlayers(players.length);
  players.forEach((p, i) => {
    const pos = positions[i];
    const isMe = p.id === myId;
    const revealed = revealedCardsByPlayer[p.id];
    const card = isMe ? myCard : revealed;
    const isPolice = p.id === policeId;
    const isThiefRevealed = thiefId && p.id === thiefId;

    const slot = document.createElement('div');
    slot.className = 'player-slot'
      + (isPolice ? ' is-police' : '')
      + (isThiefRevealed ? ' is-thief-revealed' : '')
      + (selectable && p.id !== policeId ? ' selectable' : '');
    slot.style.left = pos.x + '%';
    slot.style.top = pos.y + '%';
    slot.dataset.pid = p.id;

    if (animateDeal) {
      const dx = (50 - pos.x) * 3.6;
      const dy = (50 - pos.y) * 3.6;
      slot.style.setProperty('--dx', dx + 'px');
      slot.style.setProperty('--dy', dy + 'px');
      slot.style.animationDelay = (i * 0.12) + 's';
      slot.classList.add('deal-anim');
    }

    slot.innerHTML = `
      ${isPolice ? '<div class="slot-badge">🕵️</div>' : ''}
      <div class="slot-avatar-wrap"><div class="slot-avatar">${p.avatar || '🧑'}</div></div>
      <div class="slot-name">${escapeHtml(p.name)}${isMe ? ' (You)' : ''}</div>
      <div class="slot-score">${p.score ?? 0}</div>
      <div class="mini-card ${card ? 'flip-in' : 'card-back'}">${card ? cardFaceHtml(card) : '<div class="card-back-face">🂠</div>'}</div>
    `;
    table.appendChild(slot);
  });

  if (selectable) {
    table.querySelectorAll('.player-slot.selectable').forEach(slotEl => {
      slotEl.addEventListener('click', () => onSuspectTap(slotEl.dataset.pid, slotEl));
    });
  }
}

function onSuspectTap(pid, el) {
  CP_Sound.selecting(); haptic();
  $('#game-table').querySelectorAll('.player-slot.selected').forEach(s => s.classList.remove('selected'));
  el.classList.add('selected');
  const name = el.querySelector('.slot-name').textContent;
  $('#confirm-suspect-name').textContent = name;
  $('#guess-confirm').classList.add('active');
  $('#btn-catch-him').onclick = async () => {
    $('#guess-confirm').classList.remove('active');
    if (App.mode === 'offline') submitOfflineGuess(pid);
    else await CP_Online.submitGuess(App.roomCode, pid);
  };
  $('#btn-cancel-guess').onclick = () => { $('#guess-confirm').classList.remove('active'); el.classList.remove('selected'); };
}

function renderRoundBanner({ round, numRounds }) {
  $('#round-banner').textContent = `ROUND ${round} / ${numRounds}`;
}

function renderScoreboardFromEntry(entry) {
  const police = entry.scores.find(s => s.id === entry.policeId);
  const thief = entry.scores.find(s => s.id === entry.thiefId);
  const others = entry.scores.filter(s => s.id !== entry.policeId && s.id !== entry.thiefId);

  const outcomeHtml = entry.correct
    ? `<div class="outcome-banner correct">🎉 THIEF CAUGHT!<span class="outcome-sub">${escapeHtml(police.name)}'s guess was right. ${escapeHtml(thief.name)} was the Thief.</span></div>`
    : `<div class="outcome-banner wrong">💨 THIEF ESCAPED!<span class="outcome-sub">${escapeHtml(police.name)}'s guess was wrong. ${escapeHtml(thief.name)} was the Thief.</span></div>`;

  const roleBoxes = `<div class="role-box-row">
    <div class="role-box ${entry.correct ? 'highlight' : ''}"><div class="role-box-label">${escapeHtml(police.name)} (Police)</div><div class="role-box-score">+${police.roundScore}</div></div>
    <div class="role-box ${!entry.correct ? 'highlight' : ''}"><div class="role-box-label">${escapeHtml(thief.name)} (Thief)</div><div class="role-box-score">+${thief.roundScore}</div></div>
  </div>`;

  const othersHtml = others.length ? `<div class="others-earned">
    <div class="others-earned-title">Others Earned According to Their Cards</div>
    <div class="others-earned-row">${others.map(s => `<div class="others-chip">${escapeHtml(s.name)}<span>+${s.roundScore}</span></div>`).join('')}</div>
  </div>` : '';

  const totalsHtml = `<div class="score-totals">${entry.scores.slice().sort((a, b) => b.total - a.total)
    .map(s => `<div class="score-row"><span>${escapeHtml(s.name)}</span><span class="score-delta">+${s.roundScore}</span><span class="score-total">${s.total}</span></div>`).join('')}</div>`;

  const titleHtml = `<div class="panel-title">ROUND ${entry.round} RESULTS</div>`;
  $('#scoreboard-body').innerHTML = titleHtml + outcomeHtml + roleBoxes + othersHtml + totalsHtml;
}

function showStage(id) {
  $all('.stage').forEach(s => s.classList.remove('active'));
  $(`#${id}`).classList.add('active');
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
    else { cleanupOnlineListeners(); showScreen('screen-home'); }
  });
  bindClick('btn-final-home', () => {
    CP_Sound.stopMusic();
    if (App.mode === 'online') cleanupOnlineListeners();
    showScreen('screen-home');
  });
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
  showStage('stage-board');
  CP_Sound.startMusic();
  App.game.startRound();
  runOfflineRoundSequence();
}

async function runOfflineRoundSequence() {
  const game = App.game;
  showStage('stage-board');
  renderRoundBanner(game);

  setBoardStatus('Shuffling the deck…');
  renderBoard({ players: game.players, myId: App.humanId });
  CP_Sound.cardShuffle();
  await wait(App.settings.animOn ? 1400 : 250);

  game.advanceToDealing();
  setBoardStatus('Dealing cards…');
  renderBoard({ players: game.players, myId: App.humanId, myCard: game.assignment[App.humanId], animateDeal: App.settings.animOn });
  CP_Sound.cardDeal();
  await wait(App.settings.animOn ? 1200 : 250);

  game.advanceToPublicReveal();
  const { revealedCardsByPlayer } = game.publicRevealState();
  setBoardStatus('Revealing public cards…');
  renderBoard({ players: game.players, myId: App.humanId, myCard: game.assignment[App.humanId], revealedCardsByPlayer, policeId: game.policeId });
  CP_Sound.cardFlip();
  await wait(900);

  game.advanceToPoliceIdentified();
  CP_Sound.policeIdentified();
  const police = game.players.find(p => p.id === game.policeId);
  setBoardStatus(police.id === App.humanId ? '🕵️ YOU ARE THE POLICE' : `🕵️ ${escapeHtml(police.name).toUpperCase()} IS THE POLICE`);
  await wait(1400);

  game.advanceToPoliceGuess();
  if (game.policeId === App.humanId) {
    setBoardStatus('WHO IS THE THIEF? Tap a player.');
    renderBoard({ players: game.players, myId: App.humanId, myCard: game.assignment[App.humanId], revealedCardsByPlayer, policeId: game.policeId, selectable: true });
  } else {
    setBoardStatus(`${escapeHtml(police.name)} is deciding...`);
    await wait(1200);
    const suspects = game.suspects();
    const publicInfo = game.publicRevealState();
    const suspectId = CP_Bots.botChooseSuspect(police.id, suspects, publicInfo, police.botDifficulty || 'normal');
    submitOfflineGuess(suspectId);
  }
}

function submitOfflineGuess(suspectId) {
  const game = App.game;
  game.submitGuess(suspectId);
  const { revealedCardsByPlayer } = game.publicRevealState();
  renderBoard({ players: game.players, myId: App.humanId, myCard: game.assignment[App.humanId], revealedCardsByPlayer, policeId: game.policeId, thiefId: game.thiefId });

  const thief = game.players.find(p => p.id === game.thiefId);
  const police = game.players.find(p => p.id === game.policeId);
  if (game.correctGuessResult) {
    setBoardStatus(`🎉 THIEF CAUGHT! ${escapeHtml(thief.name)} was the Thief. ${escapeHtml(police.name)} +${game.policeRewardPoints}`);
    CP_Sound.correctGuess();
    burstConfetti();
  } else {
    setBoardStatus(`💨 THIEF ESCAPED! ${escapeHtml(thief.name)} was the Thief. +${game.policeRewardPoints}`);
    CP_Sound.wrongGuess();
  }

  setTimeout(() => {
    game.advanceToRoundEnd();
    showStage('stage-scoreboard');
    renderScoreboardFromEntry(game.roundHistory[game.roundHistory.length - 1]);
    CP_Sound.roundComplete();

    setTimeout(() => {
      if (game.hasNextRound()) {
        game.advanceToNextRoundOrFinal();
        runOfflineRoundSequence();
      } else {
        game.state = 'FINAL_RESULT';
        showFinalResults(game.leaderboard(), game.winner());
      }
    }, 3200);
  }, 2400);
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
    else driveOnlineGame(room);
  });
  App.unsubCard = CP_Online.listenToMyPrivateCard(code, card => { App.myCard = card; });
  App.unsubChat = CP_Online.listenToChat(code, renderChatMessages);
  App._lastChatCount = 0;
  showChatFab();
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
  if (!document.getElementById('screen-game').classList.contains('active')) {
    showScreen('screen-game');
    CP_Sound.startMusic();
  }
  showStage('stage-board');
  renderRoundBanner({ round: room.round, numRounds: room.numRounds });

  const stateChanged = room.state !== lastRenderedState || room.round !== lastRenderedRound;
  lastRenderedState = room.state; lastRenderedRound = room.round;

  const players = Object.values(room.players).filter(p => p.isConnected);

  if (room.state === 'PUBLIC_REVEAL') {
    if (!stateChanged) return;
    setBoardStatus('Dealing cards…');
    renderBoard({ players, myId: CP_Online.uid, myCard: App.myCard, animateDeal: App.settings.animOn });
    CP_Sound.cardDeal();
    await wait(App.settings.animOn ? 1000 : 200);

    setBoardStatus('Revealing public cards…');
    renderBoard({ players, myId: CP_Online.uid, myCard: App.myCard, revealedCardsByPlayer: room.revealedCardsByPlayer, policeId: room.policeId });
    CP_Sound.cardFlip();
    await wait(900);

    const police = players.find(p => p.id === room.policeId);
    CP_Sound.policeIdentified();
    setBoardStatus(police ? (police.id === CP_Online.uid ? '🕵️ YOU ARE THE POLICE' : `🕵️ ${escapeHtml(police.name).toUpperCase()} IS THE POLICE`) : '');
    await wait(1400);

    if (room.policeId === CP_Online.uid) {
      setBoardStatus('WHO IS THE THIEF? Tap a player.');
      renderBoard({ players, myId: CP_Online.uid, myCard: App.myCard, revealedCardsByPlayer: room.revealedCardsByPlayer, policeId: room.policeId, selectable: true });
    } else {
      setBoardStatus(`${police ? escapeHtml(police.name) : 'Police'} is deciding...`);
    }
    return;
  }

  if (room.state === 'RESULT') {
    if (room.hostId === CP_Online.uid) await CP_Online.hostResolveRound(App.roomCode);
    return; // wait for the resulting snapshot to re-trigger this function
  }

  if (room.state === 'SCORE_UPDATE' || room.state === 'FINAL_RESULT') {
    if (!stateChanged) return;
    const police = players.find(p => p.id === room.policeId);
    const thief = players.find(p => p.id === room.thiefId);
    const correct = room.result === 'CORRECT';

    renderBoard({ players, myId: CP_Online.uid, myCard: App.myCard, revealedCardsByPlayer: room.revealedCardsByPlayer, policeId: room.policeId, thiefId: room.thiefId });
    if (police && thief) {
      setBoardStatus(correct
        ? `🎉 THIEF CAUGHT! ${escapeHtml(thief.name)} was the Thief. ${escapeHtml(police.name)} +${room.policeRewardPoints}`
        : `💨 THIEF ESCAPED! ${escapeHtml(thief.name)} was the Thief. +${room.policeRewardPoints}`);
    }
    correct ? CP_Sound.correctGuess() : CP_Sound.wrongGuess();
    if (correct) burstConfetti();

    setTimeout(() => {
      showStage('stage-scoreboard');
      const last = room.roundHistory[room.roundHistory.length - 1];
      renderScoreboardFromEntry(last);
      CP_Sound.roundComplete();

      if (room.state === 'FINAL_RESULT') {
        const sorted = Object.values(room.players).sort((a, b) => b.score - a.score);
        setTimeout(() => showFinalResults(sorted, sorted[0]), 3000);
      } else if (room.hostId === CP_Online.uid) {
        setTimeout(() => CP_Online.hostNextRound(App.roomCode), 3200);
      }
    }, 2400);
  }
}

function cleanupOnlineListeners() {
  if (App.unsubRoom) App.unsubRoom();
  if (App.unsubCard) App.unsubCard();
  if (App.unsubChat) App.unsubChat();
  App.unsubRoom = null; App.unsubCard = null; App.unsubChat = null;
  hideChatFab();
}

// ---------------------------------------------------------------
// CHAT (online rooms only)
// ---------------------------------------------------------------
function wireChat() {
  bindClick('btn-chat-toggle', () => {
    $('#chat-panel').classList.add('active');
    $('#btn-chat-toggle').classList.remove('has-unread');
    const wrap = $('#chat-messages');
    wrap.scrollTop = wrap.scrollHeight;
  });
  bindClick('btn-chat-close', () => $('#chat-panel').classList.remove('active'));
  bindClick('btn-chat-send', sendChat);
  $('#chat-input').addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(); });
}

function sendChat() {
  const input = $('#chat-input');
  const text = input.value.trim();
  if (!text || !App.roomCode) return;
  input.value = '';
  CP_Online.sendChatMessage(App.roomCode, App.playerName || 'Player', text).catch(() => {});
}

function showChatFab() { $('#btn-chat-toggle').style.display = 'flex'; }
function hideChatFab() { $('#btn-chat-toggle').style.display = 'none'; $('#chat-panel').classList.remove('active'); }

function renderChatMessages(messages) {
  const wrap = $('#chat-messages');
  const nearBottom = wrap.scrollHeight - wrap.scrollTop - wrap.clientHeight < 60;
  const isNewMessage = messages.length > (App._lastChatCount || 0);
  App._lastChatCount = messages.length;

  wrap.innerHTML = messages.map(m => {
    const mine = m.senderId === CP_Online.uid;
    return `<div class="chat-msg ${mine ? 'mine' : ''}">
      ${mine ? '' : `<div class="chat-msg-name">${escapeHtml(m.senderName || 'Player')}</div>`}
      <div class="chat-msg-bubble">${escapeHtml(m.text)}</div>
    </div>`;
  }).join('');

  if (nearBottom || !$('#chat-panel').classList.contains('active')) wrap.scrollTop = wrap.scrollHeight;
  if (isNewMessage && !$('#chat-panel').classList.contains('active')) {
    $('#btn-chat-toggle').classList.add('has-unread');
  }
}

// ---------------------------------------------------------------
// CELEBRATION FX
// ---------------------------------------------------------------
function burstConfetti() {
  if (!App.settings.animOn) return;
  const table = $('#game-table');
  if (!table) return;
  const colors = ['#e8b74d', '#f2cf7e', '#4caf7d', '#d9634f', '#fff3d6'];
  const layer = document.createElement('div');
  layer.className = 'confetti-layer';
  for (let i = 0; i < 26; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    const angle = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 90;
    piece.style.setProperty('--cx', Math.cos(angle) * dist + 'px');
    piece.style.setProperty('--cy', Math.sin(angle) * dist + 'px');
    piece.style.setProperty('--cr', (Math.random() * 360) + 'deg');
    piece.style.background = colors[i % colors.length];
    piece.style.animationDelay = (Math.random() * 0.15) + 's';
    layer.appendChild(piece);
  }
  table.appendChild(layer);
  setTimeout(() => layer.remove(), 1200);
}
