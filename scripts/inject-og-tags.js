#!/usr/bin/env node
/* eslint-disable */
// Post-build OG tag injector.
// Reads dist/index.html, ensures default OpenGraph + Twitter Card meta
// tags exist in the head. setOgTags() in src/lib/ogTags.ts replaces these
// with per-bill specifics once the JS bundle loads, but baseline tags
// ensure link previews work even for crawlers that don't execute JS.

const fs = require('fs');
const path = require('path');

const HTML_PATH = path.join(__dirname, '..', 'dist', 'index.html');
const BANNER_PATH_NEW = '/assets/og-banner.png';
const BANNER_PATH_FALLBACK = '/assets/logo_v2.png';

const DEFAULT_TITLE = 'GoCheck — Split bills, settle smart';
const DEFAULT_DESCRIPTION = 'Track who paid, who hasn\'t, and remind in one tap. No accounts needed for participants.';
const DEFAULT_URL = process.env.EXPO_PUBLIC_WEB_BASE_URL || 'https://go-check.vercel.app';

if (!fs.existsSync(HTML_PATH)) {
  console.error(`[og] dist/index.html not found at ${HTML_PATH} — did expo export run?`);
  process.exit(1);
}

// Prefer the dedicated 1200x630 banner if present, else the existing logo.
const distDir = path.dirname(HTML_PATH);
const bannerCandidate = path.join(distDir, 'assets', 'og-banner.png');
const image = `${DEFAULT_URL}${fs.existsSync(bannerCandidate) ? BANNER_PATH_NEW : BANNER_PATH_FALLBACK}`;

const tags = [
  `<meta property="og:title" content="${DEFAULT_TITLE}" />`,
  `<meta property="og:description" content="${DEFAULT_DESCRIPTION}" />`,
  `<meta property="og:type" content="website" />`,
  `<meta property="og:url" content="${DEFAULT_URL}" />`,
  `<meta property="og:image" content="${image}" />`,
  `<meta name="twitter:card" content="summary_large_image" />`,
  `<meta name="twitter:title" content="${DEFAULT_TITLE}" />`,
  `<meta name="twitter:description" content="${DEFAULT_DESCRIPTION}" />`,
  `<meta name="twitter:image" content="${image}" />`,
].join('\n    ');

let html = fs.readFileSync(HTML_PATH, 'utf8');

// Idempotent: strip any previously injected block before re-inserting.
html = html.replace(/<!-- og:start -->[\s\S]*?<!-- og:end -->\s*/g, '');

const injection = `<!-- og:start -->\n    ${tags}\n    <!-- og:end -->\n  `;

if (!/<\/head>/i.test(html)) {
  console.error('[og] No </head> tag found in dist/index.html — aborting.');
  process.exit(1);
}

html = html.replace(/<\/head>/i, `${injection}</head>`);
fs.writeFileSync(HTML_PATH, html, 'utf8');
console.log(`[og] Injected default OG tags into ${HTML_PATH} (image: ${image})`);
