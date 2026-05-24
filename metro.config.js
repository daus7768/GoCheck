const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// @supabase/supabase-js optionally imports @opentelemetry/api via dynamic import.
// Metro can't resolve optional dynamic imports, so we stub it out.
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  '@opentelemetry/api': require.resolve('./src/lib/opentelemetry-stub.js'),
};

module.exports = config;
