const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ sightings: [], message: 'Not yet implemented' });
});

module.exports = router;