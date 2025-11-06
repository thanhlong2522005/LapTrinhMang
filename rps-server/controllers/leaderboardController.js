import User from "../models/User.js";

export const getLeaderboard = async (req, res) => {
  const leaderboard = await User.findAll({
    order: [["wins", "DESC"]],
    limit: 10,
  });
  res.json(leaderboard);
};
