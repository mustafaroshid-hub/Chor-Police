// ============================================================
// BOTS.JS — Bot AI for offline mode
// Bots only ever see information they're entitled to (their own
// card, and whatever has been publicly revealed). They never
// read hidden state directly off the game object for their guess.
// ============================================================

const BOT_NAME_POOL = ['Rahim', 'Karim', 'Rafi', 'Sami', 'Arif', 'Nabil', 'Tanvir', 'Farhan'];

function pickBotNames(count) {
  const shuffled = CP_Cards.shuffle(BOT_NAME_POOL);
  return shuffled.slice(0, count);
}

// difficulty: 'easy' | 'normal' | 'hard'
// Returns a suspectId chosen from `suspects` (array of player ids, excludes police).
// `publicInfo` = { revealedCardsByPlayer: {playerId: card|null} } — only what's public.
function botChooseSuspect(botPlayerId, suspects, publicInfo, difficulty = 'normal') {
  // Base: uniform suspicion across all suspects
  const weights = {};
  suspects.forEach(id => { weights[id] = 1; });

  // If a suspect's card has been publicly revealed and it's not the thief
  // value, a rational bot should downweight them heavily (they're cleared).
  suspects.forEach(id => {
    const revealed = publicInfo.revealedCardsByPlayer[id];
    if (revealed && revealed.type !== 'thief') {
      weights[id] *= 0.05; // nearly ruled out, but not impossible (info could be stale/edge case)
    }
  });

  // Difficulty affects how "sharp" the bot's reasoning is — hard bots lean
  // harder into the deduced weights; easy bots are closer to random.
  const sharpness = { easy: 0.3, normal: 0.7, hard: 1.0 }[difficulty] ?? 0.7;
  const blended = {};
  suspects.forEach(id => {
    blended[id] = (1 - sharpness) * 1 + sharpness * weights[id];
  });

  return weightedRandomPick(blended);
}

function weightedRandomPick(weightMap) {
  const entries = Object.entries(weightMap);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [id, w] of entries) {
    r -= w;
    if (r <= 0) return id;
  }
  return entries[entries.length - 1][0];
}

if (typeof window !== 'undefined') {
  window.CP_Bots = { pickBotNames, botChooseSuspect };
}
