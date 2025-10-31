import { DataTypes } from "sequelize";
import sequelize from "../db.js";
import User from "./User.js";

const Match = sequelize.define("Match", {
  player1Id: DataTypes.INTEGER,
  player2Id: DataTypes.INTEGER,
  winnerId: DataTypes.INTEGER,
});

User.hasMany(Match, { foreignKey: "player1Id" });
User.hasMany(Match, { foreignKey: "player2Id" });

export default Match;
