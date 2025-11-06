import { DataTypes } from "sequelize";
import sequelize from "../db.js";

const User = sequelize.define("User", {
  username: { type: DataTypes.STRING, allowNull: false, unique: true },
  wins: { type: DataTypes.INTEGER, defaultValue: 0 },
  losses: { type: DataTypes.INTEGER, defaultValue: 0 },
});

export default User;
