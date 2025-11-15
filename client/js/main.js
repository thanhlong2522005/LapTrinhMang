// Import các hàm từ ui.js (ui.js phải export các hàm này)
import { renderInitialTable, updateTableRow } from './ui.js';

// === CẤU HÌNH ===
const API_URL = 'http://127.0.0.1:3000/api'; // <-- SỬA NẾU API KHÁC
const WS_URL = 'ws://127.0.0.1:3000';

/**
 * Hàm khởi tạo chính
 */
async function main() {
  try {
    // 1. Lấy danh sách mã và giá hiện tại từ API
    const symbols = await fetchInitialData();

    // 2. Render bảng giá ban đầu
    renderInitialTable(symbols);

    // 3. Khởi tạo Chart module (nếu có)
    if (window.chartModule && typeof window.chartModule.init === 'function') {
      window.chartModule.init('chart-canvas');

      // Pre-populate chart store and create tabs/options
      symbols.forEach(s => {
        const sym = s.symbol ?? s;
        const price = (typeof s.price === 'number') ? s.price : 0;
        const ts = s.timestamp ?? Date.now();
        window.chartModule.update(sym, price, ts);
      });

      // chọn symbol mặc định (first)
      const firstSymbol = (symbols && symbols.length) ? (symbols[0].symbol ?? symbols[0]) : null;
      if (firstSymbol) window.chartModule.select(firstSymbol);
    }

    // 4. Populate table rows (ensure UI has initial rows)
    symbols.forEach(s => {
      const tick = {
        symbol: s.symbol ?? s,
        price: s.price ?? 0,
        volume: s.volume ?? 0,
        change: s.change ?? 0,
        timestamp: s.timestamp ?? Date.now()
      };
      updateTableRow(tick);
    });

    // 5. Gắn event cho control alert / select
    bindControls();

    // 6. Lắng nghe alert từ chartModule
    window.addEventListener('priceAlert', (e) => {
      const { symbol, price, threshold } = e.detail ?? {};
      console.warn('ALERT event:', symbol, price, threshold);
      if (window.ui && typeof window.ui.highlightRow === 'function') {
        window.ui.highlightRow(symbol);
      }
      // Bạn có thể hiển thị toast hoặc modal ở đây
    });

    // 7. Kết nối WebSocket để nhận dữ liệu realtime
    connectWebSocket();

  } catch (error) {
    console.error("Lỗi khởi tạo:", error);
    alert("Không thể tải dữ liệu ban đầu. Vui lòng kiểm tra server backend.");
  }
}

/**
 * Lấy danh sách symbols ban đầu từ API
 */
async function fetchInitialData() {
  try {
    const response = await fetch(`${API_URL}/symbols`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn('Fetch symbols failed, using fallback', error);
    return [
      { symbol: 'FPT', price: 100.00 },
      { symbol: 'VND', price: 50.00 },
      { symbol: 'VIC', price: 120.00 },
    ];
  }
}

/**
 * Gắn handlers cho alert controls và symbol-select
 */
function bindControls() {
  const setBtn = document.getElementById('set-alert');
  const clearBtn = document.getElementById('clear-alert');
  const thrInput = document.getElementById('alert-threshold');
  const sel = document.getElementById('symbol-select');

  if (setBtn) {
    setBtn.addEventListener('click', () => {
      const v = thrInput ? thrInput.value : '';
      const sym = (sel && sel.value) ? sel.value : getCurrentChartSymbol();
      if (!sym) return alert('Chưa chọn mã để đặt alert');
      if (window.chartModule && typeof window.chartModule.setAlert === 'function') {
        window.chartModule.setAlert(sym, v);
        console.log('Alert set', sym, v);
      }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      const sym = (sel && sel.value) ? sel.value : getCurrentChartSymbol();
      if (!sym) return;
      if (window.chartModule && typeof window.chartModule.clearAlert === 'function') {
        window.chartModule.clearAlert(sym);
        if (thrInput) thrInput.value = '';
        console.log('Alert cleared', sym);
      }
    });
  }

  if (sel) {
    sel.addEventListener('change', () => {
      const sym = sel.value;
      if (window.chartModule && typeof window.chartModule.select === 'function') {
        window.chartModule.select(sym);
      }
    });
  }
}

/**
 * Lấy symbol hiện đang chọn trên biểu đồ (nếu có)
 */
function getCurrentChartSymbol() {
  // chartModule giữ current selection internally; try to read from tabs/select DOM
  const activeBtn = document.querySelector('#symbol-tabs .symbol-tab[style*="font-weight: 700"], #symbol-tabs .symbol-tab[aria-pressed="true"]');
  if (activeBtn) return activeBtn.dataset.symbol;
  const sel = document.getElementById('symbol-select');
  if (sel && sel.value) return sel.value;
  // fallback: first option
  if (sel && sel.options && sel.options.length) return sel.options[0].value;
  return null;
}

/**
 * Khởi tạo kết nối WebSocket
 */
function connectWebSocket() {
  console.log("Đang kết nối tới WebSocket...", WS_URL);
  const ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    console.log("✅ Kết nối WebSocket thành công!");
    // nếu cần subscribe có thể gửi tại đây
  };

  ws.onmessage = (event) => {
    try {
      const tick = JSON.parse(event.data);
      // debug
      console.log('WS tick received:', tick);

      // cập nhật bảng
      updateTableRow(tick);

      // cập nhật biểu đồ (nếu module có)
      if (window.chartModule && typeof window.chartModule.update === 'function') {
        window.chartModule.update(tick.symbol, tick.price, tick.timestamp);
      }

      // phát event chung để các module khác lắng nghe nếu muốn
      document.dispatchEvent(new CustomEvent('stockTick', { detail: tick }));

    } catch (error) {
      console.error("Lỗi xử lý message:", error, event.data);
    }
  };

  ws.onclose = (event) => {
    console.warn("Kết nối WebSocket bị đóng. Thử kết nối lại sau 3s...", event.reason);
    setTimeout(connectWebSocket, 3000);
  };

  ws.onerror = (error) => {
    console.error("Lỗi WebSocket:", error);
    try { ws.close(); } catch (e) {}
  };
}

// Chạy khi DOM sẵn sàng
document.addEventListener('DOMContentLoaded', main);