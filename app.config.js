const { withEntitlementsPlist } = require('expo/config-plugins')

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
