/**
 * Generates minimal placeholder PNG assets for Expo.
 * Run once: node scripts/generate-assets.js
 */
const fs = require('fs');
const path = require('path');

// 1×1 white pixel PNG (base64)
const PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

// 1×1 indigo pixel PNG (#4F46E5) for icon/splash backgrounds
const INDIGO_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

const assetsDir = path.join(__dirname, '..', 'assets');
fs.mkdirSync(assetsDir, { recursive: true });

const files = {
  'icon.png': INDIGO_PNG,
  'splash.png': INDIGO_PNG,
  'adaptive-icon.png': INDIGO_PNG,
  'favicon.png': INDIGO_PNG,
};

for (const [name, data] of Object.entries(files)) {
  const dest = path.join(assetsDir, name);
  if (!fs.existsSync(dest)) {
    fs.writeFileSync(dest, data);
    console.log(`✓ Created assets/${name}`);
  } else {
    console.log(`  Skipped assets/${name} (already exists)`);
  }
}

console.log('\nDone. Replace these with real assets before shipping.');
