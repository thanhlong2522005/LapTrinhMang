// server/dataStore.js
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'appuser',
  password: process.env.DB_PASS || 'apppass',
  database: process.env.DB_NAME || 'stockdb',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function saveTick(tick) {
  const { symbol, price, volume, change, timestamp } = tick;
  try {
    await pool.query(
      `INSERT INTO ticks (symbol, price, volume, change_percent, timestamp)
       VALUES (?, ?, ?, ?, ?)`,
      [symbol, price, volume, change, timestamp]
    );
  } catch (err) {
    console.error('❌ Error saving tick:', err);
  }
}

async function getHistory(symbol, n = 50) {
  const [rows] = await pool.query(
    `SELECT * FROM ticks WHERE symbol = ? ORDER BY timestamp DESC LIMIT ?`,
    [symbol, n]
  );
  return rows.reverse();
}

async function getCurrentPrice(symbol) {
  const [rows] = await pool.query(
    `SELECT * FROM ticks WHERE symbol = ? ORDER BY timestamp DESC LIMIT 1`,
    [symbol]
  );
  return rows[0] || null;
}

async function getAllSymbols() {
  // 1. Lấy danh sách các mã (symbol) duy nhất
  const [symbolRows] = await pool.query(
    `SELECT DISTINCT symbol FROM ticks ORDER BY symbol ASC`
  );

  // 2. Dùng Promise.all để lấy giá hiện tại cho TẤT CẢ các mã đó
  const symbolsWithPrices = await Promise.all(
    symbolRows.map(async (row) => {
      const symbol = row.symbol;
      
      // Gọi hàm getCurrentPrice (đã có sẵn) để lấy tick mới nhất
      const currentTick = await getCurrentPrice(symbol);
      
      return {
        symbol: symbol,
        // Nếu mã đó chưa có tick nào (price=null), thì mặc định là 0
        price: currentTick ? parseFloat(currentTick.price) : 0 
      };
    })
  );

  return symbolsWithPrices;
}

module.exports = {
  saveTick,
  getHistory,
  getCurrentPrice,
  getAllSymbols,
};