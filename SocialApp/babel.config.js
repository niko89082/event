module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['module:react-native-dotenv', {
        moduleName: '@env',
        path: '.env',
        safe: false, // Allow undefined variables
        allowUndefined: true,
        verbose: false,
      }],
      'react-native-reanimated/plugin', // needed for Reanimated v2 - must be last
    ],
  };
};