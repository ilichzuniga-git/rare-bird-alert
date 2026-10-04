const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const config = require('./config');
const sightingsRouter = require('./routes/sightings');
const devicesRouter  = require('./routes/devices');
const clustersRouter = require('./routes/clusters');
const { startPoller } = require('./poller');
const { startBirdWeatherJob } = require('./birdweather');
const { ensureLoaded: loadTaxonomy } = require('./ebirdTaxonomy');
const { warm: warmRarity } = require('./rarity');

const app = express();

// Behind Traefik (one hop), so req.ip is the real client IP for rate limiting
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10kb' })); // request bodies are tiny ({ type } / { token, platform })

// Backstop for every route; the report and register routes have their own tighter limits.
// Generous because many phones can share one carrier IP.
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many requests — try again later' },
}));

app.get('/health', (req, res) => {
  res.json({ ok: true, env: config.nodeEnv });
});

// Public guide site: tour, what's new and the privacy policy (src/site). express.static
// redirects /guide to /guide/ so the page's relative fonts/ and shots/ paths resolve.
// The page itself is always revalidated so an edit shows at once; images and fonts cache for a day.
app.use('/guide', express.static(path.join(__dirname, 'site'), {
  maxAge: '1d',
  setHeaders: (res, file) => {
    if (file.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
  },
}));

// Privacy policy URL given to the Play Store and App Store; it now lives in the guide.
// Without JavaScript the guide shows every section, the policy included.
app.get('/privacy', (req, res) => {
  res.redirect(302, '/guide/#privacy');
});

app.use('/api/sightings', sightingsRouter);
app.use('/api/devices',  devicesRouter);
app.use('/api/clusters', clustersRouter);

app.listen(config.port, () => {
  console.log(`RBA backend listening on port ${config.port}`);
  startPoller();
  startBirdWeatherJob();
  loadTaxonomy(); // warm the caches so the first /api/sightings isn't slowed by them
  warmRarity();
});
