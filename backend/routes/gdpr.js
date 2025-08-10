const express = require('express');
const router = express.Router();

// GDPR routes
router.get('/', (req, res) => {
  res.send('Get GDPR queue');
});

module.exports = router;
