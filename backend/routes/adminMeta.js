const express = require('express');
const { prisma } = require('../middleware/context');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

// GET /admin/countries
router.get('/admin/countries', authRequired, async (req, res) => {
  const list = await prisma.country.findMany({
    orderBy: { code: 'asc' },
    select: { id: true, code: true },
  });
  res.json(list);
});

module.exports = router;
