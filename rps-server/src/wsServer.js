import { WebSocketServer } from "ws";
import MatchMaker from "./matchMaker.js";
import User from "../models/User.js"; // 👈 cần import thêm model User

export default function setupWsServer(server) {
  const wss = new WebSocketServer({ server });
  const matchMaker = new MatchMaker();

  console.log("✅ WebSocket server initialized (shared port)");

  wss.on("connection", (ws) => {
    ws.id = Math.random().toString(36).substr(2, 9);
    console.log(`[WS] Connected: ${ws.id}`);

    ws.on("message", async (data) => { // 👈 cần async để dùng await
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch (e) {
        ws.send(JSON.stringify({ event: "ERROR", payload: { message: "Invalid JSON" } }));
        return;
      }
      await handle(ws, msg); // 👈 thêm await để xử lý đúng thứ tự
    });

    ws.on("close", () => {
      console.log(`[WS] Disconnected: ${ws.id}`);
      matchMaker.handleDisconnect(ws);
    });

    ws.send(JSON.stringify({
      event: "INFO",
      payload: { clientId: ws.id, message: "Connected!" }
    }));
  });

  // ✅ HÀM XỬ LÝ CÁC SỰ KIỆN TỪ CLIENT
  async function handle(ws, msg) {
    const { event, payload } = msg;

    switch ((event || "").toUpperCase()) {
      case "JOIN": {
        try {
          const username = payload?.username || `Player-${ws.id}`;

          // 🔹 Tạo user mới hoặc lấy user cũ trong DB
          const [user] = await User.findOrCreate({ where: { username } });

          ws.userId = user.id;      // ✅ lưu userId thật
          ws.username = username;   // ✅ lưu username
          
          console.log(`[JOIN] ${username} (id=${ws.userId}) joined queue`);
          matchMaker.joinQueue(ws, username);
        } catch (err) {
          console.error("[JOIN ERROR]", err.message);
          ws.send(JSON.stringify({
            event: "ERROR",
            payload: { message: "Failed to register user" }
          }));
        }
        break;
      }

      case "MOVE":
        matchMaker.receiveMove(ws, payload);
        break;

      case "LEAVE":
        matchMaker.leave(ws);
        break;

      default:
        ws.send(JSON.stringify({
          event: "ERROR",
          payload: { message: "Unknown event" }
        }));
    }
  }
}
