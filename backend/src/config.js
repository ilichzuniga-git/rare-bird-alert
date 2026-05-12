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
};