// server/src/game.js
/**
 * Game class:
 * - roomId
 * - players: array of WebSocket (2 players assumed)
 * - choices: map ws.id -> choice
 * - timers: per-round timeout
 * Events sent to clients (JSON messages):
 *   - 'GAME_START' payload: { roomId }
 *   - 'ROUND_START' payload: { roundId, timeout }
 *   - 'RESULT' payload: { roundId, results: [{ playerId, username, choice, scoreChange }], summary }
 *   - 'INFO' generic messages
 *
 * Client should send MOVE: { roomId, choice } where choice in 'rock'|'paper'|'scissors'
 */

const VALID = new Set(['rock', 'paper', 'scissors']);

function judge(choiceA, choiceB) {
  if (choiceA === choiceB) return 0; // tie
  if (
    (choiceA === 'rock' && choiceB === 'scissors') ||
    (choiceA === 'scissors' && choiceB === 'paper') ||
    (choiceA === 'paper' && choiceB === 'rock')
  ) return 1; // A wins
  return -1; // B wins
}

class Game {
  constructor(roomId, playerSockets, sendFunc, onGameEnd) {
    this.roomId = roomId;
    this.players = playerSockets; // array of ws
    this.send = sendFunc; // (ws, msgObj) => {}
    this.onGameEnd = onGameEnd; // callback when game ends / someone leaves
    this.running = false;
    this.round = 0;
    this.choices = new Map(); // ws.id -> choice
    this.roundTimeout = 15000; // 15 seconds to make a move
    this.nextRoundDelay = 5000; // 5s between rounds
    this._roundTimer = null;
    this._stopping = false;
    this._usernames = new Map(); // ws.id -> username (if provided previously via MATCH_FOUND we don't have username here; clients can send username in JOIN and matchMaker saved it but not accessible here; we'll send what we can)
    // Try to collect username if previously sent via stored ws property (not guaranteed)
    this.players.forEach(ws => {
      this._usernames.set(ws.id, ws.username || `Player-${ws.id}`);
    });
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.round = 0;
    this.broadcast({ event: 'GAME_START', payload: { roomId: this.roomId, msg: 'Game starting' } });
    setTimeout(() => this.startRound(), 500); // small delay
  }

  startRound() {
    if (!this.running || this._stopping) return;
    this.round += 1;
    this.choices.clear();
    const roundId = `r${this.round}`;
    this.broadcast({ event: 'ROUND_START', payload: { roundId, timeout: this.roundTimeout } });
    // set timer
    if (this._roundTimer) clearTimeout(this._roundTimer);
    this._roundTimer = setTimeout(() => {
      this.endRound('timeout');
    }, this.roundTimeout);
  }

  handlePlayerMove(ws, choice) {
    if (!this.running || this._stopping) return;
    if (!VALID.has(choice)) {
      this.send(ws, { event: 'ERROR', payload: { message: 'Invalid choice' } });
      return;
    }
    // ensure ws belongs to this game
    if (!this.players.includes(ws)) {
      this.send(ws, { event: 'ERROR', payload: { message: 'You are not in this room or game' } });
      return;
    }
    this.choices.set(ws.id, choice);
    this.send(ws, { event: 'INFO', payload: { message: `Choice received: ${choice}` } });

    // If both choices present -> end round early
    if (this.choices.size >= this.players.length) {
      if (this._roundTimer) {
        clearTimeout(this._roundTimer);
        this._roundTimer = null;
      }
      this.endRound('all_moves_in');
    }
  }

  endRound(reason) {
    // compute results; for 2 players assumed
    const roundId = `r${this.round}`;
    // get players choices (default 'no_move' if missing)
    const pA = this.players[0];
    const pB = this.players[1];
    const choiceA = this.choices.get(pA.id) || null;
    const choiceB = this.choices.get(pB.id) || null;

    let summary = { reason, choiceA, choiceB, winner: null };

    let results = [];

    if (choiceA && choiceB) {
      const res = judge(choiceA, choiceB); // 1: A wins, 0 tie, -1 B wins
      if (res === 1) summary.winner = pA.id;
      else if (res === -1) summary.winner = pB.id;
      else summary.winner = null;
      results = [
        { playerId: pA.id, username: this._usernames.get(pA.id) || `P-${pA.id}`, choice: choiceA, outcome: res === 1 ? 'win' : (res === 0 ? 'tie' : 'lose') },
        { playerId: pB.id, username: this._usernames.get(pB.id) || `P-${pB.id}`, choice: choiceB, outcome: res === -1 ? 'win' : (res === 0 ? 'tie' : 'lose') }
      ];
    } else if (!choiceA && !choiceB) {
      summary.winner = null;
      results = [
        { playerId: pA.id, username: this._usernames.get(pA.id) || `P-${pA.id}`, choice: null, outcome: 'no_move' },
        { playerId: pB.id, username: this._usernames.get(pB.id) || `P-${pB.id}`, choice: null, outcome: 'no_move' }
      ];
    } else {
      // one player moved, the other didn't -> mover wins by default
      const mover = choiceA ? pA : pB;
      const non = choiceA ? pB : pA;
      summary.winner = mover.id;
      results = [
        { playerId: mover.id, username: this._usernames.get(mover.id)||`P-${mover.id}`, choice: choiceA||choiceB, outcome: 'win_by_default' },
        { playerId: non.id, username: this._usernames.get(non.id)||`P-${non.id}`, choice: null, outcome: 'no_move' }
      ];
    }

    // send RESULT to each player
    this.broadcast({
      event: 'RESULT',
      payload: {
        roomId: this.roomId,
        roundId,
        results,
        summary
      }
    });

    // schedule next round if still running
    if (!this._stopping) {
      setTimeout(() => {
        // double-check players still connected
        if (this.players.every(ws => ws.readyState === ws.OPEN)) {
          this.startRound();
        } else {
          this.shutdown('player_disconnect');
        }
      }, this.nextRoundDelay);
    }
  }

  playerLeave(ws, reason = 'left') {
    // someone left: notify opponent, end game
    const other = this.players.find(p => p !== ws);
    try {
      if (other && other.readyState === other.OPEN) {
        this.send(other, { event: 'INFO', payload: { message: `Opponent left (${reason}). Game ended.` } });
      }
    } catch (e) {}
    this.shutdown('player_leave');
    if (typeof this.onGameEnd === 'function') {
      this.onGameEnd(ws); // inform matchMaker to cleanup room
    }
  }

  shutdown(reason = 'shutdown') {
    this._stopping = true;
    this.running = false;
    if (this._roundTimer) {
      clearTimeout(this._roundTimer);
      this._roundTimer = null;
    }
    // final notice
    this.broadcast({ event: 'INFO', payload: { message: `Game ended: ${reason}` } });
  }

  broadcast(obj) {
    this.players.forEach(ws => {
      try {
        this.send(ws, obj);
      } catch (e) {}
    });
  }
}

module.exports = Game;
