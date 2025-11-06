let ws = null;
let globalCallback = null;

const normalizeIncoming = (raw) => {
  // Chấp nhận nhiều kiểu cấu trúc phổ biến từ server
  const event =
    raw.event ?? raw.type ?? raw.action ?? raw.msg ?? null;

  const payload =
    raw.payload ?? raw.data ?? raw.body ?? raw.result ?? null;

  return {
    event: event ? String(event).trim().toUpperCase() : null,
    payload,
  };
};

// Khởi tạo kết nối
export const initSocket = (url) => {
  // Nếu đã có socket mở, bỏ qua
  if (ws && ws.readyState === WebSocket.OPEN) return;

  ws = new WebSocket(url);

  ws.onopen = () => {
    console.log('✅ WebSocket Connected');
  };

  ws.onclose = () => {
    console.log('❌ WebSocket Disconnected');
    // Phát DISCONNECT cho store
    if (globalCallback) globalCallback('DISCONNECT', {});
    ws = null;
  };

  ws.onerror = (error) => {
    console.error('WebSocket Error:', error);
  };
};

// Đăng ký lắng nghe sự kiện
export const subscribeToEvents = (callback) => {
  if (!ws) throw new Error('WebSocket is not initialized.');
  globalCallback = callback;

  ws.onmessage = (message) => {
    let parsed;
    try {
      parsed = JSON.parse(message.data);
    } catch (e) {
      console.error('Failed to parse message:', message.data);
      return;
    }

    const { event, payload } = normalizeIncoming(parsed);

    if (!event) {
      console.warn('Incoming message missing event field:', parsed);
      return;
    }

    // Gọi callback với event/payload đã chuẩn hoá
    callback(event, payload);
  };
};

// Gửi sự kiện lên server
export const sendEvent = (event, payload = {}) => {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.warn('Cannot send event, WebSocket is not open.', { event, payload });
    return;
  }

  const msg = {
    event: String(event).trim().toUpperCase(),
    payload,
  };

  const message = JSON.stringify(msg);
  console.log('Client → Server:', message);
  ws.send(message);
};
