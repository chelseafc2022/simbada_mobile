const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  watchFolders: ['./'], // Sesuaikan dengan folder proyek Anda
  resolver: {
    sourceExts: ['jsx', 'js', 'ts', 'tsx', 'json'], // Ekstensi file yang dikenali
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
