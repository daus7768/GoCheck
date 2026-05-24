# GoCheck Web Compatibility Fix & Feature Completion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all web-breaking Haptics calls across every component, complete the create-bill feature end-to-end, and ensure the app is fully functional and beautiful on both web and mobile.

**Architecture:** A shared `src/lib/haptics.ts` utility wraps `expo-haptics` with `Platform.OS !== 'web'` guards everywhere. All six component files and `create.tsx` are updated to import from this single utility. The create flow already wires to Supabase; we verify the full round-trip works.

**Tech Stack:** Expo 51, expo-router 3, React Native Web, Supabase JS v2, Zustand, TypeScript 5.3

---

## Files Touched

| Action | Path | Why |
|--------|------|-----|
| **Create** | `src/lib/haptics.ts` | Web-safe haptics wrapper (single source of truth) |
| **Modify** | `src/components/create/AddParticipantModal.tsx` | Remove raw Haptics calls |
| **Modify** | `src/components/create/CreateBillCTA.tsx` | Remove raw Haptics calls |
| **Modify** | `src/components/create/CurrencySelector.tsx` | Remove raw Haptics calls |
| **Modify** | `src/components/create/LineItemRow.tsx` | Remove raw Haptics calls |
| **Modify** | `src/components/create/ParticipantChip.tsx` | Remove raw Haptics calls |
| **Modify** | `src/components/create/SplitTypeControl.tsx` | Remove raw Haptics calls |
| **Modify** | `app/(modals)/create.tsx` | Use shared haptics util, remove inline `haptic` object |

---

## Task 1: Create shared web-safe haptics utility

**Files:**
- Create: `src/lib/haptics.ts`

- [ ] **Step 1: Create the file**

```ts
// src/lib/haptics.ts
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

export const haptic = {
  impact(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
    if (Platform.OS !== 'web') Haptics.impactAsync(style);
  },
  notification(type: Haptics.NotificationFeedbackType) {
    if (Platform.OS !== 'web') Haptics.notificationAsync(type);
  },
  selection() {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
  },
};

export { Haptics };
```

- [ ] **Step 2: Verify TypeScript accepts it**

```bash
npx tsc --noEmit
```
Expected: no errors.

---

## Task 2: Fix AddParticipantModal.tsx

**Files:**
- Modify: `src/components/create/AddParticipantModal.tsx`

Raw calls to fix:
- Line 62: `Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)`
- Line 66: `Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)`

- [ ] **Step 1: Replace import**

Remove:
```ts
import * as Haptics from 'expo-haptics';
```
Add:
```ts
import { haptic, Haptics } from '../../lib/haptics';
```

- [ ] **Step 2: Replace calls in `handleAdd`**

```ts
const handleAdd = () => {
  if (!validate()) {
    haptic.notification(Haptics.NotificationFeedbackType.Error);
    return;
  }
  haptic.notification(Haptics.NotificationFeedbackType.Success);
  // ... rest unchanged
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```
Expected: no errors.

---

## Task 3: Fix CreateBillCTA.tsx

**Files:**
- Modify: `src/components/create/CreateBillCTA.tsx`

Raw calls to fix:
- Line 35: `Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)` (inside `useEffect`)
- Line 71: `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)` (in `handlePress`)

- [ ] **Step 1: Replace import**

Remove:
```ts
import * as Haptics from 'expo-haptics';
```
Add:
```ts
import { haptic, Haptics } from '../../lib/haptics';
```

- [ ] **Step 2: Replace calls**

In the `useEffect`:
```ts
} else if (state === 'success') {
  haptic.notification(Haptics.NotificationFeedbackType.Success);
  successScale.value = withSequence(
```

In `handlePress`:
```ts
const handlePress = () => {
  if (state !== 'idle' || disabled) return;
  haptic.impact(Haptics.ImpactFeedbackStyle.Medium);
  onPress();
};
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```
Expected: no errors.

---

## Task 4: Fix CurrencySelector.tsx

**Files:**
- Modify: `src/components/create/CurrencySelector.tsx`

Raw calls to fix:
- Line 34: `Haptics.selectionAsync()`
- Line 45: `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)`

- [ ] **Step 1: Replace import**

Remove:
```ts
import * as Haptics from 'expo-haptics';
```
Add:
```ts
import { haptic, Haptics } from '../../lib/haptics';
```

- [ ] **Step 2: Replace calls** (find by context — the selector open and currency pick handlers)

```ts
// opening the selector:
haptic.selection();

// selecting a currency:
haptic.impact(Haptics.ImpactFeedbackStyle.Light);
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```
Expected: no errors.

---

## Task 5: Fix LineItemRow.tsx

**Files:**
- Modify: `src/components/create/LineItemRow.tsx`

Raw calls to fix (4 total):
- Line 32: `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)` — on add
- Line 40: `Haptics.selectionAsync()` — on quantity change
- Line 46: `Haptics.selectionAsync()` — on unit price change
- Line 140: `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)` — on delete

- [ ] **Step 1: Replace import**

Remove:
```ts
import * as Haptics from 'expo-haptics';
```
Add:
```ts
import { haptic, Haptics } from '../../lib/haptics';
```

- [ ] **Step 2: Replace all 4 calls**

```ts
// add:
haptic.impact(Haptics.ImpactFeedbackStyle.Medium);

// quantity:
haptic.selection();

// unit price:
haptic.selection();

// delete:
haptic.impact(Haptics.ImpactFeedbackStyle.Light);
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```
Expected: no errors.

---

## Task 6: Fix ParticipantChip.tsx

**Files:**
- Modify: `src/components/create/ParticipantChip.tsx`

Raw calls to fix:
- Line 45: `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)` — on remove

- [ ] **Step 1: Replace import**

Remove:
```ts
import * as Haptics from 'expo-haptics';
```
Add:
```ts
import { haptic, Haptics } from '../../lib/haptics';
```

- [ ] **Step 2: Replace call**

```ts
haptic.impact(Haptics.ImpactFeedbackStyle.Light);
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```
Expected: no errors.

---

## Task 7: Fix SplitTypeControl.tsx

**Files:**
- Modify: `src/components/create/SplitTypeControl.tsx`

Raw calls to fix:
- Line 51: `Haptics.selectionAsync()` — on split type change

- [ ] **Step 1: Replace import**

Remove:
```ts
import * as Haptics from 'expo-haptics';
```
Add:
```ts
import { haptic } from '../../lib/haptics';
```
(No `Haptics` re-export needed — only `selectionAsync` is used.)

- [ ] **Step 2: Replace call**

```ts
haptic.selection();
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```
Expected: no errors.

---

## Task 8: Clean up create.tsx inline haptic helper

**Files:**
- Modify: `app/(modals)/create.tsx`

The inline `haptic` object defined in create.tsx is now redundant. Replace with the shared import.

- [ ] **Step 1: Remove inline helper, replace import**

Remove these lines (approx lines 18–31):
```ts
import * as Haptics from 'expo-haptics';

const haptic = {
  impact: (style: Haptics.ImpactFeedbackStyle) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(style);
  },
  notification: (type: Haptics.NotificationFeedbackType) => {
    if (Platform.OS !== 'web') Haptics.notificationAsync(type);
  },
  selection: () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
  },
};
```

Add single import after the `date-fns` import line:
```ts
import { haptic, Haptics } from '../../src/lib/haptics';
```

> Note: all existing `haptic.*` and `Haptics.*` call sites remain exactly the same — only the source of the helper changes.

- [ ] **Step 2: Final TypeScript + build check**

```bash
npx tsc --noEmit && npx expo export --platform web 2>&1 | tail -5
```
Expected: `App exported to: dist` with no errors.

---

## Task 9: Verify create-bill round trip on web

This is a manual smoke test — no code changes.

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Open browser at http://localhost:8081**

- [ ] **Step 3: Tap "Create New Bill" — confirm modal opens without console errors**

- [ ] **Step 4: Fill in the form**
  - Title: `Lunch at Nasi Lemak`
  - Add 2 participants: `Alice`, `Bob`
  - Split: Equal
  - Due date: pick any future date via the date input
  - Currency: MYR

- [ ] **Step 5: Tap "Create Bill"**
  - Expected: button shows "Creating…" spinner, then "Bill Created!", then navigates back
  - Expected: Home tab shows 1 active bill card

- [ ] **Step 6: Tap the bill card → Bill Detail screen**
  - Expected: progress bar shows 0%, both participants listed with "Mark Paid" buttons
  - Expected: Share Link row shows the code

- [ ] **Step 7: Mark one participant as paid**
  - Expected: participant shows green checkmark, progress bar moves to 50%

- [ ] **Step 8: Tap Share**
  - Expected: browser share dialog or clipboard copy

- [ ] **Step 9: Navigate to Bills tab**
  - Expected: the bill appears in the FlatList with correct data

---

## Task 10: Commit all fixes

- [ ] **Step 1: Stage and commit**

```bash
git add src/lib/haptics.ts \
        src/components/create/AddParticipantModal.tsx \
        src/components/create/CreateBillCTA.tsx \
        src/components/create/CurrencySelector.tsx \
        src/components/create/LineItemRow.tsx \
        src/components/create/ParticipantChip.tsx \
        src/components/create/SplitTypeControl.tsx \
        "app/(modals)/create.tsx"

git commit -m "fix: replace all raw Haptics calls with web-safe haptic utility"
```

---

## Self-Review Checklist

- [x] All 6 component files + create.tsx covered
- [x] Shared utility exported from one place (`src/lib/haptics.ts`)
- [x] `Haptics` re-exported for enum access where needed
- [x] `SplitTypeControl` only imports `haptic` (no enums needed there)
- [x] No placeholder steps — every step has exact code
- [x] TypeScript check after each task to catch errors early
- [x] Manual smoke test in Task 9 covers full create→view→mark-paid flow
- [x] Final commit in Task 10
