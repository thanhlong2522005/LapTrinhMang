// server/test_member2.js
require('dotenv').config();
const simulation = require('./simulation');
const dataStore = require('./dataStore');

console.log('Bắt đầu kiểm tra module thành viên 2...\n');

// === CẤU HÌNH ===
const TEST_SYMBOL = 'VND';
let tickCount = 0;
let receivedTicks = [];

// === KHỞI ĐỘNG SIMULATION ===
console.log('Khởi động mô phỏng dữ liệu...');
simulation.startSimulation();

simulation.on('tick', async (tick) => {
  tickCount++;
  receivedTicks.push(tick);

  const sign = tick.change > 0 ? '+' : '';
  console.log(`Tick #${tickCount}: ${tick.symbol} = ${tick.price} (${sign}${tick.change}%)`);

  if (tickCount >= 6) {
    console.log('\nĐã nhận đủ 6 tick. Dừng mô phỏng...\n');
    simulation.stopSimulation();
    await testDataStore();
    process.exit(0);
  }
});

async function testDataStore() {
  console.log('Bắt đầu kiểm tra dataStore.js...\n');
  await new Promise(r => setTimeout(r, 1500));

  // Test 1: getAllSymbols
  console.log('Test 1: getAllSymbols()');
  try {
    const symbols = await dataStore.getAllSymbols();
    console.log(`Tìm thấy ${symbols.length} mã:`, symbols.map(s => s.symbol).join(', '));
  } catch (e) { console.error('Lỗi:', e.message); }

  // Test 2: getCurrentPrice
  console.log(`\nTest 2: getCurrentPrice('${TEST_SYMBOL}')`);
  try {
    const cur = await dataStore.getCurrentPrice(TEST_SYMBOL);
    if (cur) {
      console.log(`Giá hiện tại: ${cur.price} (vol: ${cur.volume})`);
    } else {
      console.log('Không có dữ liệu');
    }
  } catch (e) { console.error('Lỗi:', e.message); }

  // Test 3: getHistory
  console.log(`\nTest 3: getHistory('${TEST_SYMBOL}', 5)`);
  try {
    const hist = await dataStore.getHistory(TEST_SYMBOL, 5);
    if (hist.length > 0) {
      console.log('Lịch sử 5 điểm:');
      hist.forEach((h, i) => {
        const t = new Date(Number(h.timestamp)).toLocaleTimeString();
        const change = Number(h.change_percent); // ← CHUYỂN SANG NUMBER
        console.log(`  [${i+1}] ${t} → ${h.price} (${change > 0 ? '+' : ''}${change.toFixed(2)}%)`);
      });
    } else {
      console.log('Không có lịch sử');
    }
  } catch (e) { console.error('Lỗi:', e.message); }

  // Test 4: Kiểm tra biến động
  console.log('\nTest 4: Kiểm tra biến động giá');
  const prices = receivedTicks.filter(t => t.symbol === TEST_SYMBOL).map(t => t.price);
  if (prices.length >= 2) {
    const changes = prices.slice(1).map((p, i) => ((p - prices[i]) / prices[i] * 100).toFixed(2));
    console.log(`Biến động (%): ${changes.join(' → ')}`);
    const hasSpike = changes.some(c => Math.abs(c) > 8);
    console.log(`Có spike (>8%)?: ${hasSpike ? 'CÓ' : 'KHÔNG'}`);
  }

  console.log('\nKIỂM TRA HOÀN TẤT!');
}

process.on('unhandledRejection', (err) => {
  console.error('\nLỗi MySQL:', err.message);
  process.exit(1);
});