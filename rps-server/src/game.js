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
<<<<<<< HEAD
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
=======
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
>>>>>>> ed2af8dc94a8be55dadaf2f3ef91e13af27c6e0b

    // Số ván tối đa trước khi game tự dừng (mặc định 5)
    this.maxRounds = 5;

    // Khởi tạo username cho mỗi socket
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

<<<<<<< HEAD
=======
  // Gửi message tới tất cả socket vẫn mở
>>>>>>> ed2af8dc94a8be55dadaf2f3ef91e13af27c6e0b
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

<<<<<<< HEAD
=======
    // Thông báo bắt đầu round, gửi thông tin player (reset currentMove)
>>>>>>> ed2af8dc94a8be55dadaf2f3ef91e13af27c6e0b
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

<<<<<<< HEAD
    this._broadcastPlayersUpdate();
=======
    // Gửi GAME_UPDATE để client reset UI nếu cần
    this.broadcast({
      event: "GAME_UPDATE",
      payload: { players: playersPayload },
    });
>>>>>>> ed2af8dc94a8be55dadaf2f3ef91e13af27c6e0b

    if (this._roundTimer) clearTimeout(this._roundTimer);
    this._roundTimer = setTimeout(() => this.endRound("timeout"), this.roundTimeout);
  }

<<<<<<< HEAD
=======
  // Chuẩn hóa lựa chọn (uppercase)
>>>>>>> ed2af8dc94a8be55dadaf2f3ef91e13af27c6e0b
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
<<<<<<< HEAD
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
=======
      res = judge(choiceA, choiceB);
      if (res === 1) winnerWsId = pA.id;
      else if (res === -1) winnerWsId = pB.id;
      else winnerWsId = null; // hòa
    } else if (!choiceA && !choiceB) {
      winnerWsId = null; // cả hai không đánh -> không có winner
    } else {
      // Một người đánh, người kia không đánh -> người đánh thắng mặc định
>>>>>>> ed2af8dc94a8be55dadaf2f3ef91e13af27c6e0b
      winnerWsId = choiceA ? pA.id : pB.id;
      resLabel = choiceA ? "A_WIN" : "B_WIN";
      this.scores.set(winnerWsId, (this.scores.get(winnerWsId) || 0) + 1);
    }

<<<<<<< HEAD
    const payload = {
=======
    // Chuẩn hóa payload gửi cho client (với "DRAW" để hiển thị)
    const roundPayload = {
      player1Move: choiceA,
      player2Move: choiceB,
      winner: winnerWsId ? winnerWsId : "DRAW",
>>>>>>> ed2af8dc94a8be55dadaf2f3ef91e13af27c6e0b
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

<<<<<<< HEAD
    this.broadcast({ event: "ROUND_RESULT", payload });

=======
    // Gửi kết quả round cho các client
    this.broadcast({ event: "ROUND_RESULT", payload: roundPayload });

    // Lưu dữ liệu round để dùng sau (winner là ws.id khi có người thắng, hoặc null nếu hòa)
>>>>>>> ed2af8dc94a8be55dadaf2f3ef91e13af27c6e0b
    this._roundsData.push({
      roundNumber: this.round,
      player1Id: pA.userId ?? null,
      player2Id: pB.userId ?? null,
      moveP1: choiceA,
      moveP2: choiceB,
      winner: winnerWsId && winnerWsId !== "DRAW" && winnerWsId !== "NONE" ? winnerWsId : null,
    });

<<<<<<< HEAD
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

=======
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
>>>>>>> ed2af8dc94a8be55dadaf2f3ef91e13af27c6e0b
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

<<<<<<< HEAD
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

=======
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
>>>>>>> ed2af8dc94a8be55dadaf2f3ef91e13af27c6e0b
    if (this.onGameEnd) this.onGameEnd(null);
  }
}

export default Game;