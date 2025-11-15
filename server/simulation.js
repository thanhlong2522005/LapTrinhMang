const EventEmitter = require('events');
const { randomNormal, randomBetween } = require('./utils/random');
const dataStore = require('./dataStore');

class StockSimulation extends EventEmitter {
  constructor() {
    super();
    this.symbols = ['VND', 'FPT', 'VIC', 'MWG', 'HPG']; // Danh sách mã
    this.prices = {};      // Lưu giá hiện tại
    this.interval = null;
    this.isRunning = false;

    // Khởi tạo giá ban đầu
    this.symbols.forEach(sym => {
      this.prices[sym] = 100 + randomBetween(-20, 20);
    });
  }

  generateTick(symbol) {
    const prevPrice = this.prices[symbol];
    let newPrice = prevPrice;

    // Random walk: ±0.5% ~ ±2%
    const step = randomNormal(0, 0.008); // ~0.8% std dev
    newPrice *= (1 + step);

    // Spike bất thường: 3% xác suất
    if (Math.random() < 0.03) {
      const spike = randomNormal(0, 0.08); // ±8%
      newPrice *= (1 + spike);
      console.log(`SPIKE! ${symbol}: ${spike > 0 ? '+' : ''}${(spike*100).toFixed(2)}%`);
    }

    // Giới hạn giá: 50 → 200
    newPrice = Math.max(50, Math.min(200, newPrice));
    newPrice = parseFloat(newPrice.toFixed(2));

    const change = ((newPrice - prevPrice) / prevPrice) * 100;
    const volume = Math.floor(randomBetween(500, 5000));

    this.prices[symbol] = newPrice;

    return {
      symbol,
      price: newPrice,
      volume,
      change: parseFloat(change.toFixed(2)),
      timestamp: Date.now()
    };
  }

  startSimulation() {
    if (this.isRunning) return;
    this.isRunning = true;

    this.interval = setInterval(async () => {
      // Chọn ngẫu nhiên 1 mã để phát tick
      const symbol = this.symbols[Math.floor(Math.random() * this.symbols.length)];
      const tick = this.generateTick(symbol);

      // Lưu vào DB
      try {
        //await dataStore.saveTick(tick);
      } catch (err) {
        console.error('Lỗi lưu tick:', err.message);
      }

      // Phát sự kiện
      this.emit('tick', tick);
    }, 1000); // 1 tick/giây
  }

  stopSimulation() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      this.isRunning = false;
    }
  }
}

// Export instance (singleton)
const simulation = new StockSimulation();
module.exports = simulation;