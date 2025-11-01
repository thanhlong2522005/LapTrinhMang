// models/Match.js
import { DataTypes } from "sequelize";
import sequelize from "../db.js";
import User from "./User.js";
import Round from "./Round.js";

const Match = sequelize.define("Match", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  player1Id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: User, key: "id" },
  },
  player2Id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: User, key: "id" },
  },
  winnerId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: User, key: "id" },
  },
}, {
  timestamps: true,
});



export default Match;