// server/src/matchMaker.js
const { v4: uuidv4 } = require('uuid');
const Game = require('./game');

/**
 * MatchMaker:
 * - queue: array of { ws, username }
 * - rooms: map roomId -> { players: [{ws, username}], game: Game }
 */
class MatchMaker {
  constructor() {
    this.queue = [];
    this.rooms = new Map();
  }

  // client requests to join queue
  joinQueue(ws, username = 'Anonymous') {
    // Avoid duplicate joins
    if (this.isInQueueOrRoom(ws)) {
      ws.send(JSON.stringify({ event: 'INFO', payload: { message: 'Already in queue or in room' } }));
      return;
    }

    this.queue.push({ ws, username });
    ws.send(JSON.stringify({ event: 'INFO', payload: { message: 'Joined queue, waiting for opponent...' } }));
    this.tryMatch();
  }

  isInQueueOrRoom(ws) {
    if (this.queue.find(p => p.ws === ws)) return true;
    for (const [roomId, r] of this.rooms) {
      if (r.players.find(p => p.ws === ws)) return true;
    }
    return false;
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
    const game = new Game(roomId, players.map(p => p.ws), (toWs, msgObj) => {
      // send JSON to a socket
      try {
        toWs.send(JSON.stringify(msgObj));
      } catch (e) {
        // ignore
      }
    }, (playerWs) => {
      // on leave callback from game
      this.leaveSocketFromRoom(playerWs, roomId);
    });
    room.game = game;
    this.rooms.set(roomId, room);

    // Inform players
    players.forEach((p, idx) => {
      p.ws.send(JSON.stringify({
        event: 'MATCH_FOUND',
        payload: {
          roomId,
          opponent: players[1 - idx].username
        }
      }));
    });

    console.log(`[MatchMaker] Created room ${roomId} for ${players[0].username} & ${players[1].username}`);

    game.start(); // start game loop
  }

  receiveMove(ws, payload) {
    // payload: { roomId, choice }
    if (!payload || !payload.roomId || !payload.choice) {
      ws.send(JSON.stringify({ event: 'ERROR', payload: { message: 'MOVE requires roomId and choice' } }));
      return;
    }
    const room = this.rooms.get(payload.roomId);
    if (!room) {
      ws.send(JSON.stringify({ event: 'ERROR', payload: { message: 'Room not found' } }));
      return;
    }
    room.game.handlePlayerMove(ws, payload.choice);
  }

  leave(ws) {
    // find if in queue
    const qIdx = this.queue.findIndex(p => p.ws === ws);
    if (qIdx >= 0) {
      this.queue.splice(qIdx, 1);
      ws.send(JSON.stringify({ event: 'INFO', payload: { message: 'Left queue' } }));
      return;
    }
    // find if in room
    for (const [roomId, room] of this.rooms) {
      const p = room.players.find(p => p.ws === ws);
      if (p) {
        // tell game to remove and end
        room.game.playerLeave(ws, 'left');
        // leaveSocketFromRoom will be called in game callback
        return;
      }
    }
    ws.send(JSON.stringify({ event: 'INFO', payload: { message: 'Not in queue/room' } }));
  }

  handleDisconnect(ws) {
    // Called when socket closed unexpectedly
    // Remove from queue if present
    const qIdx = this.queue.findIndex(p => p.ws === ws);
    if (qIdx >= 0) {
      this.queue.splice(qIdx, 1);
    }
    // If in a room, notify game
    for (const [roomId, room] of this.rooms) {
      if (room.players.find(p => p.ws === ws)) {
        room.game.playerLeave(ws, 'disconnect');
        return;
      }
    }
  }

  leaveSocketFromRoom(ws, roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    // remove players and clean up
    room.players.forEach(p => {
      if (p.ws !== ws) {
        // notify opponent that room closed (game already should have sent)
        try {
          p.ws.send(JSON.stringify({ event: 'INFO', payload: { message: 'Opponent left, room closed' } }));
        } catch (e) {}
      }
    });
    this.rooms.delete(roomId);
    console.log(`[MatchMaker] Room ${roomId} closed`);
  }
}

module.exports = MatchMaker;
