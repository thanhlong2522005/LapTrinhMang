// Lấy DOM element một lần duy nhất để tối ưu
const tableBody = document.querySelector("#stock-table tbody");
const symbolSelect = document.querySelector("#symbol-select");

/**
 * Render bảng giá ban đầu dựa trên danh sách symbols
 * @param {Array} symbols - Mảng các object symbol (vd: [{ symbol: 'FPT', price: 100 }])
 */
export function renderInitialTable(symbols) {
  if (!tableBody || !symbolSelect) return;

  tableBody.innerHTML = ''; // Xóa nội dung cũ
  symbolSelect.innerHTML = ''; // Xóa nội dung cũ

  for (const symbol of symbols) {
    // 1. Thêm dòng vào bảng giá
    const row = document.createElement('tr');
    row.dataset.symbol = symbol.symbol; 

    const price = parseFloat(symbol.price) || 0;
    const change = parseFloat(symbol.change) || 0; // ĐỌC TÊN BIẾN 'change'
    const volume = parseInt(symbol.volume) || 0;
    
    let changeClass = 'zero';
    if (change > 0) changeClass = 'up';
    if (change < 0) changeClass = 'down';

    row.innerHTML = `
      <td class="symbol">${symbol.symbol}</td>
      <td class="price">${price.toFixed(2)}</td>
      <td class="change ${changeClass}">${change > 0 ? '+' : ''}${change.toFixed(2)}%</td>
      <td class="volume">${volume.toLocaleString()}</td> 
    `;
    tableBody.appendChild(row);

    // 2. Thêm vào menu <select> cho Thành viên 4
    const option = document.createElement('option');
    option.value = symbol.symbol;
    option.textContent = symbol.symbol;
    symbolSelect.appendChild(option);
  }
}

/**
 * Cập nhật một dòng trong bảng khi có tick mới
 * Nếu chưa có dòng cho symbol, tạo mới.
 * @param {Object} tick - Object tick (vd: { symbol, price, change, volume, timestamp })
 */
export function updateTableRow(tick) {
  if (!tableBody) return;

  let row = tableBody.querySelector(`tr[data-symbol="${tick.symbol}"]`);
  // Nếu chưa có row, tạo mới (thường xảy ra khi symbol mới xuất hiện)
  if (!row) {
    row = document.createElement('tr');
    row.dataset.symbol = tick.symbol;
    row.innerHTML = `
      <td class="symbol">${tick.symbol}</td>
      <td class="price">0.00</td>
      <td class="change zero">0.00%</td>
      <td class="volume">0</td>
    `;
    tableBody.appendChild(row);
    // thêm vào select nếu có
    if (symbolSelect) {
      const exists = Array.from(symbolSelect.options).some(o => o.value === tick.symbol);
      if (!exists) {
        const option = document.createElement('option');
        option.value = tick.symbol;
        option.textContent = tick.symbol;
        symbolSelect.appendChild(option);
      }
    }
  }

  // 2. Tìm các ô (cell) cần cập nhật
  const priceCell = row.querySelector('td.price');
  const changeCell = row.querySelector('td.change');
  const volumeCell = row.querySelector('td.volume');

  const price = parseFloat(tick.price) || 0;
  const changePercent = parseFloat(tick.change) || 0; // ĐỌC TÊN BIẾN 'change'
  const volume = parseInt(tick.volume) || 0;

  // 3. Cập nhật nội dung
  if (priceCell) priceCell.textContent = price.toFixed(2);
  if (volumeCell) volumeCell.textContent = volume.toLocaleString();
  if (changeCell) changeCell.textContent = `${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}%`;

  // 4. Cập nhật màu sắc tăng/giảm
  if (changeCell) {
    changeCell.classList.remove('up', 'down', 'zero');
    if (changePercent > 0) {
      changeCell.classList.add('up');
    } else if (changePercent < 0) {
      changeCell.classList.add('down');
    } else {
      changeCell.classList.add('zero');
    }

    // 5. === THAY ĐỔI HIỆU ỨNG FLASH ===
    changeCell.classList.remove('flash-up', 'flash-down');
    void changeCell.offsetWidth; // Trick để restart animation

    if (changePercent > 0) {
      changeCell.classList.add('flash-up');
    } else if (changePercent < 0) {
      changeCell.classList.add('flash-down');
    }
  }
}

/**
 * Highlight một dòng khi có alert hoặc sự kiện đặc biệt
 * @param {string} symbol
 */
export function highlightRow(symbol) {
  if (!tableBody) return;
  const row = tableBody.querySelector(`tr[data-symbol="${symbol}"]`);
  if (!row) return;
  const orig = row.style.backgroundColor;
  row.style.transition = 'background-color 0.9s';
  row.style.backgroundColor = 'rgba(244,63,94,0.12)';
  setTimeout(() => {
    row.style.backgroundColor = orig || '';
  }, 1200);
}

// Backwards-compatibility: expose on window for modules that expect window.ui.highlightRow
window.ui = window.ui || {};
window.ui.highlightRow = highlightRow;