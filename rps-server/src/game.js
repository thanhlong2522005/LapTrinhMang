import WebSocket from 'ws';

const VALID = new Set(["ROCK", "PAPER", "SCISSORS"]);

function judge(a, b) {
  if (a === b) return 0;
  if (
    (a === "ROCK" && b === "SCISSORS") ||
    (a === "SCISSORS" && b === "PAPER") ||
    (a === "PAPER" && b === "ROCK")
  ) return 1;
  return -1;
}

class Game {
  constructor(roomId, playerSockets = [], sendFunc, onGameEnd) {
    this.roomId = roomId;
    this.roomId = roomId;
    this.players = playerSockets;
    this.send = sendFunc;
    this.onGameEnd = onGameEnd;

    this.running = false;
    this.round = 0;
    this.choices = new Map();
    this.scores = new Map();
    this._usernames = new Map();
    this._roundsData = [];

    this.roundTimeout = 15000;
    
    this.nextRoundDelay = 3000;
    this._roundTimer = null;
    this._stopping = false;

    this.players.forEach(ws => {
      this._usernames.set(ws.id, ws.username || `Player-${ws.id}`);
      this.scores.set(ws.id, 0);
    });
    if (this.players.length < 2) this._notifyWaiting();
  }
  
  addPlayer(ws) {
    if (this.players.find(p => p.id === ws.id)) return;
    this.players.push(ws);
    this._usernames.set(ws.id, ws.username || `Player-${ws.id}`);
    if (!this.scores.has(ws.id)) this.scores.set(ws.id, 0);

    if (this.players.length < 2) {
      this._notifyWaiting();
      return;
    }
    if (!this.running && !this._stopping) this.start();
    else this._broadcastPlayersUpdate();
  }


  removePlayer(ws) {
    this.players = this.players.filter(p => p.id !== ws.id);
    if (this.players.length < 2) this.playerLeave(ws, "left");
  }


  broadcast(message) {
    this.players.forEach(ws => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        try { this.send(ws, message); } catch {}
      }
    });
  }

  _notifyWaiting() {
    this.players.forEach(ws => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        this.send(ws, {
          event: "WAITING_FOR_OPPONENT",
          payload: {
            roomId: this.roomId,
            message: "Đang chờ đối thủ...",
            playersJoined: this.players.length,
            playersNeeded: 2
          }
        });
      }
    });
  }

  _playersPayload() {
    return this.players.map(ws => ({
      id: ws.id,
      username: this._usernames.get(ws.id),
      score: this.scores.get(ws.id) || 0
    }));
  }

  _broadcastPlayersUpdate() {
    this.broadcast({ event: "GAME_UPDATE", payload: { players: this._playersPayload() } });
  }

  start() {
    if (this.running || this.players.length < 2) {
      if (this.players.length < 2) this._notifyWaiting();
      return;
    }

    this.running = true;
    this.round = 0;
    this.choices.clear();

    this.broadcast({
      event: "GAME_START",
      payload: {
        roomId: this.roomId,
        players: this._playersPayload()
      }
    });

    setTimeout(() => this.startRound(), 400);
  }

  startRound() {
    if (!this.running || this._stopping) return;
    if (this.players.length < 2) { this._notifyWaiting(); return; }

    this.round += 1;
    this.choices.clear();

   
    this.broadcast({
      event: "ROUND_START",
      payload: {
        roundNumber: this.round,
        timeout: this.roundTimeout,
        players: this.players.map(ws => ({
          id: ws.id,
          username: this._usernames.get(ws.id),
          currentMove: null,
          score: this.scores.get(ws.id) || 0
        }))
      }
    });

    this._broadcastPlayersUpdate();


    if (this._roundTimer) clearTimeout(this._roundTimer);
    this._roundTimer = setTimeout(() => this.endRound("timeout"), this.roundTimeout);
  }

 
  _normalizeChoice(choice) {
    if (choice == null) return null;
    return String(choice).trim().toUpperCase();
  }

  handlePlayerMove(ws, raw) {
    if (!this.running || this._stopping) {
      this.send(ws, { event: "ERROR", payload: { message: "Game chưa bắt đầu hoặc đã dừng." } });
      return;
    }
    if (this.players.length < 2) { this._notifyWaiting(); return; }

    const choice = this._normalizeChoice(raw);
    if (!VALID.has(choice)) {
      this.send(ws, { event: "ERROR", payload: { message: "Lựa chọn không hợp lệ" } });
      return;
    }
    if (!this.players.find(p => p.id === ws.id)) {
      this.send(ws, { event: "ERROR", payload: { message: "Bạn không thuộc phòng này" } });
      return;
    }
    

    if (this.choices.has(ws.id)) {
      this.send(ws, { event: "INFO", payload: { message: "Đã gửi lựa chọn trước đó." } });
      return;
    }

    this.choices.set(ws.id, choice);
  
    this.send(ws, {
      event: "MOVE_CONFIRMED",
      payload: {
        message: `Đã nhận: ${choice}`,
        waitingForOpponent: this.choices.size < this.players.length
      }
    });

    if (this.choices.size === this.players.length) {
      if (this._roundTimer) { clearTimeout(this._roundTimer); this._roundTimer = null; }
      this.endRound("all_moves_in");
    }
  }

  endRound(reason) {
    if (this.players.length < 2) { this._notifyWaiting(); return; }

    const pA = this.players[0];
    const pB = this.players[1];
    const choiceA = this.choices.get(pA.id) || null;
    const choiceB = this.choices.get(pB.id) || null;

    let result = "NONE";
    let winner = null;

    if (choiceA && choiceB) {
      const r = judge(choiceA, choiceB);
      if (r === 1) {
        winner = pA.id;
        result = "A_WIN";
        this.scores.set(pA.id, (this.scores.get(pA.id) || 0) + 1);
      } else if (r === -1) {
        winner = pB.id;
        result = "B_WIN";
        this.scores.set(pB.id, (this.scores.get(pB.id) || 0) + 1);
      } else {
        winner = "DRAW";
        result = "DRAW";
        this.scores.set(pA.id, (this.scores.get(pA.id) || 0) + 1);
        this.scores.set(pB.id, (this.scores.get(pB.id) || 0) + 1);
      }
    } else if (!choiceA && !choiceB) {
      winner = "NONE";
      result = "NONE";
    } else {
      winner = choiceA ? pA.id : pB.id;
      result = choiceA ? "A_WIN" : "B_WIN";
      this.scores.set(winner, (this.scores.get(winner) || 0) + 1);
    }

    this.broadcast({
      event: "ROUND_RESULT",
      payload: {
        roomId: this.roomId,
        round: this.round,
        reason,
        player1: {
          id: pA.id,
          username: this._usernames.get(pA.id),
          move: choiceA,
          score: this.scores.get(pA.id) || 0
        },
        player2: {
          id: pB.id,
          username: this._usernames.get(pB.id),
          move: choiceB,
          score: this.scores.get(pB.id) || 0
        },
        winner,
        result
      }
    });

    let winnerUserId = null;
    if (winner && winner !== "DRAW" && winner !== "NONE") {
      const winnerWs = this.players.find(p => p.id === winner);
      winnerUserId = winnerWs && winnerWs.userId ? winnerWs.userId : null;
    }

    this._roundsData.push({
      roundNumber: this.round,
    
      moveP1: choiceA,
      moveP2: choiceB,
      winner: winnerUserId
    });


    if (!this._stopping) {
      setTimeout(() => {
 
        const playersPayload = this._playersPayload();
   
        this.broadcast({
          event: "NEXT_ROUND",
          payload: {
            players: playersPayload,
            message: "Chuẩn bị round mới..."
          }
        });

        const allOpen = this.players.every(s => s && s.readyState === WebSocket.OPEN);
        if (allOpen) this.startRound();
        else this.shutdown("player_disconnected");
      }, this.nextRoundDelay);
    }
  }

  playerLeave(leaverWs, reason = "left") {
    const other = this.players.find(p => p.id !== leaverWs.id);
    if (other && other.readyState === WebSocket.OPEN) {
      this.send(other, {
        event: "OPPONENT_LEFT",
        payload: { message: `Đối thủ rời phòng (${reason}).` }
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
    const s1 = p1 ? (this.scores.get(p1.id) || 0) : 0;
    const s2 = p2 ? (this.scores.get(p2.id) || 0) : 0;
    
    let winnerId = null;
    if (s1 > s2 && p1 && p1.userId) winnerId = p1.userId;
    else if (s2 > s1 && p2 && p2.userId) winnerId = p2.userId;

    this.broadcast({
      event: "GAME_END",
      payload: {
        message: `Game ended: ${reason}`,
        finalScores: {
          player1: p1 ? { id: p1.id, score: s1 } : null,
          player2: p2 ? { id: p2.id, score: s2 } : null
        },
        winner: winnerId
      }
    });


    if (this.onGameEnd) this.onGameEnd(null);
  }
}

export default Game;