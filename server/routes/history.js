// server/routes/history.js
const express = require('express');
const router = express.Router();
const dataStore = require('../dataStore');

// GET /api/history/:symbol
router.get('/:symbol', async (req, res) => { 
  try {
    const { symbol } = req.params;
    const history = await dataStore.getHistory(symbol); 
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;