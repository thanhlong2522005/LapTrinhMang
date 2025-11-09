import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import Game from "./game.js";

class MatchMaker {
  constructor() {
    this.queue = []; // { ws, username }
    this.rooms = new Map(); // roomId -> { roomId, players: [{ ws, username }], game }
  }

  isInQueueOrRoom(ws) {
    if (this.queue.find((p) => p.ws === ws)) return true;
    for (const [, r] of this.rooms) {
      if (r.players.find((p) => p.ws === ws)) return true;
    }
    return false;
  }

  joinQueue(ws, username = "Anonymous") {
    if (this.isInQueueOrRoom(ws)) {
      ws.send(
        JSON.stringify({
          event: "ERROR",
          payload: { message: "Already in queue or in room" },
        })
      );
      return;
    }

    this.queue.push({ ws, username });
    
    // ✅ GỬI TRẠNG THÁI CHỜ ĐỐI THỦ
    ws.send(
      JSON.stringify({
        event: "WAITING_FOR_OPPONENT",
        payload: { 
          message: "Đang chờ đối thủ tham gia...",
          playersJoined: 1,
          playersNeeded: 2
        },
      })
    );
    
    this.tryMatch();
  }

  tryMatch() {
    while (this.queue.length >= 2) {
      const a = this.queue.shift();
      const b = this.queue.shift();
      this.createRoom(a, b);
    }
  }

  createRoom(a, b) {
    const roomId = uuidv4();
    const players = [a, b];
    const room = { roomId, players, game: null };
    this.rooms.set(roomId, room);

    players.forEach((p) => {
      p.ws.roomId = roomId;
      if (!p.ws.username) p.ws.username = p.username;
    });

    // ✅ TẠO GAME VỚI MẢNG RỖNG, SAU ĐÓ DÙNG addPlayer
    const game = new Game(
      roomId,
      [], // ✅ Bắt đầu với mảng rỗng
      (toWs, msgObj) => {
        try {
          toWs.send(JSON.stringify(msgObj));
        } catch (e) {
          console.error("[MatchMaker] Send error:", e.message);
        }
      },
      async (playerWs) => {
        await this.leaveSocketFromRoom(playerWs, roomId);
      }
    );

    room.game = game;

    // ✅ THÊM 2 NGƯỜI CHƠI VÀO GAME
    players.forEach((p) => {
      game.addPlayer(p.ws);
    });

    const playersPayload = players.map((p) => ({
      id: p.ws.id,
      username: p.username || p.ws.username || `Player-${p.ws.id}`,
      currentMove: null,
      score: 0, // ✅ Thêm score ban đầu
    }));

    // ✅ THÔNG BÁO TÌM THẤY ĐỐI THỦ
    players.forEach((p) => {
      try {
        p.ws.send(
          JSON.stringify({
            event: "MATCH_FOUND",
            payload: { roomId, players: playersPayload },
          })
        );
      } catch (e) {
        console.error("[MatchMaker] Error sending MATCH_FOUND:", e.message);
      }
    });

    console.log(
      `[MatchMaker] Created room ${roomId} for ${players[0].username} & ${players[1].username}`
    );

    // ✅ GAME SẼ TỰ START KHI ĐỦ 2 NGƯỜI (trong game.addPlayer)
    // Không cần gọi game.start() ở đây nữa
  }

  receiveMove(ws, payload) {
    if (!payload || !payload.roomId || !payload.choice) {
      ws.send(
        JSON.stringify({
          event: "ERROR",
          payload: { message: "MOVE requires roomId and choice" },
        })
      );
      return;
    }
    const room = this.rooms.get(payload.roomId);
    if (!room) {
      ws.send(
        JSON.stringify({
          event: "ERROR",
          payload: { message: "Room not found" },
        })
      );
      return;
    }

    try {
      room.game.handlePlayerMove(ws, payload.choice);
    } catch (e) {
      console.error("[MatchMaker] receiveMove error:", e.message);
      ws.send(
        JSON.stringify({
          event: "ERROR",
          payload: { message: "Failed to handle move" },
        })
      );
    }
  }

  leave(ws) {
    const qIdx = this.queue.findIndex((p) => p.ws === ws);
    if (qIdx >= 0) {
      this.queue.splice(qIdx, 1);
      ws.send(
        JSON.stringify({ event: "INFO", payload: { message: "Left queue" } })
      );
      return;
    }

    for (const [roomId, room] of this.rooms) {
      const p = room.players.find((p) => p.ws === ws);
      if (p) {
        try {
          room.game.removePlayer(ws); // ✅ SỬ DỤNG removePlayer
        } catch (e) {
          console.error("[MatchMaker] leave error:", e.message);
          this.leaveSocketFromRoom(ws, roomId);
        }
        return;
      }
    }

    ws.send(
      JSON.stringify({
        event: "INFO",
        payload: { message: "Not in queue/room" },
      })
    );
  }

  handleDisconnect(ws) {
    const qIdx = this.queue.findIndex((p) => p.ws === ws);
    if (qIdx >= 0) {
      this.queue.splice(qIdx, 1);
    }

    for (const [roomId, room] of this.rooms) {
      if (room.players.find((p) => p.ws === ws)) {
        try {
          room.game.removePlayer(ws); // ✅ SỬ DỤNG removePlayer
        } catch (e) {
          console.error("[MatchMaker] handleDisconnect error:", e.message);
          this.leaveSocketFromRoom(ws, roomId);
        }
        return;
      }
    }
  }

  async saveMatch(room, winnerWs = null) {
    try {
      const p1 = room.players[0];
      const p2 = room.players[1];
      const player1Id = p1.ws.userId;
      const player2Id = p2.ws.userId;
      
      // ✅ TÌM NGƯỜI THẮNG DỰA VÀO ĐIỂM SỐ
      const score1 = room.game.scores.get(p1.ws.id) || 0;
      const score2 = room.game.scores.get(p2.ws.id) || 0;
      const winnerId = score1 > score2 ? player1Id : score2 > score1 ? player2Id : null;

      if (!player1Id || !player2Id) {
        console.error("[MatchMaker] ❌ Missing player IDs, cannot save match");
        return;
      }

      const roundsRaw = room.game?._roundsData || [];
      const rounds = roundsRaw.map((r) => {
        const player1Choice = r.moveP1 ?? null;
        const player2Choice = r.moveP2 ?? null;
        const winnerIdMapped = r.winner 
          ? (r.winner === p1.ws.id ? player1Id : r.winner === p2.ws.id ? player2Id : null)
          : null;

        return {
          roundNumber: r.roundNumber,
          player1Choice,
          player2Choice,
          winnerId: winnerIdMapped,
        };
      });

      const payload = { player1Id, player2Id, winnerId, rounds };
      console.log("📦 [MatchMaker] Saving match:", payload);

      const res = await axios.post("http://localhost:3000/api/matches", payload);
      console.log(`[MatchMaker] ✅ Match ${room.roomId} saved (${res.status})`);
    } catch (err) {
      console.error(
        `[MatchMaker] ❌ Failed to save match ${room?.roomId || ""}:`,
        err.message
      );
    }
  }

  async leaveSocketFromRoom(ws, roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    await this.saveMatch(room);

    room.players.forEach((p) => {
      if (p.ws !== ws) {
        try {
          p.ws.send(
            JSON.stringify({
              event: "OPPONENT_LEFT",
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