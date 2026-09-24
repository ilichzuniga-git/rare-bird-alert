// Dynamic config layered on app.json. google-services.json is git-ignored, and EAS
// cloud builds don't upload ignored files, so there it comes from the
// GOOGLE_SERVICES_JSON file environment variable (see README, "Building the app").
// Locally the file in this folder is used as before.
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? config.android.googleServicesFile,
  },
});
