const express = require('express');
const cors = require('cors');
const config = require('./config');
const sightingsRouter = require('./routes/sightings');
const devicesRouter = require('./routes/devices');
const { startPoller } = require('./poller');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ ok: true, env: config.nodeEnv });
});

app.use('/api/sightings', sightingsRouter);
app.use('/api/devices', devicesRouter);

app.listen(config.port, () => {
  console.log(`RBA backend listening on port ${config.port}`);
  startPoller();
});
