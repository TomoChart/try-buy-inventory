const express = require('express');
const router = express.Router();

router.post('/invite', (req, res) => {
  res.send('Invite user');
});

router.post('/login', (req, res) => {
  res.send('Login user');
});

router.post('/reset', (req, res) => {
  res.send('Reset password');
});

module.exports = router;
