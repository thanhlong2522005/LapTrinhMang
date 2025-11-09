// server/src/game.js
const VALID = new Set(["ROCK", "PAPER", "SCISSORS"]);

function judge(choiceA, choiceB) {
  if (choiceA === choiceB) return 0; // draw
  if (
    (choiceA === "ROCK" && choiceB === "SCISSORS") ||
    (choiceA === "SCISSORS" && choiceB === "PAPER") ||
    (choiceA === "PAPER" && choiceB === "ROCK")
  ) {
    return 1; // A wins
  }
  return -1; // B wins
}

class Game {
  constructor(roomId, playerSockets = [], sendFunc, onGameEnd) {
    this.roomId = roomId;
    this.players = playerSockets;
    this.send = sendFunc;
    this.onGameEnd = onGameEnd;

    this.running = false;
    this.round = 0;
    this.choices = new Map(); // playerId -> move
    this.roundTimeout = 15000;
    this.nextRoundDelay = 3000;

    this._roundTimer = null;
    this._stopping = false;
    this._usernames = new Map();
    this._roundsData = [];
    this.scores = new Map();

    this.players.forEach((ws) => {
      this._usernames.set(ws.id, ws.username || `Player-${ws.id}`);
      this.scores.set(ws.id, 0);
    });

    if (this.players.length < 2) {
      this._notifyWaiting();
    }
  }

  // Add player when they press "join"
  addPlayer(ws) {
    if (this.players.find((p) => p.id === ws.id)) return;

    this.players.push(ws);
    this._usernames.set(ws.id, ws.username || `Player-${ws.id}`);
    if (!this.scores.has(ws.id)) this.scores.set(ws.id, 0);

    if (this.players.length < 2) {
      this._notifyWaiting();
      return;
    }

    // Enough players => start game
    if (!this.running && !this._stopping) {
      this.start();
    } else {
      this._broadcastPlayersUpdate();
    }
  }

  // Remove player when they leave
  removePlayer(ws) {
    this.players = this.players.filter((p) => p.id !== ws.id);
    if (this.players.length < 2) {
      this.playerLeave(ws, "left");
    }
  }

  broadcast(message) {
    this.players.forEach((ws) => {
      try {
        if (ws && ws.readyState === ws.OPEN) {
          this.send(ws, message);
        }
      } catch (e) {
        console.error("[Game] broadcast send error:", e.message);
      }
    });
  }

  _notifyWaiting() {
    // Send waiting status to all current players
    this.players.forEach((ws) => {
      try {
        if (ws && ws.readyState === ws.OPEN) {
          this.send(ws, {
            event: "WAITING_FOR_OPPONENT",
            payload: {
              roomId: this.roomId,
              message: "Đang chờ đối thủ tham gia...",
              playersJoined: this.players.length,
              playersNeeded: 2,
            },
          });
        }
      } catch {}
    });
  }

  _playersPayload() {
    return this.players.map((ws) => ({
      id: ws.id,
      username: this._usernames.get(ws.id),
      score: this.scores.get(ws.id) || 0,
    }));
  }

  _broadcastPlayersUpdate() {
    this.broadcast({
      event: "GAME_UPDATE",
      payload: { players: this._playersPayload() },
    });
  }

  start() {
    if (this.running) return;

    if (this.players.length < 2) {
      this._notifyWaiting();
      return;
    }

    this.running = true;
    this.round = 0;
    this.choices.clear();

    this.broadcast({
      event: "GAME_START",
      payload: {
        roomId: this.roomId,
        msg: "Game starting",
        players: this._playersPayload(),
      },
    });

    setTimeout(() => this.startRound(), 500);
  }

  startRound() {
    if (!this.running || this._stopping) return;
    if (this.players.length < 2) {
      this._notifyWaiting();
      return;
    }

    this.round += 1;
    this.choices.clear();

    const playersPayload = this.players.map((ws) => ({
      id: ws.id,
      username: this._usernames.get(ws.id),
      currentMove: null, // do not reveal until end
      score: this.scores.get(ws.id) || 0,
    }));

    this.broadcast({
      event: "ROUND_START",
      payload: {
        roundNumber: this.round,
        timeout: this.roundTimeout,
        players: playersPayload,
      },
    });

    this._broadcastPlayersUpdate();

    if (this._roundTimer) clearTimeout(this._roundTimer);
    this._roundTimer = setTimeout(() => this.endRound("timeout"), this.roundTimeout);
  }

  _normalizeChoice(choice) {
    if (!choice && choice !== "") return null;
    return String(choice).trim().toUpperCase();
  }

  handlePlayerMove(ws, rawChoice) {
    if (!this.running || this._stopping) {
      if (this.players.length < 2) {
        this.send(ws, {
          event: "WAITING_FOR_OPPONENT",
          payload: { message: "Đang chờ đối thủ tham gia..." },
        });
      } else {
        this.send(ws, {
          event: "ERROR",
          payload: { message: "Game chưa bắt đầu hoặc đang dừng." },
        });
      }
      return;
    }

    if (this.players.length < 2) {
      this.send(ws, {
        event: "WAITING_FOR_OPPONENT",
        payload: { message: "Đang chờ đối thủ tham gia..." },
      });
      return;
    }

    const choice = this._normalizeChoice(rawChoice);
    if (!VALID.has(choice)) {
      this.send(ws, { event: "ERROR", payload: { message: "Invalid choice" } });
      return;
    }

    if (!this.players.find((p) => p.id === ws.id)) {
      this.send(ws, { event: "ERROR", payload: { message: "You are not in this room" } });
      return;
    }

    // lock first move per round
    if (this.choices.has(ws.id)) {
      this.send(ws, { event: "INFO", payload: { message: "Move already submitted." } });
      return;
    }

    this.choices.set(ws.id, choice);

    this.send(ws, {
      event: "MOVE_CONFIRMED",
      payload: {
        message: `Choice received: ${choice}`,
        waitingForOpponent: this.choices.size < this.players.length,
      },
    });

    if (this.choices.size >= this.players.length) {
      if (this._roundTimer) {
        clearTimeout(this._roundTimer);
        this._roundTimer = null;
      }
      this.endRound("all_moves_in");
    }
  }

  endRound(reason) {
    if (this.players.length < 2) {
      this._notifyWaiting();
      return;
    }

    const pA = this.players[0];
    const pB = this.players[1];
    const choiceA = this.choices.get(pA.id) || null;
    const choiceB = this.choices.get(pB.id) || null;

    let resLabel = "NONE"; // "A_WIN" | "B_WIN" | "DRAW" | "NONE"
    let winnerWsId = null;

    if (choiceA && choiceB) {
      const res = judge(choiceA, choiceB);
      if (res === 1) {
        winnerWsId = pA.id;
        resLabel = "A_WIN";
        this.scores.set(pA.id, (this.scores.get(pA.id) || 0) + 1); // win +1
      } else if (res === -1) {
        winnerWsId = pB.id;
        resLabel = "B_WIN";
        this.scores.set(pB.id, (this.scores.get(pB.id) || 0) + 1); // win +1
      } else {
        winnerWsId = "DRAW";
        resLabel = "DRAW";
        // draw: both +1
        this.scores.set(pA.id, (this.scores.get(pA.id) || 0) + 1);
        this.scores.set(pB.id, (this.scores.get(pB.id) || 0) + 1);
      }
    } else if (!choiceA && !choiceB) {
      // No one played: no score change
      winnerWsId = "NONE";
      resLabel = "NONE";
    } else {
      // One missed: the other wins +1
      winnerWsId = choiceA ? pA.id : pB.id;
      resLabel = choiceA ? "A_WIN" : "B_WIN";
      this.scores.set(winnerWsId, (this.scores.get(winnerWsId) || 0) + 1);
    }

    const payload = {
      roomId: this.roomId,
      round: this.round,
      reason,
      player1: {
        id: pA.id,
        username: this._usernames.get(pA.id),
        move: choiceA, // reveal
        score: this.scores.get(pA.id) || 0,
      },
      player2: {
        id: pB.id,
        username: this._usernames.get(pB.id),
        move: choiceB, // reveal
        score: this.scores.get(pB.id) || 0,
      },
      winner: winnerWsId, // "DRAW" | "NONE" | playerId
      result: resLabel,
    };

    this.broadcast({ event: "ROUND_RESULT", payload });

    this._roundsData.push({
      roundNumber: this.round,
      player1Id: pA.userId ?? null,
      player2Id: pB.userId ?? null,
      moveP1: choiceA,
      moveP2: choiceB,
      winner: winnerWsId && winnerWsId !== "DRAW" && winnerWsId !== "NONE" ? winnerWsId : null,
    });

    if (!this._stopping) {
      setTimeout(() => {
        const playersPayload = this._playersPayload();

        this.broadcast({
          event: "NEXT_ROUND",
          payload: {
            players: playersPayload,
            message: "Next round starting soon...",
          },
        });

        if (this.players.every((ws) => ws && ws.readyState === ws.OPEN)) {
          this.startRound();
        } else {
          this.shutdown("player_disconnected");
        }
      }, this.nextRoundDelay);
    }
  }

  playerLeave(leaverWs, reason = "left") {
    const other = this.players.find((p) => p.id !== leaverWs.id);
    if (other && other.readyState === other.OPEN) {
      this.send(other, {
        event: "OPPONENT_LEFT",
        payload: { message: `Opponent left (${reason}). Game ended.` },
      });
    }
    this._stopping = true;
    this.running = false;
    if (this._roundTimer) clearTimeout(this._roundTimer);
    if (this.onGameEnd) this.onGameEnd(leaverWs);
  }

  async shutdown(reason = "shutdown") {
    this._stopping = true;
    this.running = false;
    if (this._roundTimer) clearTimeout(this._roundTimer);

    const p1 = this.players[0];
    const p2 = this.players[1];
    const scoreA = p1 ? this.scores.get(p1.id) || 0 : 0;
    const scoreB = p2 ? this.scores.get(p2.id) || 0 : 0;
    const winnerId = scoreA > scoreB ? p1?.id ?? null : scoreB > scoreA ? p2?.id ?? null : null;

    this.broadcast({
      event: "GAME_END",
      payload: {
        message: `Game ended: ${reason}`,
        finalScores: {
          player1: p1 ? { id: p1.id, score: scoreA } : null,
          player2: p2 ? { id: p2.id, score: scoreB } : null,
        },
        winner: winnerId,
      },
    });

    if (this.onGameEnd) this.onGameEnd(null);
  }
}

export default Game;