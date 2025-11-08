// server/src/game.js
const VALID = new Set(["ROCK", "PAPER", "SCISSORS"]);

/**
 * judge: so sánh hai nước đi
 * trả về:
 *   1  -> choiceA thắng choiceB
 *   0  -> hòa
 *  -1  -> choiceA thua choiceB
 */
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
    this.players = playerSockets; // mảng các socket ws
    this.send = sendFunc; // callback send: (toWs, msgObj)
    this.onGameEnd = onGameEnd; // callback khi game kết thúc
    this.running = false;
    this.round = 0;
    this.choices = new Map(); // mapping ws.id -> lựa chọn (UPPERCASE)
    this.roundTimeout = 15000; // thời gian chờ mỗi round (ms)
    this.nextRoundDelay = 5000; // delay trước round kế tiếp (ms)
    this._roundTimer = null;
    this._stopping = false;
    this._usernames = new Map();
    this._roundsData = []; // lưu dữ liệu mỗi round để matchMaker dùng khi cần

    // Số ván tối đa trước khi game tự dừng (mặc định 5)
    this.maxRounds = 5;

    // Khởi tạo username cho mỗi socket
    this.players.forEach((ws) => {
      this._usernames.set(ws.id, ws.username || `Player-${ws.id}`);
    });
  }

  // Gửi message tới tất cả socket vẫn mở
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

    // Thông báo bắt đầu round, gửi thông tin player (reset currentMove)
    const playersPayload = this.players.map((ws) => ({
      id: ws.id,
      username: this._usernames.get(ws.id),
      currentMove: null,
    }));

    this.broadcast({
      event: "ROUND_START",
      payload: { roundNumber: this.round, timeout: this.roundTimeout },
    });

    // Gửi GAME_UPDATE để client reset UI nếu cần
    this.broadcast({
      event: "GAME_UPDATE",
      payload: { players: playersPayload },
    });

    if (this._roundTimer) clearTimeout(this._roundTimer);
    this._roundTimer = setTimeout(() => this.endRound("timeout"), this.roundTimeout);
  }

  // Chuẩn hóa lựa chọn (uppercase)
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

    // Nếu tất cả đã chọn, kết thúc round sớm
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
      else winnerWsId = null; // hòa
    } else if (!choiceA && !choiceB) {
      winnerWsId = null; // cả hai không đánh -> không có winner
    } else {
      // Một người đánh, người kia không đánh -> người đánh thắng mặc định
      winnerWsId = choiceA ? pA.id : pB.id;
    }

    // Chuẩn hóa payload gửi cho client (với "DRAW" để hiển thị)
    const roundPayload = {
      player1Move: choiceA,
      player2Move: choiceB,
      winner: winnerWsId ? winnerWsId : "DRAW",
      roomId: this.roomId,
      round: this.round,
      reason,
    };

    // Gửi kết quả round cho các client
    this.broadcast({ event: "ROUND_RESULT", payload: roundPayload });

    // Lưu dữ liệu round để dùng sau (winner là ws.id khi có người thắng, hoặc null nếu hòa)
    this._roundsData.push({
      roundNumber: this.round,
      player1Id: pA.userId ?? null,
      player2Id: pB.userId ?? null,
      moveP1: choiceA,
      moveP2: choiceB,
      winner: winnerWsId ?? null,
    });

    // Nếu đã đạt số ván tối đa, dừng game ngay và gọi shutdown
    if (this.round >= this.maxRounds) {
      this.broadcast({
        event: "GAME_OVER",
        payload: { message: `Trò chơi kết thúc sau ${this.maxRounds} ván` },
      });
      // shutdown sẽ xử lý lưu match và gọi onGameEnd
      this.shutdown("max_rounds_reached");
      return;
    }

    // Lên lịch start round tiếp theo nếu game vẫn chạy
    if (!this._stopping) {
      setTimeout(() => {
        // gửi NEXT_ROUND (hoặc GAME_UPDATE) để client reset currentMove
        const playersPayload = this.players.map((ws) => ({
          id: ws.id,
          username: this._usernames.get(ws.id),
          currentMove: null,
        }));
        this.broadcast({ event: "NEXT_ROUND", payload: { players: playersPayload } });

        // bắt đầu round tiếp nếu socket còn mở
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

    // Tính điểm cuối (theo số ván thắng)
    let scoreA = 0,
      scoreB = 0;

    // Lưu ý: r.winner là ws.id khi có người thắng, hoặc null khi hòa.
    // Ta sẽ bỏ qua các round hòa (không tăng điểm).
    for (const r of this._roundsData) {
      if (!r.winner) {
        // hòa -> không tăng điểm
        continue;
      }
      if (r.winner === this.players[0].id) {
        scoreA++;
      } else if (r.winner === this.players[1].id) {
        scoreB++;
      } else {
        // winner không khớp (có thể do socket đổi) -> bỏ qua
      }
    }

    const player1Id = this.players[0].userId ?? null;
    const player2Id = this.players[1].userId ?? null;
    const winnerId = scoreA > scoreB ? player1Id : scoreB > scoreA ? player2Id : null;

    // Nếu cần, có thể gửi kết quả chung cuộc cho client:
    this.broadcast({
      event: "MATCH_RESULT",
      payload: {
        roomId: this.roomId,
        player1: { userId: player1Id, score: scoreA },
        player2: { userId: player2Id, score: scoreB },
        winnerId,
      },
    });

    // Gọi callback để MatchMaker biết game đã kết thúc và xử lý (lưu match, đóng room...)
    if (this.onGameEnd) this.onGameEnd(null);
  }
}

export default Game;
