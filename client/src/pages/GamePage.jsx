import React from 'react';
import { useGameStore } from '../store/useGameStore';
import Player from '../components/Player';
import ChoiceButton from '../components/ChoiceButton';
import Choice from '../components/Choice';

function GamePage() {   
  const players = useGameStore((state) => state.players);
  const makeMove = useGameStore((state) => state.makeMove);
  const roundResult = useGameStore((state) => state.roundResult);
  const clientId = useGameStore((state) => state.clientId);

  const me = players?.find(p => p.id === clientId) || { username: 'Bạn' };
  const opponent = players?.find(p => p.id !== clientId) || { username: 'Đối thủ' };

  const handleChoice = (choice) => {
    if (me && !me.currentMove) { 
      makeMove(choice);
    }
  };

  const iMadeMove = !!me?.currentMove;
  const playerScore = useGameStore((state) => state.playerScore);
  const computerScore = useGameStore((state) => state.computerScore);

  return (
    <div className="container game">

      
      <div className="players-area">
        <Player player={me} isMe={true} />
        <span className="vs">VS</span>
        <Player player={opponent} isMe={false} />
      </div>

      <div className="score-box">
        <p>Điểm của bạn: {playerScore}</p>
        <p>Điểm đối thủ: {computerScore}</p>
      </div>

      <div className="choice-area">
        {!roundResult ? (
          <>
            <p>{iMadeMove ? 'Đã chọn! Chờ đối thủ...😤😤😤' : 'Hãy ra đòn😳😳😳:'}</p>
            <div className="choice-buttons">
              <ChoiceButton choice="rock" onClick={handleChoice} disabled={iMadeMove} />
              <ChoiceButton choice="paper" onClick={handleChoice} disabled={iMadeMove} />
              <ChoiceButton choice="scissors" onClick={handleChoice} disabled={iMadeMove} />
            </div>
          </>
        ) : (
          <div className="round-result">
            <h3>Kết quả vòng:</h3>
            <div className="choices-display">
              <Choice choice={roundResult.player1Move} />
              <Choice choice={roundResult.player2Move} />
            </div>
          <h4>
            {roundResult?.winner === 'DRAW'
              ? 'Hòa😝'
              : roundResult?.winner === clientId
              ? 'Bạn thắng vòng này😈'
              : roundResult?.winner !== null && roundResult?.winner !== undefined
              ? 'Bạn thua vòng này😭'
              : 'Đang xử lý kết quả...🐾🐾🐾'}
            </h4>

            <p>Vòng mới sẽ bắt đầu sau giây lát...😎😎😎😎</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default GamePage; // Đổi tên export