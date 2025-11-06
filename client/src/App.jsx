import { useGameStore } from './store/useGameStore';
import HomePage from './pages/HomePage';
import GamePage from './pages/GamePage';
import ResultPage from './pages/ResultPage';
import './index.css'; 

function App() {
  
  // ❌ DÒNG LỖI CŨ CỦA EM:
  // const { isConnected, roomId, gameResult } = useGameStore((state) => ({
  //   isConnected: state.isConnected,
  //   roomId: state.roomId,
  //   gameResult: state.gameResult,
  // }));

  // ✅ THAY THẾ BẰNG 3 DÒNG CHUẨN NÀY:
  // Cách gọi state "ổn định" (stable selector)
  const isConnected = useGameStore((state) => state.isConnected);
  const roomId = useGameStore((state) => state.roomId);
  const gameResult = useGameStore((state) => state.gameResult);
  
  // Luồng 3: Hiển thị Kết quả
  if (gameResult) {
    return <ResultPage />;
  }

  // Luồng 2: Hiển thị Game
  if (isConnected && roomId) {
    return <GamePage />;
  }

  // Luồng 1: Hiển thị Lobby (HomePage)
  return <HomePage />;
}

export default App;