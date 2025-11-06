import React from 'react';

function Choice({ choice }) {
  const icons = {
    rock: '✊',
    paper: '✋',
    scissors: '✌️',
  };

  const icon = icons[choice] || icons.default;

  return (
    <div className={`choice-display ${choice ? 'selected' : ''}`}>
      <span>{icon}</span>
    </div>
  );
}

export default Choice;