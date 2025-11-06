import React from 'react';
import { useGameStore } from '../store/useGameStore';

function ResultPage() { 
  const gameResult = useGameStore((state) => state.gameResult);
  const playAgain = useGameStore((state) => state.playAgain);
  const username = useGameStore((state) => state.username);

  return (
    <div className="container result">
      {gameResult === 'WIN' ? (
        <h1>🏆 Chúc mừng, {username}! Bạn đã THẮNG! 🏆</h1>
      ) : (
        <h1>😞 Rất tiếc, {username}! Bạn đã THUA! 😞</h1>
      )}
      
      <button onClick={playAgain} className="play-again-btn">
        Chơi lại
      </button>
    </div>
  );
}

export default ResultPage; // Đổi tên export