import { Platform } from 'react-native';

interface OgTagOptions {
  title: string;
  description: string;
  image?: string;
  url?: string;
}

const MANAGED_FLAG = 'data-og-managed';

/**
 * Inject or update OpenGraph + Twitter Card meta tags on the document head.
 * Web-only — no-op on native.
 *
 * Tags managed by this helper are marked with `data-og-managed="true"` so
 * subsequent calls update existing tags in place instead of duplicating.
 *
 * This complements the static OG tags injected at build time by
 * scripts/inject-og-tags.js: the build script ensures a baseline preview
 * exists even before the JS bundle loads; this helper layers per-page
 * specifics on top once the bundle executes.
 */
export function setOgTags({ title, description, image, url }: OgTagOptions): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;

  setTag('property', 'og:title', title);
  setTag('property', 'og:description', description);
  setTag('property', 'og:type', 'website');
  if (image) setTag('property', 'og:image', image);
  if (url) setTag('property', 'og:url', url);

  setTag('name', 'twitter:card', image ? 'summary_large_image' : 'summary');
  setTag('name', 'twitter:title', title);
  setTag('name', 'twitter:description', description);
  if (image) setTag('name', 'twitter:image', image);

  // Browser tab reflects the page.
  document.title = title;
}

function setTag(attrName: 'property' | 'name', attrValue: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(
    `meta[${attrName}="${attrValue}"][${MANAGED_FLAG}]`
  );
  if (!el) {
    // If an unmanaged tag exists (e.g., from the build-time injector),
    // promote it to managed and update content rather than duplicating.
    const existing = document.head.querySelector<HTMLMetaElement>(
      `meta[${attrName}="${attrValue}"]`
    );
    if (existing) {
      existing.setAttribute(MANAGED_FLAG, 'true');
      existing.setAttribute('content', content);
      return;
    }
    el = document.createElement('meta');
    el.setAttribute(attrName, attrValue);
    el.setAttribute(MANAGED_FLAG, 'true');
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}
