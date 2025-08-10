const express = require('express');
const router = express.Router();

// BTL routes
router.get('/', (req, res) => {
  res.send('Get BTL devices');
});

module.exports = router;
