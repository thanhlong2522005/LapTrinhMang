import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useGameStore } from './store/useGameStore';

import HomePage from './pages/HomePage';
import GamePage from './pages/GamePage';
import ResultPage from './pages/ResultPage';
import LeaderboardPage from './pages/LeaderboardPage'; 

function App() {
  const roomId = useGameStore((state) => state.roomId);
  const gameResult = useGameStore((state) => state.gameResult);
  const location = useLocation();

  return (
    <Routes>
      {/* Trang Chủ (Lobby) */}
      <Route
        path="/"
        element={
          roomId ? <Navigate to="/game" state={{ from: location }} replace /> : <HomePage />
        }
      />

      {/* Trang Bảng Xếp Hạng (của bạn) */}
      <Route path="/leaderboard" element={<LeaderboardPage />} />

      {/* Trang Game (Đang chơi) */}
      <Route
        path="/game"
        element={
          gameResult ? (
            <Navigate to="/result" state={{ from: location }} replace />
          ) : !roomId ? (
            <Navigate to="/" state={{ from: location }} replace />
          ) : (
            <GamePage />
          )
        }
      />

      {/* Trang Kết Quả (Thắng/Thua) */}
      <Route
        path="/result"
        element={
          !gameResult ? <Navigate to="/" state={{ from: location }} replace /> : <ResultPage />
        }
      />
      
      {/* URL không tồn tại */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;