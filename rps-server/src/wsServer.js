// server/src/wsServer.js
const http = require('http');
const WebSocket = require('ws');
const MatchMaker = require('./matchMaker');

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('RPS WebSocket Server running\n');
});

const wss = new WebSocket.Server({ server });
const matchMaker = new MatchMaker();

// Map socket -> clientId (we keep it on socket for convenience)
let socketToClient = new Map();

wss.on('connection', (ws, req) => {
  ws.id = generateId();
  socketToClient.set(ws.id, ws);
  console.log(`[WS] New connection ${ws.id}`);

  // When a message arrives, we expect JSON like: { event: "JOIN"|"MOVE"|"LEAVE", payload: {...} }
  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch (e) {
      ws.send(JSON.stringify({ event: 'ERROR', payload: { message: 'Invalid JSON' } }));
      return;
    }
    handleMessage(ws, msg);
  });

  ws.on('close', () => {
    console.log(`[WS] connection closed ${ws.id}`);
    socketToClient.delete(ws.id);
    matchMaker.handleDisconnect(ws);
  });

  ws.on('error', (err) => {
    console.log(`[WS] error ${ws.id} ${err.message}`);
  });

  // welcome
  ws.send(JSON.stringify({ event: 'INFO', payload: { clientId: ws.id, msg: 'Connected to RPS server' } }));
});

function handleMessage(ws, msg) {
  const { event, payload } = msg;
  switch ((event || '').toUpperCase()) {
    case 'JOIN':
      // payload: { username }
      matchMaker.joinQueue(ws, payload && payload.username ? payload.username : `Player-${ws.id}`);
      break;
    case 'MOVE':
      // payload: { roomId, choice }  choice in ['rock','paper','scissors']
      matchMaker.receiveMove(ws, payload);
      break;
    case 'LEAVE':
      matchMaker.leave(ws);
      break;
    default:
      ws.send(JSON.stringify({ event: 'ERROR', payload: { message: 'Unknown event' } }));
  }
}

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
