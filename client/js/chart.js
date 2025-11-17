// ...existing code...
(function () {
  const MAX_POINTS = 300;
  const store = {}; // store[symbol] = {points: [{x:ts,y:price}], open, high, low, current, alert}
  let currentSymbol = null;
  let chart = null;
  let ctx = null;

  const nf = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function formatPrice(v) {
    if (v === null || v === undefined || isNaN(v)) return '-';
    return nf.format(v) + ' VND';
  }

  function init(canvasId = 'chart-canvas') {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    ctx = canvas.getContext('2d');

    // destroy existing chart to avoid duplicated instances
    if (chart) {
      try { chart.destroy(); } catch (e) { /* ignore */ }
      chart = null;
    }

    const cfg = {
      type: 'line',
      data: {
        datasets: [{
          label: 'Giá',
          data: [],
          borderColor: '#60a5fa',
          backgroundColor: 'rgba(96,165,250,0.08)',
          pointRadius: 3,
          pointHoverRadius: 6,
          tension: 0.18,
          borderWidth: 2
        }]
      },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        parsing: false,
        scales: {
          x: {
            type: 'time',
            time: {
              tooltipFormat: 'HH:mm:ss',
              displayFormats: { second: 'HH:mm:ss', minute: 'HH:mm', hour: 'HH:mm' }
            },
            ticks: {
              color: '#cbd5e1',
              maxRotation: 45,
              minRotation: 30,
              autoSkip: true,
              maxTicksLimit: 12
            },
            title: {
              display: true,
              text: 'Thời gian (HH:mm:ss)',
              color: '#9aa0a6',
              font: { size: 12, weight: '600' }
            },
            grid: { color: 'rgba(255,255,255,0.02)' }
          },
          y: {
            beginAtZero: false,
            ticks: {
              color: '#cbd5e1',
              callback: function(value) { return formatPrice(Number(value)); }
            },
            title: {
              display: true,
              text: 'Giá (VND)',
              color: '#9aa0a6',
              font: { size: 12, weight: '600' }
            },
            grid: { color: 'rgba(255,255,255,0.02)' }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: 'nearest',
            intersect: false,
            callbacks: {
              title: function(items) {
                const t = items && items[0] && items[0].parsed && items[0].parsed.x;
                return t ? new Date(t).toLocaleTimeString() : '';
              },
              label: function(context) {
                const y = context.parsed.y;
                return `Giá: ${formatPrice(Number(y))}`;
              }
            }
          }
        },
        interaction: {
          mode: 'nearest',
          axis: 'x',
          intersect: false
        }
      }
    };

    chart = new Chart(ctx, cfg);
  }

  function ensureSymbol(symbol) {
    if (!store[symbol]) {
      store[symbol] = { points: [], open: null, high: null, low: null, current: null, alert: null };
      const tabs = document.getElementById('symbol-tabs');
      if (tabs) {
        const btn = document.createElement('button');
        btn.textContent = symbol;
        btn.className = 'symbol-tab';
        btn.dataset.symbol = symbol;
        btn.setAttribute('aria-pressed', 'false');
        btn.onclick = () => select(symbol);
        tabs.appendChild(btn);
        // also add to select dropdown if exists
        // const sel = document.getElementById('symbol-select');
        // if (sel) {
        //   const opt = document.createElement('option');
        //   opt.value = symbol;
        //   opt.textContent = symbol;
        //   sel.appendChild(opt);
        // }
      }
    }
  }

  function update(symbol, price, timestamp = Date.now()) {
    ensureSymbol(symbol);
    const s = store[symbol];
    const t = typeof timestamp === 'number' ? timestamp : Date.parse(timestamp) || Date.now();
    if (s.open === null) s.open = price;
    s.current = price;
    s.high = s.high === null ? price : Math.max(s.high, price);
    s.low = s.low === null ? price : Math.min(s.low, price);

    s.points.push({ x: t, y: price });
    if (s.points.length > MAX_POINTS) s.points.shift();

    if (symbol === currentSymbol && chart) {
      chart.data.datasets[0].data = s.points.slice();
      chart.update('none');
      updateOHLCUI(s);
    }

    if (s.alert !== null) {
      const prev = s.points.length >= 2 ? s.points[s.points.length - 2].y : null;
      const thr = s.alert;
      if (prev !== null) {
        if ((prev < thr && price >= thr) || (prev > thr && price <= thr)) {
          const ev = new CustomEvent('priceAlert', { detail: { symbol, price, threshold: thr } });
          window.dispatchEvent(ev);
          flashChart();
        }
      }
    }
  }

  function flashChart() {
    if (!chart) return;
    const canvas = chart.canvas;
    const orig = canvas.style.boxShadow;
    canvas.style.boxShadow = '0 0 20px rgba(79,195,247,0.9)';
    setTimeout(() => canvas.style.boxShadow = orig || '', 700);
  }

  function select(symbol) {
    ensureSymbol(symbol);
    currentSymbol = symbol;
    const s = store[symbol];
    if (!chart) return;
    chart.data.datasets[0].data = s.points.slice();
    chart.update();
    updateOHLCUI(s);

    document.querySelectorAll('#symbol-tabs .symbol-tab').forEach(b => {
      const isActive = (b.dataset.symbol === symbol);
      b.classList.toggle('active', isActive);
      b.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    // sync select dropdown
    const sel = document.getElementById('symbol-select');
    if (sel) sel.value = symbol;
  }

  function updateOHLCUI(s) {
    const elOpen = document.getElementById('ohlc-open');
    const elHigh = document.getElementById('ohlc-high');
    const elLow = document.getElementById('ohlc-low');
    const elCur = document.getElementById('ohlc-current');
    if (elOpen) elOpen.textContent = s.open !== null ? nf.format(s.open) : '-';
    if (elHigh) elHigh.textContent = s.high !== null ? nf.format(s.high) : '-';
    if (elLow) elLow.textContent = s.low !== null ? nf.format(s.low) : '-';
    if (elCur) elCur.textContent = s.current !== null ? nf.format(s.current) : '-';
  }

  function setAlert(symbol, threshold) {
    ensureSymbol(symbol);
    store[symbol].alert = (threshold === null || threshold === '') ? null : Number(threshold);
  }

  function clearAlert(symbol) {
    if (store[symbol]) store[symbol].alert = null;
  }

  // expose API
  window.chartModule = {
    init,
    update,
    select,
    setAlert,
    clearAlert,
    _store: store
  };
})();