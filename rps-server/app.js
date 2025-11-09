// app.js
import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import sequelize from "./db.js";
import router from "./routes/index.js";
import setupWsServer from "./src/wsServer.js";
import "./models/associations.js";
import cors from 'cors';

//import { getMatch, createMatch } from "./controllers/matchController.js"; // ✅ import hàm controller

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// 1️⃣ Kích hoạt WebSocket
setupWsServer(server);

// 2️⃣ Cấu hình middleware
app.use(cors());

app.use(express.json());
app.use("/api", router);

// 3️⃣ Trang test client
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "client-test-page.html"));
});

// 4️⃣ REST API cho matches
//app.get("/matches/:id", getMatch);
//app.post("/matches", createMatch);

// 5️⃣ Kết nối database và start server
sequelize
  .sync({ alter: true })
  .then(() => {
    console.log("✅ Database synced");
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
      console.log(`✅ WebSocket also available at ws://localhost:${PORT}`);
    });
  })
  .catch((err) => console.error("❌ Database sync error:", err));
