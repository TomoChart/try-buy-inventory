const express = require('express');
const router = express.Router();

// Devices routes
router.get('/', (req, res) => {
  res.send('Get devices');
});

module.exports = router;
