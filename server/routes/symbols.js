// server/routes/symbols.js
const express = require('express');
const router = express.Router();
const dataStore = require('../dataStore');

// GET /api/symbols
router.get('/', async (req, res) => { 
  try {
    const symbols = await dataStore.getAllSymbols(); 
    res.json(symbols);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;