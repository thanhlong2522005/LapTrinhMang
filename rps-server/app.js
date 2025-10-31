import express from "express";
import dotenv from "dotenv";
import sequelize from "./db.js";
import router from "./routes/index.js";
import User from "./models/User.js";
import Match from "./models/Match.js";
import Round from "./models/Round.js";

dotenv.config();

const app = express();
app.use(express.json());
app.use("/api", router);

const PORT = process.env.PORT || 3000;

sequelize.sync({ alter: true }).then(() => {
  console.log("✅ Database synced");
  app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
});
