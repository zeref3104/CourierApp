const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Strips android.permission.SYSTEM_ALERT_WINDOW from the merged Android manifest.
 *
 * The default React Native / Expo template adds SYSTEM_ALERT_WINDOW, but this app
 * never draws over other apps. Keeping it triggers avoidable Play Console review
 * friction. Removing it here (instead of editing the generated manifest) ensures
 * the change survives `expo prebuild`.
 */
module.exports = function withRemovedSystemAlertWindow(config) {
  return withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults;
    const permissions = manifest.manifest['uses-permission'] || [];
    manifest.manifest['uses-permission'] = permissions.filter(
      (p) => p.$['android:name'] !== 'android.permission.SYSTEM_ALERT_WINDOW'
    );
    return modConfig;
  });
};
