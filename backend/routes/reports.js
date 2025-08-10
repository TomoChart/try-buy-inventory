const express = require('express');
const router = express.Router();

// Reports routes
router.get('/', (req, res) => {
  res.send('Get reports');
});

module.exports = router;
