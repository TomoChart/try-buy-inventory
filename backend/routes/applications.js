const express = require('express');
const router = express.Router();

// Applications routes
router.get('/', (req, res) => {
  res.send('Get applications');
});

module.exports = router;
