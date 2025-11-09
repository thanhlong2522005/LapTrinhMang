import React, { useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { Link } from 'react-router-dom';

function HomePage() { 
  const [username, setUsername] = useState('Player' + Math.floor(Math.random() * 1000));
  
  const connect = useGameStore((state) => state.connect);
  const isConnected = useGameStore((state) => state.isConnected);
  const error = useGameStore((state) => state.error);

  const handleJoin = () => {
    if (username.trim()) {
      connect(username); 
    }
  };

  return (
  <div className="container lobby">
    <h1>Oẳn Tù Tì Siêu Cấp</h1>

    <input
      type="text"
      placeholder="Nhập tên của bạn"
      value={username}
      onChange={(e) => setUsername(e.target.value)}
      className="username-input"
    />

      <button onClick={handleJoin}>Tham Gia</button>

      <Link to="/leaderboard" style={{ display: 'block', marginTop: '15px' }}>
        Xem Bảng Xếp Hạng
      </Link>

    </div>
  );
}

export default HomePage;