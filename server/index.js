const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

// Import các route và module giả lập
const symbolsRoute = require('./routes/symbols');
const historyRoute = require('./routes/history');
const simulation = require('./simulation');   // thành viên 2
const dataStore = require('./dataStore');     // thành viên 2

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors());
app.use(express.json());

// REST API routes
app.use('/api/symbols', symbolsRoute);
app.use('/api/history', historyRoute);

// Quản lý kết nối WebSocket
const clients = new Set();

wss.on('connection', (ws) => {
  console.log('Client connected');
  clients.add(ws);

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);
      if (data.type === 'subscribe') ws.symbol = data.symbol;
      if (data.type === 'unsubscribe') ws.symbol = null;
    } catch (err) {
      console.error('Invalid WS message', err);
    }
  });

  ws.on('close', () => clients.delete(ws));
});

// Nhận dữ liệu tick từ module simulation và gửi realtime
simulation.on('tick', (tick) => {
  // In ra console để kiểm tra hoạt động
  console.log('📈 Tick:', tick);

  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) { 
      ws.send(JSON.stringify(tick));
    }
  }
});

simulation.startSimulation();

const PORT = 3000;
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));