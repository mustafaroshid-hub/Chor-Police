// ============================================================
// ONLINE.JS — Firebase Firestore real-time multiplayer
// Uses Firebase v10 modular SDK loaded via <script type="module">
// in index.html. Anonymous auth gives each browser a stable uid,
// which security rules use to gate who can read/write what.
//
// DATA MODEL
//   rooms/{code}                     — public room state (safe for
//                                       everyone in the room to read)
//   rooms/{code}/secret/current      — thief identity + full deal.
//                                       Readable ONLY by the host uid.
//   rooms/{code}/privateCards/{pid}  — one player's own card.
//                                       Readable ONLY by that uid.
//
// HONEST CAVEAT: this is "host-authoritative", not server-authoritative.
// The host's own browser computes the deal and the result, so a human
// host who is also playing technically has the info in memory. Firestore
// rules stop OTHER players from snooping each other's cards or editing
// scores, which is what matters for friendly play. True cheat-proofing
// against a malicious host needs a Cloud Function to deal/resolve
// server-side — see README for the upgrade path.
// ============================================================

let db = null;
let auth = null;
let currentUid = null;
let fb = null; // holds the imported firestore/auth function bundle

async function initFirebase(config) {
  const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js');
  const authMod = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');
  const fsMod = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');

  const app = initializeApp(config);
  auth = authMod.getAuth(app);
  db = fsMod.getFirestore(app);
  fb = { ...authMod, ...fsMod };

  await authMod.signInAnonymously(auth);
  await new Promise(resolve => {
    const unsub = authMod.onAuthStateChanged(auth, user => {
      if (user) { currentUid = user.uid; unsub(); resolve(); }
    });
  });
  return currentUid;
}

function genRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
  let code = '';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

async function createRoom(hostName, settings) {
  const code = genRoomCode();
  const roomRef = fb.doc(db, 'rooms', code);
  const hostPlayer = {
    id: currentUid, name: hostName, avatar: settings.avatar || '🧑', isHost: true,
    isConnected: true, isBot: false, score: 0, roundScore: 0,
  };
  await fb.setDoc(roomRef, {
    code, hostId: currentUid, state: 'LOBBY', round: 0,
    numRounds: settings.numRounds, cardDefs: settings.cardDefs,
    policeRewardPoints: settings.policeRewardPoints ?? 100,
    minPlayers: 4, maxPlayers: settings.maxPlayers || 8,
    players: { [currentUid]: hostPlayer },
    policeId: null, guessedSuspectId: null, result: null,
    revealedCardsByPlayer: {}, roundHistory: [],
    createdAt: fb.serverTimestamp(),
  });
  return code;
}

async function joinRoom(code, playerName) {
  const roomRef = fb.doc(db, 'rooms', code);
  const snap = await fb.getDoc(roomRef);
  if (!snap.exists()) throw new Error('Room not found.');
  const room = snap.data();
  if (room.state !== 'LOBBY') throw new Error('Game already started.');
  const playerCount = Object.keys(room.players).length;
  if (playerCount >= room.maxPlayers) throw new Error('Room is full.');

  const newPlayer = {
    id: currentUid, name: playerName, avatar: '🧑', isHost: false,
    isConnected: true, isBot: false, score: 0, roundScore: 0,
  };
  await fb.updateDoc(roomRef, { [`players.${currentUid}`]: newPlayer });
  return currentUid;
}

function listenToRoom(code, callback) {
  const roomRef = fb.doc(db, 'rooms', code);
  return fb.onSnapshot(roomRef, snap => {
    if (snap.exists()) callback(snap.data());
  });
}

function listenToMyPrivateCard(code, callback) {
  const cardRef = fb.doc(db, 'rooms', code, 'privateCards', currentUid);
  return fb.onSnapshot(cardRef, snap => {
    callback(snap.exists() ? snap.data().card : null);
  });
}

async function leaveRoom(code) {
  const roomRef = fb.doc(db, 'rooms', code);
  await fb.updateDoc(roomRef, { [`players.${currentUid}.isConnected`]: false });
  // Host migration: if the leaving player was host, hand off to another
  // connected player. Read-modify-write; fine at friend-group scale.
  const snap = await fb.getDoc(roomRef);
  const room = snap.data();
  if (room.hostId === currentUid) {
    const nextHost = Object.values(room.players).find(p => p.id !== currentUid && p.isConnected);
    if (nextHost) {
      await fb.updateDoc(roomRef, {
        hostId: nextHost.id,
        [`players.${nextHost.id}.isHost`]: true,
      });
    }
  }
}

// ---- HOST-ONLY ACTIONS ----
// (Firestore rules should also enforce request.auth.uid == resource.data.hostId
//  for these writes — see firestore.rules in the README.)

async function hostStartGame(code) {
  const roomRef = fb.doc(db, 'rooms', code);
  await fb.updateDoc(roomRef, { state: 'ROUND_START' });
  await hostDealRound(code);
}

async function hostDealRound(code) {
  const roomRef = fb.doc(db, 'rooms', code);
  const snap = await fb.getDoc(roomRef);
  const room = snap.data();
  const players = Object.values(room.players).filter(p => p.isConnected);
  const deck = CP_Cards.buildDeckForPlayerCount(room.cardDefs, players.length);
  const assignment = CP_Cards.dealCards(players, deck);

  const policeId = players.find(p => assignment[p.id].type === 'police').id;
  const thiefId = players.find(p => assignment[p.id].type === 'thief').id;

  const revealedCardsByPlayer = {};
  players.forEach(p => {
    const card = assignment[p.id];
    const isPolice = card.type === 'police';
    revealedCardsByPlayer[p.id] = (isPolice || (card.type === 'normal' && card.revealed)) ? card : null;
  });

  const batch = fb.writeBatch(db);
  players.forEach(p => {
    const cardRef = fb.doc(db, 'rooms', code, 'privateCards', p.id);
    batch.set(cardRef, { card: assignment[p.id] });
  });
  const secretRef = fb.doc(db, 'rooms', code, 'secret', 'current');
  batch.set(secretRef, { thiefId, assignment });
  batch.update(roomRef, {
    round: fb.increment(1), state: 'PUBLIC_REVEAL', policeId, thiefId: null, // thiefId withheld publicly
    guessedSuspectId: null, result: null, revealedCardsByPlayer,
  });
  await batch.commit();
}

async function submitGuess(code, suspectId) {
  const roomRef = fb.doc(db, 'rooms', code);
  const snap = await fb.getDoc(roomRef);
  const room = snap.data();
  if (room.policeId !== currentUid) throw new Error('Only the Police can guess.');
  if (room.guessedSuspectId) throw new Error('Guess already submitted.');
  await fb.updateDoc(roomRef, { guessedSuspectId: suspectId, state: 'RESULT' });
  // Host resolves (host listens for state === 'RESULT' and calls hostResolveRound)
}

async function hostResolveRound(code) {
  const roomRef = fb.doc(db, 'rooms', code);
  const secretRef = fb.doc(db, 'rooms', code, 'secret', 'current');
  const [roomSnap, secretSnap] = await Promise.all([fb.getDoc(roomRef), fb.getDoc(secretRef)]);
  const room = roomSnap.data();
  const { thiefId, assignment } = secretSnap.data();

  const correct = room.guessedSuspectId === thiefId;
  const players = { ...room.players };
  const policeId = room.policeId;

  Object.values(players).forEach(p => { p.roundScore = 0; });
  if (correct) players[policeId].roundScore += room.policeRewardPoints;
  else players[thiefId].roundScore += room.policeRewardPoints;

  Object.values(players).forEach(p => {
    if (p.id === policeId || p.id === thiefId) return;
    const card = assignment[p.id];
    const val = typeof card.value === 'number' ? card.value : 0;
    p.roundScore += val;
  });
  Object.values(players).forEach(p => { p.score += p.roundScore; });

  const roundHistoryEntry = {
    round: room.round, policeId, thiefId, guessedSuspectId: room.guessedSuspectId, correct,
    scores: Object.values(players).map(p => ({ id: p.id, name: p.name, roundScore: p.roundScore, total: p.score })),
  };

  const isFinal = room.round >= room.numRounds;
  await fb.updateDoc(roomRef, {
    players, thiefId, result: correct ? 'CORRECT' : 'WRONG',
    state: isFinal ? 'FINAL_RESULT' : 'SCORE_UPDATE',
    roundHistory: fb.arrayUnion(roundHistoryEntry),
  });
}

async function hostNextRound(code) {
  await hostDealRound(code);
}

// ---- CHAT ----
async function sendChatMessage(code, senderName, text) {
  const trimmed = (text || '').trim().slice(0, 300);
  if (!trimmed) return;
  const msgsRef = fb.collection(db, 'rooms', code, 'messages');
  await fb.addDoc(msgsRef, {
    senderId: currentUid, senderName, text: trimmed, ts: fb.serverTimestamp(),
  });
}

function listenToChat(code, callback) {
  const msgsRef = fb.collection(db, 'rooms', code, 'messages');
  const q = fb.query(msgsRef, fb.orderBy('ts', 'asc'), fb.limit(100));
  return fb.onSnapshot(q, snap => {
    callback(snap.docs.map(d => d.data()));
  });
}

if (typeof window !== 'undefined') {
  window.CP_Online = {
    initFirebase, createRoom, joinRoom, listenToRoom, listenToMyPrivateCard,
    leaveRoom, hostStartGame, hostDealRound, submitGuess, hostResolveRound, hostNextRound,
    sendChatMessage, listenToChat,
    get uid() { return currentUid; },
  };
}
