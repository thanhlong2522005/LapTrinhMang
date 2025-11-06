// server/src/game.js
const VALID = new Set(["ROCK", "PAPER", "SCISSORS"]);

function judge(choiceA, choiceB) {
  if (choiceA === choiceB) return 0;
  if (
    (choiceA === "ROCK" && choiceB === "SCISSORS") ||
    (choiceA === "SCISSORS" && choiceB === "PAPER") ||
    (choiceA === "PAPER" && choiceB === "ROCK")
  ) {
    return 1;
  }
  return -1;
}

class Game {
  constructor(roomId, playerSockets, sendFunc, onGameEnd) {
    this.roomId = roomId;
    this.players = playerSockets; // array of ws sockets
    this.send = sendFunc; // function(toWs, msgObj)
    this.onGameEnd = onGameEnd;
    this.running = false;
    this.round = 0;
    this.choices = new Map(); // ws.id -> normalizedChoice (UPPERCASE)
    this.roundTimeout = 15000;
    this.nextRoundDelay = 5000;
    this._roundTimer = null;
    this._stopping = false;
    this._usernames = new Map();
    this._roundsData = []; // lưu rounds để matchMaker dùng khi cần

    this.players.forEach((ws) => {
      this._usernames.set(ws.id, ws.username || `Player-${ws.id}`);
    });
  }

  // Gửi tới tất cả socket còn mở
  broadcast(message) {
    this.players.forEach((ws) => {
      try {
        if (ws && ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify(message));
        }
      } catch (e) {
        console.error("[Game] broadcast send error:", e.message);
      }
    });
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.round = 0;
    this.broadcast({
      event: "GAME_START",
      payload: { roomId: this.roomId, msg: "Game starting" },
    });
    setTimeout(() => this.startRound(), 500);
  }

  startRound() {
    if (!this.running || this._stopping) return;
    this.round += 1;
    this.choices.clear();

    // Notify clients round start and provide current players info (reset currentMove)
    const playersPayload = this.players.map((ws) => ({
      id: ws.id,
      username: this._usernames.get(ws.id),
      currentMove: null,
    }));

    this.broadcast({
      event: "ROUND_START",
      payload: { roundNumber: this.round, timeout: this.roundTimeout },
    });

    // Also emit GAME_UPDATE so clients can reset UI if they expect it
    this.broadcast({
      event: "GAME_UPDATE",
      payload: { players: playersPayload },
    });

    if (this._roundTimer) clearTimeout(this._roundTimer);
    this._roundTimer = setTimeout(() => this.endRound("timeout"), this.roundTimeout);
  }

  // normalize incoming choice to uppercase standard
  _normalizeChoice(choice) {
    if (!choice && choice !== "") return null;
    return String(choice).trim().toUpperCase();
  }

  handlePlayerMove(ws, rawChoice) {
    if (!this.running || this._stopping) return;
    const choice = this._normalizeChoice(rawChoice);
    if (!VALID.has(choice)) {
      this.send(ws, { event: "ERROR", payload: { message: "Invalid choice" } });
      return;
    }
    if (!this.players.includes(ws)) {
      this.send(ws, { event: "ERROR", payload: { message: "You are not in this room" } });
      return;
    }

    this.choices.set(ws.id, choice);
    this.send(ws, { event: "INFO", payload: { message: `Choice received: ${choice}` } });

    if (this.choices.size >= this.players.length) {
      if (this._roundTimer) {
        clearTimeout(this._roundTimer);
        this._roundTimer = null;
      }
      this.endRound("all_moves_in");
    }
  }

  endRound(reason) {
    const pA = this.players[0];
    const pB = this.players[1];
    const choiceA = this.choices.get(pA.id) || null;
    const choiceB = this.choices.get(pB.id) || null;

    let res = 0;
    let winnerWsId = null;

    if (choiceA && choiceB) {
      res = judge(choiceA, choiceB);
      if (res === 1) winnerWsId = pA.id;
      else if (res === -1) winnerWsId = pB.id;
    } else if (!choiceA && !choiceB) {
      winnerWsId = null;
    } else {
      // one moved, other didn't -> mover wins by default
      winnerWsId = choiceA ? pA.id : pB.id;
    }

    // Build standardized round result that client expects
    const roundPayload = {
      player1Move: choiceA,
      player2Move: choiceB,
      winner: winnerWsId ? winnerWsId : "DRAW",
      roomId: this.roomId,
      round: this.round,
      reason,
    };

    // Broadcast ROUND_RESULT so client store picks it up
    this.broadcast({ event: "ROUND_RESULT", payload: roundPayload });

    // Push round data for persistence
    this._roundsData.push({
      roundNumber: this.round,
      player1Id: pA.userId ?? null,
      player2Id: pB.userId ?? null,
      moveP1: choiceA,
      moveP2: choiceB,
      winner: winnerWsId ?? null,
    });

    // schedule next round if game still running
    if (!this._stopping) {
      setTimeout(() => {
        // send NEXT_ROUND (or GAME_UPDATE) to reset client currentMove
        const playersPayload = this.players.map((ws) => ({
          id: ws.id,
          username: this._usernames.get(ws.id),
          currentMove: null,
        }));
        this.broadcast({ event: "NEXT_ROUND", payload: { players: playersPayload } });

        // start next round if sockets still open
        if (this.players.every((ws) => ws && ws.readyState === ws.OPEN)) {
          this.startRound();
        } else {
          this.shutdown("player_disconnect");
        }
      }, this.nextRoundDelay);
    }
  }

  playerLeave(ws, reason = "left") {
    const other = this.players.find((p) => p !== ws);
    if (other && other.readyState === other.OPEN) {
      this.send(other, {
        event: "INFO",
        payload: { message: `Opponent left (${reason}). Game ended.` },
      });
    }
    this._stopping = true;
    this.running = false;
    if (this._roundTimer) clearTimeout(this._roundTimer);
    if (this.onGameEnd) this.onGameEnd(ws);
  }

  async shutdown(reason = "shutdown") {
    this._stopping = true;
    this.running = false;
    if (this._roundTimer) clearTimeout(this._roundTimer);

    this.broadcast({ event: "INFO", payload: { message: `Game ended: ${reason}` } });

    // compute final winner (by rounds)
    let scoreA = 0,
      scoreB = 0;
    for (const r of this._roundsData) {
      if (r.winner === this.players[0].id) scoreA++;
      else if (r.winner === this.players[1].id) scoreB++;
    }
    const player1Id = this.players[0].userId ?? null;
    const player2Id = this.players[1].userId ?? null;
    const winnerId = scoreA > scoreB ? player1Id : scoreB > scoreA ? player2Id : null;

    // Optionally call onGameEnd to let MatchMaker persist match
    if (this.onGameEnd) this.onGameEnd(null);
  }
}

export default Game;
