# Full Light / Dark Theme — Design Spec

**Date:** 2026-06-05
**Status:** Approved

---

## Problem

The app has a permanent dark cosmic background (`BackgroundBeams` + dark gradient base in `_layout.tsx`) that never changes regardless of the Dark Mode toggle in Profile. When the user switches to light mode, only card surfaces change — the background, status bar, and page-level text remain dark. This breaks the user's expectation that a light mode toggle makes the whole app light.

---

## Goal

A proper two-theme system where:
- **Dark mode** → current cosmic dark background, bright beams, light text (unchanged)
- **Light mode** → premium pearl-white background, soft emerald/teal beams, dark text

Design stays identical (layout, spacing, component structure). Only colors change.

---

## Approach

**Approach 2 — Separate `LightBackgroundBeams` component.**

`_layout.tsx` conditionally renders either `BackgroundBeams` (dark) or `LightBackgroundBeams` (light). Zero risk to the existing dark mode. The two backgrounds are visually different enough to warrant separate components.

---

## Section 1 — `LightBackgroundBeams` Component

**File:** `src/components/effects/LightBackgroundBeams.tsx`

Identical structure to `BackgroundBeams` — same 5 animated SVG beams, same path geometry (`buildPaths`), same animation timing and `AnimBeam` logic. Only the color values differ.

### Base gradient (replaces dark void)
```
#FAFBFF → #F0F4FF → #F5FFFE → #F8FFFC
locations: [0, 0.35, 0.68, 1]
```
Pearl white with a cool indigo-tint at the top and a soft mint-tint at the bottom.

### Readability overlay (replaces dark scrim)
```
rgba(240,244,255,0.20) → rgba(240,244,255,0.10) → rgba(245,255,254,0.15)
```
Light frost instead of dark vignette.

### Beam gradient stops (soft pastel, emerald/teal dominant)

| Beam | Soft glow colors | Hot animated colors |
|------|-----------------|---------------------|
| A (indigo/violet) | `#A5B4FC, #818CF8, #C4B5FD` | `#C7D2FE, #A5B4FC, #DDD6FE` |
| B (mint/emerald) — primary | `#6EE7B7, #34D399, #A7F3D0` | `#D1FAE5, #6EE7B7, #A7F3D0` |
| C (emerald/teal) | `#86EFAC, #4ADE80, #BBF7D0` | `#DCFCE7, #86EFAC, #BBF7D0` |
| D (teal/cyan) | `#34D399, #2DD4BF, #99F6E4` | `#CCFBF1, #5EEAD4, #A7F3D0` |
| E (sky/cyan) | `#67E8F9, #22D3EE, #A5F3FC` | `#CFFAFE, #67E8F9, #BAE6FD` |

### Opacity adjustments
- `softOpacity` values: reduce by ~35% vs dark (light base needs less glow intensity)
- `softWidth` values: keep same widths
- `maxOpacity` for animated strokes: `0.55` (vs `0.9` in dark mode — gentler on white)

### Props interface
Same as `BackgroundBeams`: `style?`, `opacityScale?`, `showBase?`

---

## Section 2 — `_layout.tsx` Changes

### `AnimatedThemeRoot`
- Read `isDark` from `useTheme()` hook inside the component
- Conditionally render background:
  ```
  isDark  → <BackgroundBeams opacityScale={0.95} showBase />
  !isDark → <LightBackgroundBeams opacityScale={1} showBase />
  ```
- Switch root `backgroundColor`:
  - Native: `isDark ? '#070710' : '#FAFBFF'`
  - Web phone container: `isDark ? '#070710' : '#FAFBFF'`
  - Web outer void: `isDark ? '#03030D' : '#F0F4FF'`

### `StatusBar`
- Switch style: `isDark ? 'light' : 'dark'`
- Remove the hardcoded comment "cosmic backdrop is permanently dark"

### Navigation theme
- Currently hardcoded to `NavigationDarkTheme` always
- Switch to `NavigationLightTheme` when `!isDark`, with `background: 'transparent'` override kept

### Web body background
- `isDark`: `document.documentElement.style.backgroundColor = '#03030D'`
- `!isDark`: `document.documentElement.style.backgroundColor = '#F0F4FF'`

---

## Section 3 — `ThemeContext` Light Color Upgrades

`lightColors` currently spreads raw `colors` tokens which look functional but not premium. Upgrade:

| Token | Current | Upgraded | Reason |
|-------|---------|----------|--------|
| `background` | `#F8F9FF` | `#FAFBFF` | Cooler pearl, matches beam base |
| `textPrimary` | `#111827` | `#0F0F1A` | Richer near-black, more premium |
| `textSecondary` | `#6B7280` | `#4B5563` | Deeper, higher contrast |
| `border` | `#E5E7EB` | `rgba(99,102,241,0.10)` | Indigo-tinted, premium feel |
| `divider` | `#F3F4F6` | `rgba(99,102,241,0.06)` | Subtle, consistent with border |
| `tabBarBg` | `rgba(255,255,255,0.92)` | `rgba(250,251,255,0.95)` | Matches pearl background |
| `surface2` | `colors.gray50` | `#F4F5FF` | Slight indigo tint for depth |
| `primaryBorder` | `#C7D2FE` | `rgba(99,102,241,0.20)` | Consistent with border style |

All other `colors` tokens remain (semantic colors, avatar palette, etc.).

---

## Section 4 — Fix Screens Bypassing ThemeContext

These files import `colors` directly from tokens and will not respond to theme switches:

### `app/(modals)/reminders.tsx`
- Replace `import { colors, ... } from '../../src/theme/tokens'`
- Add `const { colors } = useTheme()` inside the component
- Keep other token imports (typography, fontSize, spacing, radius, animation) as static imports — they don't change per theme

### `app/(tabs)/index.tsx`
- Remove `COSMIC_TEXT_PRIMARY = '#F0F0FF'` and `COSMIC_TEXT_SECONDARY` constants
- Replace all usages with `colors.textPrimary` and `colors.textSecondary` from `useTheme()`
- The page-level text (outside cards) must now use theme-aware colors since the background is no longer permanently dark

### `src/components/reminders/` — all files
- All 6 files confirmed to import `colors` directly from tokens: `QueuePane`, `SentPane`, `SettingsPane`, `QueueRow`, `SentRow`, `BatchToast`
- All 6 must switch from `import { colors, ... }` to `const { colors } = useTheme()` inside the component

### Other `src/components/` files already using `useTheme`
- These 20 files are already correct — no changes needed

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/effects/LightBackgroundBeams.tsx` | **New** — light-mode beam background |
| `app/_layout.tsx` | Conditional beam rendering, StatusBar switch, bg color switch |
| `src/theme/ThemeContext.tsx` | Upgrade `lightColors` token values |
| `app/(modals)/reminders.tsx` | Switch to `useTheme()` |
| `app/(tabs)/index.tsx` | Remove `COSMIC_TEXT_*` constants, use `useTheme()` |
| `src/components/reminders/QueuePane.tsx` | Switch to `useTheme()` |
| `src/components/reminders/SentPane.tsx` | Switch to `useTheme()` |
| `src/components/reminders/SettingsPane.tsx` | Switch to `useTheme()` |
| `src/components/reminders/QueueRow.tsx` | Switch to `useTheme()` |
| `src/components/reminders/SentRow.tsx` | Switch to `useTheme()` |
| `src/components/reminders/BatchToast.tsx` | Switch to `useTheme()` |

---

## Out of Scope

- `app/(modals)/create.tsx` — uses `gc` palette intentionally for the cinematic "Create Bill" experience. Keep as-is (always dark, regardless of theme).
- Redesigning any component layout, spacing, or structure
- Adding new animations or transitions beyond what already exists
- The `gc` palette itself — it stays as the "create" screen identity

---

## Success Criteria

1. Toggling Dark Mode in Profile switches the entire app background — not just cards
2. Light mode background is pearl white with soft animated emerald/teal beams
3. Dark mode is visually identical to current (no regression)
4. Status bar icons are dark on light mode, light on dark mode
5. Reminders screen fully respects the theme toggle
6. Home screen page-level text is readable on both backgrounds
7. No hardcoded `COSMIC_TEXT_*` constants remain in theme-sensitive screens
