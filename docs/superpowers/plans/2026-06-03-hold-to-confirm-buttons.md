# Hold-to-Confirm Buttons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bill detail screen's plain Pressable + `Alert.alert` buttons (Mark Complete, Delete Bill) with a shared `HoldToConfirm` primitive: a button that fills with a progress overlay while held, only fires `onConfirm` on full completion, then plays a celebration animation (confetti + success morph for Complete) or a shake-and-dissolve animation (Delete).

**Architecture:** One reusable component `HoldToConfirm` in `src/components/common/`. State machine driven by a single Reanimated `progress` shared value with `withTiming(..., callback)` — only the natural-completion callback fires `onConfirm`, so cancellation can't misfire. Two variants: `success` and `destructive`. Two finale animation modes: `confetti` (mounts ConfettiBurst + SuccessCheck overlay) and `shake-dissolve` (the parent owns a dissolve shared value the button triggers via callback). Reduced-motion users get a single-tap fallback with `Alert.alert` confirmation.

**Tech Stack:** Reanimated v3.10 (already in project), expo-haptics, existing `ConfettiBurst` and `SuccessCheck` primitives, existing `useReduceMotion` hook.

**Spec:** `docs/superpowers/specs/2026-06-03-share-flow-buttons-modal-fix-design.md` § Project B.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/components/common/HoldToConfirm.tsx` | Create | Reusable hold-to-fill button. Owns: `progress` shared value, gesture handling (Pressable `onPressIn`/`onPressOut`), variant styling, haptic feedback, confetti overlay (when `onConfirmAnimation='confetti'`). Reduced-motion fallback uses `Alert.alert`. |
| `app/(modals)/bill/[id].tsx` | Modify | Remove the existing `handleComplete`/`handleDelete` with `Alert.alert`. Add plain async `handleCompleteAsync`/`handleDeleteAsync`. Add a `dissolveProgress` shared value + Animated.View wrapper around the screen body for the destructive finale. Swap the two `Pressable` buttons for `<HoldToConfirm>` instances. Wire `handleDeleteAsync` to play shake → dissolve → API → router.back. |

No tests added — the existing project has no UI unit tests, and animation behavior is visually verified.

---

## Task 1: Create `HoldToConfirm` primitive

**Files:**
- Create: `src/components/common/HoldToConfirm.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/common/HoldToConfirm.tsx`:

```tsx
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, fontSize, radius, spacing, shadow } from '../../theme/tokens';
import { haptic, ImpactFeedbackStyle } from '../../lib/haptics';
import { AppText } from '../AppText';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { ConfettiBurst } from './ConfettiBurst';
import { SuccessCheck } from '../bill/SuccessCheck';

export type HoldToConfirmVariant = 'success' | 'destructive';
export type HoldToConfirmAnimation = 'confetti' | 'shake-dissolve';

export interface HoldToConfirmProps {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  variant: HoldToConfirmVariant;
  /** Milliseconds the user must hold before onConfirm fires. Default 1200. */
  holdDuration?: number;
  /** Async callback invoked when the hold completes naturally. */
  onConfirm: () => void | Promise<void>;
  /**
   * Which finale animation to play:
   * - `confetti`: HoldToConfirm renders ConfettiBurst + SuccessCheck overlay above the button.
   *   The overlay is absolutely positioned inside the nearest positioned ancestor.
   * - `shake-dissolve`: HoldToConfirm only fires onConfirm; the *parent* is responsible
   *   for any animation (e.g., shaking and dissolving the screen). Use this when the
   *   destructive effect needs to encompass content the button doesn't own.
   */
  onConfirmAnimation: HoldToConfirmAnimation;
  disabled?: boolean;
  /** Optional accessibility hint override. */
  accessibilityHint?: string;
}

const FALLBACK_TITLES: Record<HoldToConfirmVariant, string> = {
  success: 'Confirm',
  destructive: 'Are you sure?',
};

const FALLBACK_MESSAGES: Record<HoldToConfirmVariant, string> = {
  success: 'Proceed?',
  destructive: 'This action cannot be undone.',
};

/**
 * Press-and-hold confirmation button. Avoids accidental confirmations
 * (compared to a tap) and adds a tactile, premium feel. Only the natural
 * completion of the `withTiming` animation fires `onConfirm` — releasing
 * early calls `cancelAnimation` so the callback can't misfire.
 *
 * Accessibility: respects `prefers-reduced-motion` and falls back to a
 * single-tap `Alert.alert` flow for those users.
 */
export function HoldToConfirm({
  label,
  icon,
  variant,
  holdDuration = 1200,
  onConfirm,
  onConfirmAnimation,
  disabled = false,
  accessibilityHint,
}: HoldToConfirmProps) {
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(0);
  const scale = useSharedValue(1);
  const [confettiActive, setConfettiActive] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const fillColors: [string, string] =
    variant === 'success'
      ? [colors.secondary, colors.secondaryDark]
      : [colors.error, colors.errorDark];

  const baseBg = variant === 'success' ? colors.secondary : colors.error;

  // Cleanup any in-flight animation if the component unmounts mid-hold.
  useEffect(() => {
    return () => {
      cancelAnimation(progress);
      cancelAnimation(scale);
    };
  }, [progress, scale]);

  const handleConfirmed = useCallback(async () => {
    haptic.impact(ImpactFeedbackStyle.Medium);
    if (onConfirmAnimation === 'confetti') {
      setShowSuccess(true);
      // Stagger confetti slightly after the success check appears.
      setTimeout(() => setConfettiActive(true), 220);
    }
    try {
      await onConfirm();
    } finally {
      if (onConfirmAnimation === 'confetti') {
        // Unmount the overlay after the animation duration.
        setTimeout(() => {
          setShowSuccess(false);
          setConfettiActive(false);
        }, 1500);
      }
    }
  }, [onConfirm, onConfirmAnimation]);

  const handleReducedMotionTap = useCallback(() => {
    Alert.alert(
      FALLBACK_TITLES[variant],
      FALLBACK_MESSAGES[variant],
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: variant === 'destructive' ? 'Delete' : 'Confirm',
          style: variant === 'destructive' ? 'destructive' : 'default',
          onPress: () => {
            void handleConfirmed();
          },
        },
      ],
    );
  }, [variant, handleConfirmed]);

  const handlePressIn = useCallback(() => {
    if (disabled) return;
    haptic.selection();
    scale.value = withSpring(0.98, { damping: 18, stiffness: 320 });
    progress.value = 0;
    progress.value = withTiming(
      1,
      { duration: holdDuration, easing: Easing.linear },
      (finished) => {
        if (finished) {
          runOnJS(handleConfirmed)();
        }
      },
    );
  }, [disabled, holdDuration, progress, scale, handleConfirmed]);

  const handlePressOut = useCallback(() => {
    if (disabled) return;
    scale.value = withSpring(1, { damping: 18, stiffness: 220 });
    // Only spring back if we haven't already reached 1. The withTiming
    // callback fires before we get here on natural completion, so reaching
    // 1.0 means do nothing; reaching <1 means cancel.
    if (progress.value < 1) {
      cancelAnimation(progress);
      haptic.selection();
      progress.value = withSpring(0, { damping: 18, stiffness: 220 });
    }
  }, [disabled, progress, scale]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Reduced-motion fallback: render a plain tappable button that opens Alert.
  if (reduceMotion) {
    return (
      <Pressable
        onPress={handleReducedMotionTap}
        disabled={disabled}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: baseBg },
          pressed && { opacity: 0.85 },
          disabled && { opacity: 0.5 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Feather name={icon} size={16} color={colors.white} />
        <AppText style={styles.label}>{label}</AppText>
      </Pressable>
    );
  }

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.button, { backgroundColor: 'transparent', borderWidth: 0 }, containerStyle]}>
        <Pressable
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint={accessibilityHint ?? `Press and hold for ${(holdDuration / 1000).toFixed(1)} seconds`}
          style={[styles.pressableInner, { backgroundColor: baseBg }, disabled && { opacity: 0.5 }]}
        >
          {/* Progress fill */}
          <Animated.View style={[StyleSheet.absoluteFillObject, styles.fillClip, fillStyle]}>
            <LinearGradient
              colors={fillColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFillObject}
            />
          </Animated.View>

          {/* Label (above fill) */}
          <View style={styles.labelRow} pointerEvents="none">
            <Feather name={icon} size={16} color={colors.white} />
            <AppText style={styles.label}>{label}</AppText>
          </View>
        </Pressable>
      </Animated.View>

      {/* Confetti finale overlay — only when variant uses it. */}
      {onConfirmAnimation === 'confetti' && (showSuccess || confettiActive) ? (
        <View style={styles.celebrationOverlay} pointerEvents="none">
          {showSuccess ? <SuccessCheck reduceMotion={false} /> : null}
          <ConfettiBurst active={confettiActive} originX={0} originY={0} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  button: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    ...shadow.sm,
  },
  pressableInner: {
    paddingVertical: spacing[4],
    borderRadius: radius.xl,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fillClip: {
    overflow: 'hidden',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },
  label: {
    fontFamily: typography.sansSemiBold,
    fontSize: fontSize.base,
    color: colors.white,
  },
  celebrationOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
});
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: exit code 0. Note: if `Feather.glyphMap` typing causes issues, switch to `keyof typeof import('@expo/vector-icons').Feather.glyphMap` or simply `string` and document.

- [ ] **Step 3: Verify lint passes**

Run: `npm run lint`
Expected: no errors

- [ ] **Step 4: Smoke-test in isolation (optional but recommended)**

Mount the component temporarily in any screen (e.g., add it to the Profile tab as a sanity test):

```tsx
<HoldToConfirm
  label="Hold me"
  icon="check-circle"
  variant="success"
  onConfirm={() => console.log('confirmed')}
  onConfirmAnimation="confetti"
/>
```

- Run `npm run dev`, navigate, press-and-hold the button
- Confirm: fill animates left→right over 1.2s, releasing before 1.0 springs back, holding to completion fires the log and shows confetti + success check
- Remove the smoke-test mount before committing

- [ ] **Step 5: Commit**

```bash
git add src/components/common/HoldToConfirm.tsx
git commit -m "feat(common): add HoldToConfirm primitive with confetti or callback finale"
```

---

## Task 2: Wire `HoldToConfirm` into the bill detail screen

**Files:**
- Modify: `app/(modals)/bill/[id].tsx`

This task does three things in one file:
1. Removes the old `handleComplete`/`handleDelete` (with `Alert.alert`) and the action button Pressables.
2. Adds plain async API call functions.
3. Adds the destructive shake+dissolve finale: a Reanimated wrapper around the screen body driven by a shared value, triggered by the Delete button's `onConfirm`.
4. Renders two `<HoldToConfirm>` components.

- [ ] **Step 1: Add imports**

Add to the existing imports near the top of `app/(modals)/bill/[id].tsx`:

```tsx
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { HoldToConfirm } from '../../../src/components/common/HoldToConfirm';
```

(Keep all existing imports; just add these alongside.)

- [ ] **Step 2: Replace `handleComplete` and `handleDelete` with plain async functions**

Find the existing `handleComplete` function (lines ~110-136 in the pre-change file) and `handleDelete` function (lines ~138-158). Replace **both** with:

```tsx
  // Destructive finale: a shared value the Delete button drives via callback.
  // Sequence: shake the card horizontally, then fade+scale-down, then perform
  // the API call and navigate back.
  const dissolveProgress = useSharedValue(0);
  const shakeX = useSharedValue(0);

  const dissolveStyle = useAnimatedStyle(() => ({
    opacity: 1 - dissolveProgress.value,
    transform: [
      { translateX: shakeX.value },
      { scale: 1 - dissolveProgress.value * 0.08 },
    ],
  }));

  const handleCompleteAsync = async () => {
    setActionLoading(true);
    try {
      await updateBillStatus(bill.id, 'complete');
      setBill((prev) => prev ? { ...prev, status: 'complete' } : prev);
    } catch {
      Alert.alert('Error', 'Could not update bill status.');
    } finally {
      setActionLoading(false);
    }
  };

  // Declare in order: performDelete first so the runDeleteFinaleAndDelete
  // closure does not reference it before its declaration (lint rule
  // no-use-before-define would otherwise flag this).
  const performDelete = async () => {
    setActionLoading(true);
    try {
      const orgId = sessionUserId;
      await deleteBill(bill.id, orgId);
      await reload();
      router.back();
    } catch {
      // Restore the screen on error.
      dissolveProgress.value = withTiming(0, { duration: 200 });
      Alert.alert('Error', 'Could not delete bill.');
      setActionLoading(false);
    }
  };

  const runDeleteFinaleAndDelete = () => {
    // 60ms shake then 280ms dissolve, then API call, then router.back().
    shakeX.value = withSequence(
      withTiming(-8, { duration: 60, easing: Easing.linear }),
      withTiming(8,  { duration: 60, easing: Easing.linear }),
      withTiming(-6, { duration: 50, easing: Easing.linear }),
      withTiming(6,  { duration: 50, easing: Easing.linear }),
      withTiming(-3, { duration: 40, easing: Easing.linear }),
      withTiming(3,  { duration: 40, easing: Easing.linear }),
      withTiming(0,  { duration: 30, easing: Easing.linear }),
    );
    dissolveProgress.value = withTiming(
      1,
      { duration: 280, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(performDelete)();
      },
    );
  };

  const handleDeleteAsync = () => {
    runDeleteFinaleAndDelete();
  };
```

**Important:** `Alert` is already imported in this file. `setActionLoading`, `setBill`, `bill.id`, `sessionUserId`, `reload`, `updateBillStatus`, `deleteBill` are all already in scope from the existing component body.

- [ ] **Step 3: Wrap the screen body in `Animated.View` and add the dissolve style**

Find the existing return block (`return ( <View style={[styles.root, ...]}>`). Replace the outer `<View style={[styles.root, { paddingTop: insets.top }]}>` with:

```tsx
  return (
    <Animated.View style={[styles.root, { paddingTop: insets.top }, dissolveStyle]}>
```

And update the matching closing tag at the bottom of the JSX:

```tsx
      <PaymentReviewSheet
        participant={reviewing}
        currency={bill.currency}
        onClose={() => setReviewing(null)}
        onChanged={reload}
      />
    </Animated.View>
  );
```

(The PaymentReviewSheet must stay inside the dissolving wrapper, so it dissolves with the rest of the screen.)

- [ ] **Step 4: Replace the action buttons block**

Find the existing `{bill.status === 'active' && ( <View style={styles.actions}>` block (lines ~315-340 in the pre-change file). Replace the entire block with:

```tsx
        {bill.status === 'active' && (
          <View style={styles.actions}>
            <HoldToConfirm
              label="Hold to complete bill"
              icon="check-circle"
              variant="success"
              holdDuration={1200}
              onConfirm={handleCompleteAsync}
              onConfirmAnimation="confetti"
              disabled={actionLoading}
              accessibilityHint="Press and hold for 1.2 seconds to mark this bill complete"
            />
            <HoldToConfirm
              label="Hold to delete bill"
              icon="trash-2"
              variant="destructive"
              holdDuration={1500}
              onConfirm={handleDeleteAsync}
              onConfirmAnimation="shake-dissolve"
              disabled={actionLoading}
              accessibilityHint="Press and hold for 1.5 seconds to permanently delete this bill"
            />
          </View>
        )}
```

- [ ] **Step 5: Remove dead styles**

Now-unused style entries in the `styles` object at the bottom of the file:
- `completeBtn`
- `completeBtnText`
- `deleteBtn`
- `deleteBtnText`

Delete these four entries. Keep `actions` — it's still used as the gap container.

- [ ] **Step 6: Verify typecheck passes**

Run: `npm run typecheck`
Expected: exit code 0

- [ ] **Step 7: Verify lint passes**

Run: `npm run lint`
Expected: no errors. If lint complains about the unused `Alert` import after removal — it's still used by `Alert.alert('Error', ...)` in the error branches, so it stays.

- [ ] **Step 8: Manual web verification — Complete flow**

Run: `npm run dev`
- Sign in, open an active bill (or create one with 2 participants)
- Scroll to the bottom of the bill detail screen → see the green "Hold to complete bill" button
- Press and **release immediately** → fill springs back to 0, no action fires
- Press and **hold for 1.2s** → fill completes, confetti bursts, success check morphs in, bill status updates to "Completed", action buttons disappear
- The bill detail screen body should NOT shake or dissolve (that's only for delete)

- [ ] **Step 9: Manual web verification — Delete flow**

Run: `npm run dev`
- Open another active bill
- Scroll to the bottom → see the red "Hold to delete bill" button
- Press and **hold for 1.5s** → fill completes, the entire bill detail card **shakes briefly** (~400ms total) then **fades and scales down** over ~280ms, then `router.back()` fires and you return to the bills list
- The bill should be gone from the list (reload confirms)

- [ ] **Step 10: Manual web verification — Reduced motion fallback**

Open DevTools → Rendering → "Emulate CSS media feature prefers-reduced-motion: reduce" → reload the bill detail page.
- Both buttons should now show as plain tappable buttons (no hold mechanic)
- Tap "Hold to complete bill" → standard `Alert.alert` opens with Cancel/Confirm → confirming updates the status
- Tap "Hold to delete bill" → standard `Alert.alert` opens with Cancel/Delete → confirming deletes and navigates back

- [ ] **Step 11: Manual web verification — Error path**

To test the destructive error path without breaking the DB, temporarily modify `performDelete` to `throw new Error('test')` before the `await deleteBill` call. Hold to delete → confirm:
- Shake plays
- Dissolve animates to 100%
- API throws → dissolve reverses to 0 → Alert appears
- Revert the temporary throw

- [ ] **Step 12: Commit**

```bash
git add app/(modals)/bill/[id].tsx
git commit -m "feat(bill): replace tap-Alert buttons with HoldToConfirm + celebration/dissolve"
```

---

## Task 3: Final QA pass

**Files:** none modified

- [ ] **Step 1: Full repo typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: both pass with exit code 0

- [ ] **Step 2: Native sanity check (if device/simulator available)**

If iOS/Android simulator set up:
- Open the bill detail page
- Hold to complete — confirm haptics fire on press-in, on cancel-release, and on completion
- Hold to delete — confirm the same haptic feedback and the shake+dissolve animation runs at 60fps
- Confirm confetti + success check animate smoothly

If no simulator available, skip and note in PR description.

- [ ] **Step 3: No commit (verification-only task)**

If QA exposes a regression, fix in a follow-up commit.

---

## Notes for follow-up (out of scope of this plan)

- **HoldToConfirm reuse:** the primitive lives in `src/components/common/` for a reason — it's not bill-specific. Future candidates: confirming destructive actions on participants ("Remove from bill"), confirming sign-out (replace the immediate sign-out with a hold), confirming a payment rejection. Each is a separate consideration.
- **Confetti scope:** confetti currently fills only the bill detail card (its nearest positioned ancestor). If full-screen confetti is wanted, lift the celebration overlay into the root layout via a context. Defer until requested.
- **Per-bill animation speed:** the hold durations (1.2s success, 1.5s destructive) are tuned guesses. If users report them feeling too long/short during QA, adjust in one place per call site.
