// ============================================================
// GAME.JS — Core state machine & round logic
// Shared by offline (local) and online (Firebase-synced) modes.
// This file has NO Firebase/DOM dependency — pure game logic —
// so it's easy to reason about and reuse for validation on the
// "host" client in online mode.
// ============================================================

const STATES = [
  'HOME', 'MODE_SELECT', 'SETUP', 'LOBBY', 'ROUND_START', 'SHUFFLING',
  'DEALING', 'PUBLIC_REVEAL', 'POLICE_IDENTIFIED', 'POLICE_GUESS',
  'RESULT', 'SCORE_UPDATE', 'ROUND_END', 'FINAL_RESULT'
];

class ChorPoliceGame {
  /**
   * @param {object} config
   *  players: [{id,name,avatar,isHost,isBot,botDifficulty}]
   *  cardDefs: card definitions (see cards.js)
   *  numRounds: number
   *  policeRewardPoints: number — points transferred on correct/incorrect guess
   */
  constructor(config) {
    this.players = config.players.map(p => ({ ...p, score: 0, roundScore: 0, isConnected: true }));
    this.cardDefs = config.cardDefs;
    this.numRounds = config.numRounds;
    this.policeRewardPoints = config.policeRewardPoints ?? 100;
    this.round = 0;
    this.state = 'ROUND_START';
    this.assignment = {}; // playerId -> card
    this.policeId = null;
    this.thiefId = null;
    this.guessedSuspectId = null;
    this.roundHistory = [];
    this.listeners = [];
  }

  onChange(fn) { this.listeners.push(fn); }
  _emit() { this.listeners.forEach(fn => fn(this)); }

  startRound() {
    this.round += 1;
    this.state = 'SHUFFLING';
    const deck = CP_Cards.buildDeckForPlayerCount(this.cardDefs, this.players.length);
    this.assignment = CP_Cards.dealCards(this.players, deck);
    this.policeId = this.players.find(p => this.assignment[p.id].type === 'police').id;
    this.thiefId = this.players.find(p => this.assignment[p.id].type === 'thief').id;
    this.guessedSuspectId = null;
    this.players.forEach(p => { p.roundScore = 0; });
    this._emit();
  }

  advanceToDealing() { this.state = 'DEALING'; this._emit(); }

  advanceToPublicReveal() {
    this.state = 'PUBLIC_REVEAL';
    this._emit();
  }

  // What's visible to everyone right now, given reveal rules.
  publicRevealState() {
    const revealedCardsByPlayer = {};
    this.players.forEach(p => {
      const card = this.assignment[p.id];
      const isPolice = card.type === 'police';
      const isPubliclyRevealed = isPolice || (card.type === 'normal' && card.revealed);
      revealedCardsByPlayer[p.id] = isPubliclyRevealed ? card : null;
    });
    return { revealedCardsByPlayer, policeId: this.policeId };
  }

  advanceToPoliceIdentified() { this.state = 'POLICE_IDENTIFIED'; this._emit(); }
  advanceToPoliceGuess() { this.state = 'POLICE_GUESS'; this._emit(); }

  suspects() {
    return this.players.filter(p => p.id !== this.policeId).map(p => p.id);
  }

  // Only the Police (human or bot) may call this, exactly once per round.
  submitGuess(suspectId) {
    if (this.state !== 'POLICE_GUESS') throw new Error('Not in guessing state.');
    if (this.guessedSuspectId !== null) throw new Error('Guess already submitted.');
    if (!this.suspects().includes(suspectId)) throw new Error('Invalid suspect.');
    this.guessedSuspectId = suspectId;
    this.state = 'RESULT';
    this._resolveRound();
    this._emit();
  }

  _resolveRound() {
    const correct = this.guessedSuspectId === this.thiefId;
    const police = this.players.find(p => p.id === this.policeId);
    const thief = this.players.find(p => p.id === this.thiefId);

    if (correct) {
      police.roundScore += this.policeRewardPoints;
    } else {
      thief.roundScore += this.policeRewardPoints;
    }

    this.players.forEach(p => {
      if (p.id === this.policeId || p.id === this.thiefId) return;
      const card = this.assignment[p.id];
      const val = typeof card.value === 'number' ? card.value : 0;
      p.roundScore += val;
    });

    this.players.forEach(p => { p.score += p.roundScore; });

    this.roundHistory.push({
      round: this.round,
      policeId: this.policeId,
      thiefId: this.thiefId,
      guessedSuspectId: this.guessedSuspectId,
      correct,
      scores: this.players.map(p => ({ id: p.id, name: p.name, roundScore: p.roundScore, total: p.score })),
    });

    this.correctGuessResult = correct;
    this.state = 'SCORE_UPDATE';
  }

  advanceToRoundEnd() { this.state = 'ROUND_END'; this._emit(); }

  hasNextRound() { return this.round < this.numRounds; }

  advanceToNextRoundOrFinal() {
    if (this.hasNextRound()) {
      this.state = 'ROUND_START';
      this._emit();
      this.startRound();
    } else {
      this.state = 'FINAL_RESULT';
      this._emit();
    }
  }

  leaderboard() {
    return this.players.slice().sort((a, b) => b.score - a.score);
  }

  winner() { return this.leaderboard()[0]; }
}

if (typeof window !== 'undefined') {
  window.CP_Game = { ChorPoliceGame, STATES };
}
