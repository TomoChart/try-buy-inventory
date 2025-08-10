const express = require('express');
const router = express.Router();

// Locations routes
router.get('/', (req, res) => {
  res.send('Get locations');
});

module.exports = router;
