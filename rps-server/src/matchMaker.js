// server/src/matchMaker.js
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
    ws.send(
      JSON.stringify({
        event: "INFO",
        payload: { message: "Joined queue, waiting for opponent..." },
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
    const players = [a, b]; // each is { ws, username }
    const room = { roomId, players, game: null };
    this.rooms.set(roomId, room);

    // Ensure ws have roomId set and identity fields
    players.forEach((p) => {
      p.ws.roomId = roomId;
      // use existing ws.id (generated in wsServer) as clientId
      if (!p.ws.username) p.ws.username = p.username;
    });

    // Init Game instance, give it a sender callback and leave callback
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
      async (playerWs) => {
        // called by Game when room should be closed
        await this.leaveSocketFromRoom(playerWs, roomId);
      }
    );

    room.game = game;

    // Prepare players payload expected by client: id, username, currentMove
    const playersPayload = players.map((p) => ({
      id: p.ws.id,
      username: p.username || p.ws.username || `Player-${p.ws.id}`,
      currentMove: null,
    }));

    // Notify both players MATCH_FOUND (include full players array so client can render)
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

    // Also send GAME_UPDATE to initialize client-side players state (same payload)
    players.forEach((p) => {
      try {
        p.ws.send(
          JSON.stringify({
            event: "GAME_UPDATE",
            payload: { players: playersPayload },
          })
        );
      } catch (e) {
        console.error("[MatchMaker] Error sending GAME_UPDATE:", e.message);
      }
    });

    console.log(
      `[MatchMaker] Created room ${roomId} for ${players[0].username} & ${players[1].username}`
    );

    // Start game logic (Game class should call provided callbacks to send ROUND_RESULT, NEXT_ROUND, GAME_OVER etc.)
    game.start();
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

    // Delegate to Game instance which is responsible for judging and emitting results
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
    // remove from queue if present
    const qIdx = this.queue.findIndex((p) => p.ws === ws);
    if (qIdx >= 0) {
      this.queue.splice(qIdx, 1);
      ws.send(
        JSON.stringify({ event: "INFO", payload: { message: "Left queue" } })
      );
      return;
    }

    // find room and tell game
    for (const [roomId, room] of this.rooms) {
      const p = room.players.find((p) => p.ws === ws);
      if (p) {
        // ask game to handle player leaving (it should call the provided leave callback eventually)
        try {
          room.game.playerLeave(ws, "left");
        } catch (e) {
          console.error("[MatchMaker] leave error:", e.message);
          // fallback: close room immediately
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
    // remove from queue if was waiting
    const qIdx = this.queue.findIndex((p) => p.ws === ws);
    if (qIdx >= 0) {
      this.queue.splice(qIdx, 1);
    }

    // if in a room, notify game
    for (const [roomId, room] of this.rooms) {
      if (room.players.find((p) => p.ws === ws)) {
        try {
          room.game.playerLeave(ws, "disconnect");
        } catch (e) {
          console.error("[MatchMaker] handleDisconnect error:", e.message);
          // ensure room cleanup
          this.leaveSocketFromRoom(ws, roomId);
        }
        return;
      }
    }
  }

  // Gather rounds data from Game and persist via API, then close room and notify other player
  async saveMatch(room, winnerWs = null) {
    try {
      const p1 = room.players[0];
      const p2 = room.players[1];
      const player1Id = p1.ws.userId;
      const player2Id = p2.ws.userId;
      const winnerId = winnerWs?.userId || null;

      if (!player1Id || !player2Id) {
        console.error(
          "[MatchMaker] ❌ Missing player IDs, cannot save match"
        );
        return;
      }

      // room.game should provide rounds data in a predictable shape
      const roundsRaw = room.game?._roundsData || [];
      const rounds = roundsRaw.map((r, index) => {
        // expect r to contain choiceA, choiceB and winner (ws.id or null)
        const player1Choice = r.choiceA ?? r.moveP1 ?? r.player1Choice ?? null;
        const player2Choice = r.choiceB ?? r.moveP2 ?? r.player2Choice ?? null;
        const winnerWsId = r.winner ?? null;
        const winnerIdMapped = winnerWsId
          ? winnerWsId === p1.ws.id
            ? player1Id
            : player2Id
          : null;

        return {
          roundNumber: index + 1,
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

  // Close room and notify remaining player
  async leaveSocketFromRoom(ws, roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    // Save match (if game ended or partially)
    await this.saveMatch(room, room.game?.lastWinnerWs || null);

    // Notify other player (if any)
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
