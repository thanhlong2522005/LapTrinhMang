import { DataTypes } from "sequelize";
import sequelize from "../db.js";

const Round = sequelize.define("Round", {
  matchId: { type: DataTypes.INTEGER, allowNull: false },
  roundNumber: { type: DataTypes.INTEGER, allowNull: false },
  player1Choice: { type: DataTypes.STRING },
  player2Choice: { type: DataTypes.STRING },
  winnerId: { type: DataTypes.INTEGER },
});

export default Round;
