import { useState, useEffect, useRef } from 'react';
import './App.css';
import LeaderboardView from './components/LeaderboardView.jsx';

const WS_URL = 'ws://localhost:3000';

function App() {
  const [ws, setWs] = useState(null);
  const [connected, setConnected] = useState(false);
  const [username, setUsername] = useState('');
  const [gameState, setGameState] = useState('LOGIN');
  const [roomId, setRoomId] = useState(null);
  const [players, setPlayers] = useState([]);
  const [round, setRound] = useState(0);
  const [myMove, setMyMove] = useState(null);
  const [opponentMove, setOpponentMove] = useState(null);
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);
  const [logs, setLogs] = useState([]);
  const [myId, setMyId] = useState(null);
  const [lastResult, setLastResult] = useState(null);

  const wsRef = useRef(null);

  useEffect(() => {
    const websocket = new WebSocket(WS_URL);

    websocket.onopen = () => {
      setConnected(true);
      addLog('✅ Kết nối server thành công');
    };

    websocket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      handleMessage(msg);
    };

    websocket.onclose = () => {
      setConnected(false);
      addLog('❌ Mất kết nối với server');
      setGameState('LOGIN');
    };

    websocket.onerror = () => {
      addLog('❌ Lỗi kết nối');
    };

    wsRef.current = websocket;
    setWs(websocket);

    return () => {
      websocket.close();
    };
  }, []);

  const handleMessage = (msg) => {
    const { event, payload } = msg;

    switch (event) {
      case 'INFO':
        if (payload.clientId) {
          setMyId(payload.clientId);
          addLog(`🆔 ID của bạn: ${payload.clientId}`);
        }
        if (payload.message) addLog(`ℹ️ ${payload.message}`);
        break;

      case 'WAITING_FOR_OPPONENT':
        setGameState('WAITING');
        addLog(`⏳ ${payload.message}`);
        break;

      case 'MATCH_FOUND':
        setRoomId(payload.roomId);
        setPlayers(payload.players || []);
        addLog('✅ Đã tìm thấy đối thủ!');
        break;

      case 'GAME_START':
        setGameState('IN_GAME');
        setPlayers(payload.players || []);
        addLog('🎮 Game bắt đầu!');
        break;

      case 'ROUND_START':
        setRound(payload.roundNumber);
        setMyMove(null);
        setOpponentMove(null);
        setLastResult(null);
        setWaitingForOpponent(false);
        setPlayers(payload.players || []);
        addLog(`\n🎯 === ROUND ${payload.roundNumber} ===`);
        addLog('Hãy chọn Kéo, Búa hoặc Bao!');
        break;

      case 'MOVE_CONFIRMED':
        addLog('✅ Đã nhận lựa chọn của bạn');
        if (payload.waitingForOpponent) {
          setWaitingForOpponent(true);
          addLog('⏳ Đang chờ đối thủ chọn...');
        }
        break;

      case 'ROUND_RESULT': {
        const { player1, player2, winner, result, round } = payload;

        setPlayers([player1, player2]);

        const meIsP1 = player1.id === myId;
        const myChoice = meIsP1 ? player1.move : player2.move;
        const opponentChoice = meIsP1 ? player2.move : player1.move;

        setMyMove(myChoice);
        setOpponentMove(opponentChoice);
        setLastResult({ round, winner, result });

        addLog(`\n📊 === KẾT QUẢ ROUND ${round} ===`);
        addLog(`${player1.username}: ${translateMove(player1.move)} (${player1.score} điểm)`);
        addLog(`${player2.username}: ${translateMove(player2.move)} (${player2.score} điểm)`);

        if (winner === 'DRAW' || result === 'DRAW') addLog('🤝 HÒA! Cả hai +1 điểm');
        else if (winner === myId) addLog('🎉 BẠN THẮNG! +1 điểm');
        else addLog('😢 BẠN THUA! Không được điểm');

        setWaitingForOpponent(false);
        break;
      }

      case 'NEXT_ROUND':
        setPlayers(payload.players || []);
        addLog('\n⏭️ Chuẩn bị round tiếp theo...');
        break;

      case 'OPPONENT_LEFT':
        addLog('❌ Đối thủ đã rời phòng. Game kết thúc.');
        setGameState('GAME_END');
        break;

      case 'GAME_END':
        {
          const finalScores = payload.finalScores;
          addLog('\n🏁 === GAME KẾT THÚC ===');
          if (finalScores?.player1) addLog(`Player 1: ${finalScores.player1.score} điểm`);
          if (finalScores?.player2) addLog(`Player 2: ${finalScores.player2.score} điểm`);
          if (payload.winner) addLog(`🏆 Người thắng: ${payload.winner}`);
          else addLog('🤝 Hòa tổng!');
          setGameState('GAME_END');
        }
        break;

      case 'ERROR':
        addLog(`❌ Lỗi: ${payload.message}`);
        break;

      default:
        // unknown event
        break;
    }
  };

  const translateMove = (move) => {
    const moves = {
      ROCK: '✊ Búa',
      PAPER: '🖐️ Bao',
      SCISSORS: '✌️ Kéo',
      null: '❌ Không chọn',
      'null': '❌ Không chọn'
    };
    return moves[move] || move;
  };

  const addLog = (message) => {
    setLogs((prev) => [...prev, { time: new Date().toLocaleTimeString(), message }]);
  };

  const send = (event, payload) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event, payload }));
    } else {
      addLog('❌ Chưa kết nối WebSocket');
    }
  };

  const handleJoin = () => {
    if (!username.trim()) {
      alert('Vui lòng nhập tên!');
      return;
    }
    send('JOIN', { username });
    addLog(`🎮 Đang tham gia với tên: ${username}`);
  };

  const handleMove = (choice) => {
    if (!roomId) {
      alert('Chưa vào phòng!');
      return;
    }
    setMyMove(choice);
    send('MOVE', { roomId, choice });
  };

  const handleLeave = () => {
    send('LEAVE', {});
    setGameState('LOGIN');
    setRoomId(null);
    setPlayers([]);
    setRound(0);
    addLog('👋 Đã rời phòng');
  };

  const getMyScore = () => {
    const me = players.find(p => p.id === myId);
    return me?.score || 0;
  };

  const getOpponentScore = () => {
    const opponent = players.find(p => p.id !== myId);
    return opponent?.score || 0;
  };

  const getOpponentName = () => {
    const opponent = players.find(p => p.id !== myId);
    return opponent?.username || 'Đối thủ';
  };

  return (
    <div className="App">
      <h1>🎮 KÉO BÚA BAO ONLINE</h1>

      <div className="status">
        {connected ? '🟢 Đã kết nối' : '🔴 Mất kết nối'}
      </div>

      {gameState === 'LOGIN' && (
        <div className="login-screen">
          <h2>Đăng nhập</h2>
          <input
            type="text"
            placeholder="Nhập tên của bạn"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
          />
          <button onClick={handleJoin} disabled={!connected}>
            Tham gia Game
          </button>
          <button 
            onClick={() => setGameState('LEADERBOARD')} 
            style={{ marginTop: '10px' }}
          >
            Xem Bảng Xếp Hạng
          </button>
        </div>
      )}

      {gameState === 'LEADERBOARD' && (
        <LeaderboardView onBack={() => setGameState('LOGIN')} />
      )}

      {gameState === 'WAITING' && (
        <div className="waiting-screen">
          <h2>⏳ Đang chờ đối thủ...</h2>
          <div className="spinner"></div>
          <button onClick={handleLeave}>Hủy</button>
        </div>
      )}

      {gameState === 'IN_GAME' && (
        <div className="game-screen">
          <div className="scoreboard">
            <div className="player">
              <h3>🎮 {username}</h3>
              <div className="score">{getMyScore()} điểm</div>
            </div>
            <div className="vs">VS</div>
            <div className="player">
              <h3>🤖 {getOpponentName()}</h3>
              <div className="score">{getOpponentScore()} điểm</div>
            </div>
          </div>

          <h2>Round {round}</h2>

          {myMove && opponentMove && (
            <div className="result-display" style={{
              background: '#f0f0f0',
              padding: '20px',
              borderRadius: '10px',
              margin: '20px 0',
              textAlign: 'center'
            }}>
              <h3>🎯 Kết quả Round {lastResult?.round}</h3>
              <div style={{
                display: 'flex',
                justifyContent: 'space-around',
                margin: '20px 0',
                alignItems: 'center'
              }}>
                <div>
                  <p><strong>Bạn chọn:</strong></p>
                  <p style={{ fontSize: '48px' }}>{translateMove(myMove)}</p>
                </div>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>VS</div>
                <div>
                  <p><strong>Đối thủ chọn:</strong></p>
                  <p style={{ fontSize: '48px' }}>{translateMove(opponentMove)}</p>
                </div>
              </div>
              <p style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '10px' }}>
                {lastResult?.winner === 'DRAW' || lastResult?.result === 'DRAW'
                  ? '🤝 HÒA!'
                  : lastResult?.winner === myId
                    ? '🎉 BẠN THẮNG!'
                    : '😢 BẠN THUA!'}
              </p>
            </div>
          )}

          {!myMove && !waitingForOpponent && (
            <div className="choices">
              <button onClick={() => handleMove('ROCK')} className="choice-btn rock">
                ✊<br />Búa
              </button>
              <button onClick={() => handleMove('PAPER')} className="choice-btn paper">
                🖐️<br />Bao
              </button>
              <button onClick={() => handleMove('SCISSORS')} className="choice-btn scissors">
                ✌️<br />Kéo
              </button>
            </div>
          )}

          {waitingForOpponent && !opponentMove && (
            <div style={{ textAlign: 'center', margin: '20px' }}>
              <h3>⏳ Đang chờ đối thủ chọn...</h3>
              <p>Bạn đã chọn: {translateMove(myMove)}</p>
            </div>
          )}

          <button onClick={handleLeave} className="leave-btn">
            Rời phòng
          </button>
        </div>
      )}

      {gameState === 'GAME_END' && (
        <div className="game-end-screen">
          <h2>🏁 Game kết thúc!</h2>
          <button onClick={() => {
            setGameState('LOGIN');
            setLogs([]);
          }}>
            Chơi lại
          </button>
        </div>
      )}

      <div className="log-panel">
        <h3>📜 Nhật ký</h3>
        <div className="log-content">
          {logs.map((log, i) => (
            <div key={i} className="log-item">
              <span className="log-time">{log.time}</span> {log.message}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;