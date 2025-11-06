// controllers/matchController.js
import Match from "../models/Match.js";
import Round from "../models/Round.js";
import User from "../models/User.js";

export const getMatch = async (req, res) => {
  try {
    const match = await Match.findByPk(req.params.id, {
      include: [{ model: Round, as: "rounds" }],
    });

    if (!match) return res.status(404).json({ error: "Match not found" });
    res.json(match);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// CHỈ DÙNG CHO HTTP API
export const createMatch = async (req, res) => {
  try {
    const { player1Id, player2Id, winnerId, rounds } = req.body;

    // KIỂM TRA: player1Id, player2Id phải là số
    if (!player1Id || !player2Id) {
      return res.status(400).json({ error: "player1Id và player2Id là bắt buộc" });
    }

    if (typeof player1Id !== "number" || typeof player2Id !== "number") {
      return res.status(400).json({ error: "player1Id và player2Id phải là số" });
    }

    const match = await Match.create({
      player1Id,
      player2Id,
      winnerId: winnerId || null,
    });

    const roundsArray = Array.isArray(rounds) ? rounds : [];
    for (const r of roundsArray) {
      await Round.create({
        matchId: match.id,
        roundNumber: r.roundNumber || 1,
        player1Choice: r.player1Choice, // Sửa từ 'moveP1'
        player2Choice: r.player2Choice, // Sửa từ 'moveP2'
          winnerId: r.winnerId,
        //moveP1: r.moveP1,
        //moveP2: r.moveP2,
        //result: r.result,
      });
    }

    if (winnerId) {
      const winner = await User.findByPk(winnerId);
      const loserId = winnerId === player1Id ? player2Id : player1Id;
      const loser = await User.findByPk(loserId);

      if (winner) await winner.increment("wins");
      if (loser) await loser.increment("losses");
    }

    res.json({ message: "Match saved", matchId: match.id });
  } catch (err) {
    console.error("Lỗi tạo match (API):", err);
    res.status(400).json({ error: err.message });
  }
};