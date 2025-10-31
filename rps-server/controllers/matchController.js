// controllers/matchController.js
import Match from "../models/Match.js";
import Round from "../models/Round.js";
import User from "../models/User.js";

export const getMatch = async (req, res) => {
  try {
    const match = await Match.findByPk(req.params.id, {
      include: [
        {
          model: Round,
          as: "rounds", // ← Đảm bảo có alias nếu dùng
        },
      ],
    });

    if (!match) {
      return res.status(404).json({ error: "Match not found" });
    }

    res.json(match);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createMatch = async (req, res) => {
  try {
    const { player1Id, player2Id, winnerId, rounds } = req.body;

    // BẮT BUỘC: Kiểm tra player1Id, player2Id
    if (!player1Id || !player2Id) {
      return res.status(400).json({ error: "player1Id và player2Id là bắt buộc" });
    }

    // Tạo trận đấu
    const match = await Match.create({
      player1Id,
      player2Id,
      winnerId: winnerId || null,
    });

    // SỬA LỖI: rounds có thể undefined
    const roundsArray = Array.isArray(rounds) ? rounds : [];

    for (const r of roundsArray) {
      await Round.create({
        ...r,
        matchId: match.id,
        roundNumber: r.roundNumber || 1,
      });
    }

    // Cập nhật wins/losses
    if (winnerId) {
      const winner = await User.findByPk(winnerId);
      if (winner) await winner.increment("wins");

      const loserId = winnerId === player1Id ? player2Id : player1Id;
      const loser = await User.findByPk(loserId);
      if (loser) await loser.increment("losses");
    }

    res.json({ message: "Match saved", matchId: match.id });
  } catch (err) {
    console.error("Lỗi tạo match:", err);
    res.status(400).json({ error: err.message });
  }
};