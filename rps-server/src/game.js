import axios from "axios";

const VALID = new Set(["rock", "paper", "scissors"]);

function judge(choiceA, choiceB) {
  if (choiceA === choiceB) return 0;
  if (
    (choiceA === "rock" && choiceB === "scissors") ||
    (choiceA === "scissors" && choiceB === "paper") ||
    (choiceA === "paper" && choiceB === "rock")
  )
    return 1;
  return -1;
}

class Game {
  constructor(roomId, playerSockets, sendFunc, onGameEnd) {
    this.roomId = roomId;
    this.players = playerSockets;
    this.send = sendFunc;
    this.onGameEnd = onGameEnd;
    this.running = false;
    this.round = 0;
    this.choices = new Map();
    this.roundTimeout = 15000;
    this.nextRoundDelay = 5000;
    this._roundTimer = null;
    this._stopping = false;
    this._usernames = new Map();
    this._roundsData = []; // ✅ lưu từng round

    this.players.forEach((ws) => {
      this._usernames.set(ws.id, ws.username || `Player-${ws.id}`);
    });
  }

  /** 🔹 Gửi đến tất cả người chơi */
  broadcast(message) {
    this.players.forEach((ws) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(message));
      }
    });
  }

  /** 🔹 Bắt đầu game */
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

  /** 🔹 Bắt đầu round mới */
  startRound() {
    if (!this.running || this._stopping) return;
    this.round += 1;
    this.choices.clear();

    this.broadcast({
      event: "ROUND_START",
      payload: { roundNumber: this.round, timeout: this.roundTimeout },
    });

    if (this._roundTimer) clearTimeout(this._roundTimer);
    this._roundTimer = setTimeout(() => this.endRound("timeout"), this.roundTimeout);
  }

  /** 🔹 Nhận lựa chọn từ người chơi */
  handlePlayerMove(ws, choice) {
    if (!this.running || this._stopping) return;
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
      clearTimeout(this._roundTimer);
      this._roundTimer = null;
      this.endRound("all_moves_in");
    }
  }

  /** 🔹 Kết thúc 1 round */
  endRound(reason) {
    const pA = this.players[0];
    const pB = this.players[1];
    const choiceA = this.choices.get(pA.id) || null;
    const choiceB = this.choices.get(pB.id) || null;

    let summary = { reason, choiceA, choiceB, winner: null };
    let results = [];
    let res = 0;

    if (choiceA && choiceB) {
      res = judge(choiceA, choiceB);
      if (res === 1) summary.winner = pA.userId;
      else if (res === -1) summary.winner = pB.userId;

      results = [
        {
          playerId: pA.userId,
          username: this._usernames.get(pA.id),
          choice: choiceA,
          outcome: res === 1 ? "win" : res === 0 ? "tie" : "lose",
        },
        {
          playerId: pB.userId,
          username: this._usernames.get(pB.id),
          choice: choiceB,
          outcome: res === -1 ? "win" : res === 0 ? "tie" : "lose",
        },
      ];
    } else if (!choiceA && !choiceB) {
      results = [
        { playerId: pA.userId, username: this._usernames.get(pA.id), choice: null, outcome: "no_move" },
        { playerId: pB.userId, username: this._usernames.get(pB.id), choice: null, outcome: "no_move" },
      ];
    } else {
      const mover = choiceA ? pA : pB;
      const non = choiceA ? pB : pA;
      summary.winner = mover.userId;
      results = [
        {
          playerId: mover.userId,
          username: this._usernames.get(mover.id),
          choice: choiceA || choiceB,
          outcome: "win_by_default",
        },
        {
          playerId: non.userId,
          username: this._usernames.get(non.id),
          choice: null,
          outcome: "no_move",
        },
      ];
    }

    this.broadcast({
      event: "RESULT",
      payload: { roomId: this.roomId, round: this.round, results, summary },
    });

    // ✅ Lưu round vào bộ nhớ
    this._roundsData.push({
      roundNumber: this.round,
      moveP1: choiceA,
      moveP2: choiceB,
      result: res === 1 ? "P1" : res === -1 ? "P2" : "draw",
    });

    if (!this._stopping) {
      setTimeout(() => {
        if (this.players.every((ws) => ws.readyState === ws.OPEN)) {
          this.startRound();
        } else {
          this.shutdown("player_disconnect");
        }
      }, this.nextRoundDelay);
    }
  }

  /** 🔹 Người chơi rời */
  playerLeave(ws, reason = "left") {
    const other = this.players.find((p) => p !== ws);
    if (other && other.readyState === other.OPEN) {
      this.send(other, {
        event: "INFO",
        payload: { message: `Opponent left (${reason}). Game ended.` },
      });
    }
    this.shutdown("player_leave");
    if (this.onGameEnd) this.onGameEnd(ws);
  }

  /** 🔹 Kết thúc game, lưu kết quả */
  async shutdown(reason = "shutdown") {
    this._stopping = true;
    this.running = false;
    if (this._roundTimer) clearTimeout(this._roundTimer);

    this.broadcast({ event: "INFO", payload: { message: `Game ended: ${reason}` } });

    try {
      const pA = this.players[0];
      const pB = this.players[1];

      const player1Id = pA.userId;
      const player2Id = pB.userId;

      // ✅ xác định ai thắng nhiều hơn
      let scoreA = 0, scoreB = 0;
      for (const r of this._roundsData) {
        if (r.result === "P1") scoreA++;
        else if (r.result === "P2") scoreB++;
      }

      const winnerId = scoreA > scoreB ? player1Id : scoreB > scoreA ? player2Id : null;

      const payload = {
        player1Id,
        player2Id,
        winnerId,
        rounds: this._roundsData,
      };

      console.log(`📦 [MatchMaker] Saving match:`, payload);

      const res = await axios.post("http://localhost:3000/api/matches", payload);
      console.log(`[Game] ✅ Match ${this.roomId} saved (${res.status})`);
    } catch (err) {
      console.error(`[Game] ❌ Failed to save match ${this.roomId}:`, err.message);
    }
  }
}

export default Game;
