const express = require('express');
const router = express.Router();

// Imports routes
router.post('/', (req, res) => {
  res.send('Import data');
});

module.exports = router;
