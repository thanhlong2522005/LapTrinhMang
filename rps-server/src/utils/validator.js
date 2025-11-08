
export const isPositiveInteger = (value) => {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
};

export const validateMatchBody = (body) => {
  const { player1Id, player2Id, winnerId } = body;

  if (!isPositiveInteger(player1Id) || !isPositiveInteger(player2Id)) {
    return {
      valid: false,
      error: 'player1Id và player2Id là bắt buộc và phải là số nguyên dương.',
    };
  }

  if (winnerId !== null && winnerId !== undefined && !isPositiveInteger(winnerId)) {
    return {
      valid: false,
      error: 'winnerId (nếu có) phải là số nguyên dương.',
    };
  }

  return { valid: true, error: null };
};