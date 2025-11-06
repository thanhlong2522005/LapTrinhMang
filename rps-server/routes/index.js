import express from "express";
import { getUsers, createUser } from "../controllers/userController.js";
import { getMatch, createMatch } from "../controllers/matchController.js";
import { getLeaderboard } from "../controllers/leaderboardController.js";

const router = express.Router();

router.get("/users", getUsers);
router.post("/users", createUser);
router.get("/matches/:id", getMatch);
router.post("/matches", createMatch);
router.get("/leaderboard", getLeaderboard);

export default router;
