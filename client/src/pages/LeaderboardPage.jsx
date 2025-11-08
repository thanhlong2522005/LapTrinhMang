import React, { useState, useEffect } from 'react';
import { getLeaderboard } from '../services/api';
import { Link } from 'react-router-dom';

const LeaderboardPage = () => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        setLoading(true);
        const data = await getLeaderboard(); 
        setLeaderboard(data);
        setError(null);
      } catch (err) {
        setError('Không thể tải Bảng xếp hạng. Vui lòng thử lại.');
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []); 

  const renderContent = () => {
    if (loading) {
      return <p>Đang tải Bảng xếp hạng...</p>;
    }

    if (error) {
      return <p style={{ color: 'red' }}>{error}</p>;
    }

    if (leaderboard.length === 0) {
      return <p>Chưa có ai trên Bảng xếp hạng.</p>;
    }

    return (
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f0f0f0' }}>
            <th style={{ padding: '8px', border: '1px solid #ddd' }}>Hạng</th>
            <th style={{ padding: '8px', border: '1px solid #ddd' }}>Người chơi</th>
            <th style={{ padding: '8px', border: '1px solid #ddd' }}>Thắng</th>
            <th style={{ padding: '8px', border: '1px solid #ddd' }}>Thua</th>
          </tr>
        </thead>
        <tbody>
          {leaderboard.map((user, index) => (
            <tr key={user.id || user.username}>
              <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>{index + 1}</td>
              <td style={{ padding: '8px', border: '1px solid #ddd' }}>{user.username}</td>
              <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>{user.wins}</td>
              <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>{user.losses}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div className="container lobby" style={{ maxWidth: '600px', margin: 'auto' }}>
      <h1>🏆 Bảng Xếp Hạng 🏆</h1>
      
      {renderContent()}
      
      <Link to="/">
        <button style={{ marginTop: '20px' }}>Quay về Sảnh</button>
      </Link>
    </div>
  );
};

export default LeaderboardPage;