// models/Round.js
import { DataTypes } from "sequelize";
import sequelize from "../db.js";
import Match from "./Match.js";

const Round = sequelize.define("Round", {
  matchId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  roundNumber: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  moveP1: DataTypes.STRING,
  moveP2: DataTypes.STRING,
  result: DataTypes.STRING,
}, {
  timestamps: true
});

// Quan hệ 2 chiều (rất quan trọng!)
Match.hasMany(Round, { foreignKey: "matchId", as: "rounds" });
Round.belongsTo(Match, { foreignKey: "matchId" });

export default Round;