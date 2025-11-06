import React from 'react';

function ChoiceButton({ choice, onClick, disabled }) {
  const icons = {
    rock: '✊',
    paper: '✋',
    scissors: '✌️'
  };

  return (
    <button 
      className="choice-btn" 
      onClick={() => onClick(choice)}
      disabled={disabled}
      title={choice}
    >
      <span className="icon">{icons[choice]}</span>
    </button>
  );
}

export default ChoiceButton;