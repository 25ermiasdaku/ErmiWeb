// Babel config for Expo. expo-router needs no extra plugin here — the router
// entry is declared in package.json (`main`), and Metro reads tsconfig paths.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
  };
};
