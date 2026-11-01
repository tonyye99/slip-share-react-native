const { withEntitlementsPlist } = require('expo/config-plugins')

// Adds nothing to app.json, except for test builds signed with a free Apple ID:
// those can't use Sign in with Apple, so
//   FREE_APPLE_ID=1 npx expo run:ios --configuration Release --device
// builds without it. Store and TestFlight builds keep it.
module.exports = ({ config }) => {
  if (process.env.FREE_APPLE_ID !== '1') return config
  const withoutAppleSignIn = {
    ...config,
    ios: { ...config.ios, usesAppleSignIn: false },
    plugins: config.plugins.filter((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin) !== 'expo-apple-authentication'),
  }
  return withEntitlementsPlist(withoutAppleSignIn, (mod) => {
    delete mod.modResults['com.apple.developer.applesignin']
    return mod
  })
}
