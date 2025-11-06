import { create } from 'zustand';
import { initSocket, subscribeToEvents, sendEvent } from '../services/ws.js';

// State ban đầu (dùng để reset nhanh)
const initialState = {
  clientId: null,
  username: '',
  roomId: null,
  isConnected: false,
  players: [],
  roundResult: null,
  gameResult: null, // 'WIN' | 'LOSE' | null
  error: null,
  playerScore: 0,
  computerScore: 0,
};

export const useGameStore = create((set, get) => ({
  // === STATE ===
  ...initialState,

  // === ACTIONS ===

  // Kết nối tới server và đăng ký listener
  connect: (username) => {
    // Tránh connect lặp lại
    if (get().isConnected) return;

    set({ username: String(username || '').trim(), error: null });

    // Khởi tạo socket
    initSocket('ws://localhost:3000');

    // Đăng ký nhận sự kiện từ server
    subscribeToEvents((event, payload) => {
      console.log('Server → Client:', event, payload);

      switch (event) {
        case 'INFO': {
          // Nhận thông tin clientId lần đầu, đánh dấu đã connected và tự JOIN
          const incomingClientId = payload?.clientId;
          if (incomingClientId && !get().clientId) {
            set({ clientId: incomingClientId, isConnected: true, error: null });
            const name = get().username || 'Player';
            sendEvent('JOIN', { username: name });
          }
          break;
        }

        case 'MATCH_FOUND': {
          // Bắt đầu trận: gán room và players
          const roomId = payload?.roomId || null;
          const players = Array.isArray(payload?.players) ? payload.players : [];
          set({
            roomId,
            players,
            roundResult: null,
            error: null,
          });
          break;
        }

        case 'GAME_UPDATE': {
          // Cập nhật danh sách người chơi từ server (ví dụ reset vòng)
          const players = Array.isArray(payload?.players) ? payload.players : [];
          set({
            players,
            roundResult: null, // bắt đầu vòng mới thì xoá kết quả cũ
            error: null,
          });
          break;
        }

        case 'ROUND_RESULT': {
          const result = payload?.result ?? payload;
          const winner = result?.winner;

          const clientId = get().clientId;
          const currentPlayerScore = get().playerScore;
          const currentComputerScore = get().computerScore;

          // Nếu người chơi thắng
          if (winner === clientId) {
            set({
              roundResult: result,
              playerScore: currentPlayerScore + 1,
              error: null,
            });
          } 
          // Nếu máy thắng (giả sử máy là người còn lại)
          else if (winner && winner !== clientId) {
            set({
            roundResult: result,
            computerScore: currentComputerScore + 1,
            error: null,
          });
        }
        // Nếu hoà hoặc không rõ
        else {
          set({ roundResult: result, error: null });
        }

        break;
      }

        case 'NEXT_ROUND': {
          // Server thông báo bắt đầu vòng mới → clear move cũ
          set((state) => ({
            roundResult: null,
            players: (state.players || []).map((p) => ({
              ...p,
              currentMove: null,
            })),
            error: null,
          }));
          break;
        }

        case 'GAME_OVER': {
          // Kết thúc trận
          const result = payload?.result ?? null; // 'WIN' | 'LOSE'
          set({
            gameResult: result,
            roomId: null,
            roundResult: null,
            error: null,
          });
          break;
        }

        case 'ERROR': {
          const message = payload?.message || 'Có lỗi xảy ra.';
          set({ error: message });
          break;
        }

        case 'DISCONNECT': {
          // Mất kết nối: reset state và thử reconnect
          set({ ...initialState, error: 'Bị mất kết nối. Đang thử lại...' });
          setTimeout(() => {
            const name = get().username || 'Player';
            get().connect(name);
          }, 3000);
          break;
        }

        default: {
          console.warn('Unknown event type:', event);
        }
      }
    });
  },

  // Thực hiện nước đi (client → server)
  makeMove: (choice) => {
    const roomId = get().roomId;
    const clientId = get().clientId;
    const players = get().players || [];

    // 1) Guard: cần có roomId và clientId
    if (!roomId || !clientId) {
      console.warn('[makeMove] Missing roomId/clientId, skip MOVE');
      return;
    }

    // 2) Tìm chính mình trong danh sách players
    const meIndex = players.findIndex((p) => p.id === clientId);
    if (meIndex === -1) {
      console.warn('[makeMove] Client not found in players, skip MOVE');
      return;
    }
    const me = players[meIndex];

    // 3) Tránh gửi trùng nước đi trong cùng vòng
    if (me.currentMove) {
      console.warn('[makeMove] Already made a move this round, skip');
      return;
    }

    // 4) Chuẩn hoá choice để khớp với server (ROCK/PAPER/SCISSORS)
    const normalize = (c) => {
      const s = String(c).trim().toUpperCase();
      const MAP = { ROCK: 'ROCK', PAPER: 'PAPER', SCISSORS: 'SCISSORS' };
      return MAP[s] || s;
    };
    const normalizedChoice = normalize(choice);

    // 5) Optimistic update: set currentMove cho chính mình để UI disable nút ngay
    set((state) => ({
      players: (state.players || []).map((p) =>
        p.id === clientId ? { ...p, currentMove: normalizedChoice } : p
      ),
      // Nếu còn roundResult cũ, xoá để tránh nhầm hiển thị
      roundResult: null,
      error: null,
    }));

    // 6) Gửi sự kiện lên server
    sendEvent('MOVE', { roomId, clientId, choice: normalizedChoice });
    console.log('Client → Server: MOVE', { roomId, clientId, choice: normalizedChoice });
  },

  // Rời phòng / reset game thủ công (tuỳ server hỗ trợ)
  leaveRoom: () => {
    const roomId = get().roomId;
    if (roomId) {
      sendEvent('LEAVE', { roomId });
    }
    set({ ...initialState, username: get().username }); // giữ tên để dễ reconnect
  },

  // Reset toàn bộ state về mặc định
  resetAll: () => set({ ...initialState }),
  setUsername: (name) => set({ username: String(name || '').trim() }),
}));
