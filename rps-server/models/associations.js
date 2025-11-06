import Match from "./Match.js";
import Round from "./Round.js";
import User from "./User.js";

// Match - Round
Match.hasMany(Round, { foreignKey: "matchId", as: "rounds" });
Round.belongsTo(Match, { foreignKey: "matchId" });

// Match - User
User.hasMany(Match, { foreignKey: "player1Id", as: "matchesAsPlayer1" });
User.hasMany(Match, { foreignKey: "player2Id", as: "matchesAsPlayer2" });
User.hasMany(Match, { foreignKey: "winnerId", as: "matchesWon" });

// Round - User (nếu cần)
Round.belongsTo(User, { foreignKey: "playerId", as: "player" });

export { Match, Round, User };
