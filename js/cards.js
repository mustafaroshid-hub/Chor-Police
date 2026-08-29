// ============================================================
// CARDS.JS — Card model, default deck, deck-building helpers
// ============================================================
// A card is: { id, name, value, icon, type, revealed }
//   type: "police" | "thief" | "normal"
//   value: number for normal/thief, "Special" (string) for police (display only)
//   revealed: whether this card is publicly shown once dealt (host-configurable
//             for normal cards; police is ALWAYS revealed once identified;
//             thief is NEVER revealed until the round resolves)

function makeId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function defaultCardSet() {
  return [
    { id: makeId('card'), name: 'Police', value: 'Special', icon: 'police', type: 'police', revealed: true, locked: true },
    { id: makeId('card'), name: 'Thief', value: 0, icon: 'thief', type: 'thief', revealed: false, locked: true },
    { id: makeId('card'), name: 'King', value: 90, icon: 'king', type: 'normal', revealed: false },
    { id: makeId('card'), name: 'Minister', value: 70, icon: 'minister', type: 'normal', revealed: false },
    { id: makeId('card'), name: 'Warrior', value: 50, icon: 'warrior', type: 'normal', revealed: false },
    { id: makeId('card'), name: 'Merchant', value: 30, icon: 'merchant', type: 'normal', revealed: false },
    { id: makeId('card'), name: 'Joker', value: 10, icon: 'joker', type: 'normal', revealed: false },
  ];
}

// Ensures a deck has exactly `playerCount` cards by cycling extra copies of
// the lowest-priority normal cards if the host hasn't defined enough unique
// ones. Police + Thief are always singletons.
function buildDeckForPlayerCount(cardDefs, playerCount) {
  const police = cardDefs.find(c => c.type === 'police');
  const thief = cardDefs.find(c => c.type === 'thief');
  const normals = cardDefs.filter(c => c.type === 'normal');

  if (!police || !thief) throw new Error('Deck must contain exactly one Police and one Thief card.');
  if (normals.length === 0) throw new Error('Add at least one normal card besides Police and Thief.');

  const deck = [police, thief];
  let i = 0;
  while (deck.length < playerCount) {
    const base = normals[i % normals.length];
    // clone so duplicate copies get unique ids/instance info but same identity/value
    deck.push({ ...base, id: makeId('card'), sourceId: base.id });
    i++;
  }
  return deck.slice(0, playerCount);
}

function shuffle(array) {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Deals shuffled deck to players, returns { playerId: card }
function dealCards(players, deck) {
  const shuffled = shuffle(deck);
  const assignment = {};
  players.forEach((p, idx) => { assignment[p.id] = shuffled[idx]; });
  return assignment;
}

if (typeof window !== 'undefined') {
  window.CP_Cards = { makeId, defaultCardSet, buildDeckForPlayerCount, shuffle, dealCards };
}
