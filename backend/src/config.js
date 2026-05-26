require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  ebird: {
    apiKey: process.env.EBIRD_API_KEY,
    enabled: process.env.EBIRD_ENABLED === 'true',
  },
  inaturalist: {
    enabled:          process.env.INAT_ENABLED === 'true',
    // Species with fewer than this many total research-grade observations in a
    // place are considered "rare". Tune up for stricter rarity, down to see more.
    rarityThreshold:  parseInt(process.env.INAT_RARITY_THRESHOLD || '20', 10),
    // How many days back to search for recent observations.
    lookbackDays:     parseInt(process.env.INAT_LOOKBACK_DAYS || '30', 10),
  },
};