import React from 'react';

function Player({ player, isMe }) {
  if (!player) return <div className="player-card">...</div>;
  
  // 'currentMove' từ store là true/false
  const moveStatus = player.currentMove ? '✅ Đã chọn' : '... Đang chọn';

  return (
    <div className={`player-card ${isMe ? 'me' : 'opponent'}`}>
      <h3>{player.username} {isMe ? '(Bạn)' : ''}</h3>
      <p>{moveStatus}</p>
    </div>
  );
}

export default Player;