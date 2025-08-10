const express = require('express');
const router = express.Router();

// Loans routes
router.get('/', (req, res) => {
  res.send('Get loans');
});

module.exports = router;
