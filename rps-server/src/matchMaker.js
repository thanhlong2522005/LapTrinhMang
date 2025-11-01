// server/src/matchMaker.js
import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import Game from "./game.js";

class MatchMaker {
  constructor() {
    this.queue = [];
    this.rooms = new Map();
  }

  /** 🔹 Người chơi tham gia hàng chờ */
  joinQueue(ws, username = "Anonymous") {
    if (this.isInQueueOrRoom(ws)) {
      ws.send(JSON.stringify({ event: "INFO", payload: { message: "Already in queue or in room" } }));
      return;
    }

    this.queue.push({ ws, username });
    ws.send(JSON.stringify({ event: "INFO", payload: { message: "Joined queue, waiting for opponent..." } }));
    this.tryMatch();
  }

  /** 🔹 Kiểm tra socket có trong queue/room chưa */
  isInQueueOrRoom(ws) {
    if (this.queue.find((p) => p.ws === ws)) return true;
    for (const [, r] of this.rooms) {
      if (r.players.find((p) => p.ws === ws)) return true;
    }
    return false;
  }

  /** 🔹 Ghép cặp nếu có đủ 2 người trong hàng chờ */
  tryMatch() {
    while (this.queue.length >= 2) {
      const a = this.queue.shift();
      const b = this.queue.shift();
      this.createRoom(a, b);
    }
  }

  /** 🔹 Tạo phòng mới và bắt đầu game */
  createRoom(a, b) {
    const roomId = uuidv4();
    const players = [a, b];
    const room = { roomId, players, game: null };

    // ✅ Khởi tạo game mới
    const game = new Game(
      roomId,
      players.map((p) => p.ws),
      (toWs, msgObj) => {
        try {
          toWs.send(JSON.stringify(msgObj));
        } catch (e) {
          console.error("[MatchMaker] Send error:", e.message);
        }
      },
      (playerWs) => {
        this.leaveSocketFromRoom(playerWs, roomId);
      }
    );

    room.game = game;
    this.rooms.set(roomId, room);

    // ✅ Gửi thông tin match_found cho từng người chơi
    players.forEach((p, idx) => {
      p.ws.send(
        JSON.stringify({
          event: "MATCH_FOUND",
          payload: {
            roomId,
            opponent: players[1 - idx].username,
          },
        })
      );
    });

    console.log(`[MatchMaker] Created room ${roomId} for ${players[0].username} & ${players[1].username}`);
    game.start();
  }

  /** 🔹 Nhận nước đi từ client */
  receiveMove(ws, payload) {
    if (!payload || !payload.roomId || !payload.choice) {
      ws.send(JSON.stringify({ event: "ERROR", payload: { message: "MOVE requires roomId and choice" } }));
      return;
    }
    const room = this.rooms.get(payload.roomId);
    if (!room) {
      ws.send(JSON.stringify({ event: "ERROR", payload: { message: "Room not found" } }));
      return;
    }
    room.game.handlePlayerMove(ws, payload.choice);
  }

  /** 🔹 Người chơi rời hàng chờ hoặc rời phòng */
  leave(ws) {
    const qIdx = this.queue.findIndex((p) => p.ws === ws);
    if (qIdx >= 0) {
      this.queue.splice(qIdx, 1);
      ws.send(JSON.stringify({ event: "INFO", payload: { message: "Left queue" } }));
      return;
    }

    for (const [roomId, room] of this.rooms) {
      const p = room.players.find((p) => p.ws === ws);
      if (p) {
        room.game.playerLeave(ws, "left");
        return;
      }
    }

    ws.send(JSON.stringify({ event: "INFO", payload: { message: "Not in queue/room" } }));
  }

  /** 🔹 Xử lý disconnect */
  handleDisconnect(ws) {
    const qIdx = this.queue.findIndex((p) => p.ws === ws);
    if (qIdx >= 0) {
      this.queue.splice(qIdx, 1);
    }

    for (const [roomId, room] of this.rooms) {
      if (room.players.find((p) => p.ws === ws)) {
        room.game.playerLeave(ws, "disconnect");
        return;
      }
    }
  }

  /** 🔹 Lưu match vào DB qua API */
  async saveMatch(room, winnerWs = null) {
    try {
      const p1 = room.players[0];
      const p2 = room.players[1];
      const player1Id = p1.ws.userId;
      const player2Id = p2.ws.userId;
      const winnerId = winnerWs?.userId || null;

      if (!player1Id || !player2Id) {
        console.error("[MatchMaker] ❌ Missing player IDs, cannot save match");
        return;
      }

      // ✅ Gộp dữ liệu rounds từ Game
      const rounds = (room.game?._roundsData || []).map((r, index) => ({
        roundNumber: index + 1,
        moveP1: r.choiceA,
        moveP2: r.choiceB,
        result: r.winner
          ? r.winner === p1.ws.id
            ? player1Id
            : player2Id
          : null,
      }));

      const payload = { player1Id, player2Id, winnerId, rounds };

      console.log("📦 [MatchMaker] Saving match:", payload);

      const res = await axios.post("http://localhost:3000/api/matches", payload);
      console.log(`[MatchMaker] ✅ Match ${room.roomId} saved (${res.status})`);
    } catch (err) {
      console.error(`[MatchMaker] ❌ Failed to save match ${room.roomId}:`, err.message);
    }
  }

  /** 🔹 Xóa phòng khi game kết thúc hoặc có người rời */
  async leaveSocketFromRoom(ws, roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    // ✅ Gọi lưu match trước khi xóa
    await this.saveMatch(room, room.game?.lastWinnerWs || null);

    room.players.forEach((p) => {
      if (p.ws !== ws) {
        try {
          p.ws.send(
            JSON.stringify({
              event: "INFO",
              payload: { message: "Opponent left, room closed" },
            })
          );
        } catch (e) {
          console.error("[MatchMaker] Error notifying player:", e.message);
        }
      }
    });

    this.rooms.delete(roomId);
    console.log(`[MatchMaker] Room ${roomId} closed`);
  }
}

export default MatchMaker;
