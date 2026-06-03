# Web Modal Viewport Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop React Native `<Modal>` from escaping the 430px phone shell on web by converting each remaining Modal usage to a Platform-conditional pattern (in-tree `<View>` on web, RN `<Modal>` on native).

**Architecture:** Mirror the existing per-component pattern in `src/components/dashboard/BillDetailModal.tsx` lines 220-241. The web phone shell at `app/_layout.tsx` `styles.webPhone` has `overflow: 'hidden'`, so any `position: absolute` child rendered in-tree is naturally constrained to the shell. No new portal infrastructure required. Adds a small shared `useWebEscape` hook so the web branch can wire `Escape` key dismissal where appropriate.

**Tech Stack:** Expo SDK 51, React Native 0.74, react-native-web ~0.19.10, TypeScript, expo-router. Project conventions: paths use backslash on disk but forward slash in plan; tests via Jest but UI components in this codebase have no unit tests — verification is `npm run typecheck` + `npm run lint` + manual web QA.

**Spec:** `docs/superpowers/specs/2026-06-03-share-flow-buttons-modal-fix-design.md` § Project C.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/hooks/useWebEscape.ts` | Create | Shared hook: on web, register a `keydown` listener that fires `onClose` when `Escape` is pressed while `enabled` is true. No-op on native. |
| `src/components/bill/BillCreatedSheet.tsx` | Modify | Wrap the `<Modal>` with `Platform.OS === 'web' ? <View>...</View> : <Modal>...</Modal>`. No Escape (auto-advance UX). |
| `src/components/profile/SignOutOverlay.tsx` | Modify | Same wrap. No Escape (overlay has no manual close). |
| `src/components/payment/PaymentReviewSheet.tsx` | Modify | Wrap **both** Modals (lines 87 and 164). Wire Escape on both. |
| `src/components/create/CurrencySelector.tsx` | Modify | Wrap the Modal. Wire Escape. |
| `src/components/create/AddParticipantModal.tsx` | Modify | Wrap the Modal. Wire Escape. KeyboardAvoidingView is a no-op on web, no behavioral change. |
| `app/(tabs)/profile.tsx` | Modify | Wrap **both** Modals (display name editor line 379, currency picker line 418). Wire Escape on both. |

Native behavior must be byte-identical to today. Each task isolates one file so it can be reviewed/reverted independently.

---

## Task 1: Add `useWebEscape` shared hook

**Files:**
- Create: `src/hooks/useWebEscape.ts`

- [ ] **Step 1: Write the hook**

Create `src/hooks/useWebEscape.ts`:

```ts
import { useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * On web, registers a `keydown` listener that calls `onClose()` when
 * the Escape key is pressed while `enabled` is true. No-op on native
 * (RN Modal already handles Android back via `onRequestClose`).
 */
export function useWebEscape(enabled: boolean, onClose: () => void): void {
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [enabled, onClose]);
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: `Successfully compiled. No errors.` (or similar — exit code 0)

- [ ] **Step 3: Verify lint passes**

Run: `npm run lint`
Expected: no errors on the new file

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useWebEscape.ts
git commit -m "feat(hooks): add useWebEscape for web modal Escape key dismissal"
```

---

## Task 2: Convert `SignOutOverlay.tsx`

**Files:**
- Modify: `src/components/profile/SignOutOverlay.tsx:124-162`

**Why no Escape:** the overlay is shown during sign-out and dismisses automatically once the auth flow completes. The user has no way to cancel.

- [ ] **Step 1: Locate the current Modal block**

The render starts at line 123 with:

```tsx
return (
  <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
    <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]} pointerEvents="none">
      ...
    </Animated.View>
    <View style={styles.center} pointerEvents="none">
      ...
    </View>
  </Modal>
);
```

- [ ] **Step 2: Refactor to extract the content into a variable**

Replace the return block with:

```tsx
  const content = (
    <>
      <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]} pointerEvents="none">
        <BlurView
          intensity={Platform.OS === 'web' ? 20 : 30}
          tint="dark"
          style={[StyleSheet.absoluteFill, styles.blurOverlay]}
        />
      </Animated.View>

      <View style={styles.center} pointerEvents="none">
        <Animated.View style={contentStyle}>
          {/* ── Spinner rings ── */}
          <View style={styles.spinnerWrap}>
            <Animated.View style={[styles.ring, styles.ringOuter, r3Style]} />
            <Animated.View style={[styles.ring, styles.ringMid, r2Style]} />
            <Animated.View style={[styles.ring, styles.ringInner, r1Style]} />
            <Animated.View style={[styles.centerCircle, logoStyle]}>
              <Image source={require('../../../assets/logo_v2.png')} style={styles.logo} />
            </Animated.View>
          </View>

          {/* ── Label + dots ── */}
          <View style={styles.textRow}>
            <AppText style={styles.label}>Signing out</AppText>
            <Animated.Text style={[styles.dot, d1]}>.</Animated.Text>
            <Animated.Text style={[styles.dot, d2]}>.</Animated.Text>
            <Animated.Text style={[styles.dot, d3]}>.</Animated.Text>
          </View>
        </Animated.View>
      </View>
    </>
  );

  if (Platform.OS === 'web') {
    if (!visible) return null;
    return (
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        {content}
      </View>
    );
  }

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
      {content}
    </Modal>
  );
```

(`Platform` is already imported at the top of the file. Do not re-import.)

- [ ] **Step 3: Verify typecheck passes**

Run: `npm run typecheck`
Expected: exit code 0

- [ ] **Step 4: Verify lint passes**

Run: `npm run lint`
Expected: no errors on this file

- [ ] **Step 5: Manual web verification**

Run: `npm run dev`
- Open the app in a browser
- Navigate to Profile tab
- Tap Sign Out
- Confirm the spinner overlay is centred within the 430px phone column (not the full browser viewport)
- Confirm the dark blurred backdrop only covers the phone column area

- [ ] **Step 6: Commit**

```bash
git add src/components/profile/SignOutOverlay.tsx
git commit -m "fix(profile): constrain SignOutOverlay to phone shell on web"
```

---

## Task 3: Convert `BillCreatedSheet.tsx`

**Files:**
- Modify: `src/components/bill/BillCreatedSheet.tsx:195-322`

**Why no Escape:** the sheet auto-dismisses through its share / view-bill / create-another actions. There is no neutral "X" close button to map Escape to.

- [ ] **Step 1: Refactor the return block to extract content**

Replace lines 195-322 (the `return (` block through `</Modal>`) with:

```tsx
  const content = (
    <View style={styles.root} accessibilityViewIsModal>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => dismissWithAnimation(onViewBill)}
        accessibilityLabel="Close and view bill"
      >
        <Animated.View style={[styles.backdrop, backdropStyle]} />
      </Pressable>

      <Animated.View
        style={[styles.card, cardStyle]}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        accessibilityLabel="Bill created successfully"
      >
        <ConfettiBurst
          active={confettiActive}
          reduceMotion={reduceMotion}
          originX={170}
          originY={36}
        />

        <SuccessCheck
          reduceMotion={reduceMotion}
          onPulseStart={() => {
            if (!reduceMotion) setConfettiActive(true);
          }}
        />

        <Animated.View entering={enteringTitle} style={styles.textBlock}>
          <AppText style={styles.title}>Bill created! 🎉</AppText>
        </Animated.View>

        <Animated.View entering={enteringSub}>
          <AppText style={styles.subtitle}>
            &ldquo;{bill.title}&rdquo; is ready to share
          </AppText>
        </Animated.View>

        <Animated.View entering={enteringChip} style={styles.chip}>
          <AppText style={styles.chipLine1}>
            {formatBillAmount(bill.totalAmount, bill.currency)} · {peopleLabel}
          </AppText>
          {dueLabel ? <AppText style={styles.chipLine2}>{dueLabel}</AppText> : null}
          {recurringLabel ? (
            <View style={styles.recurringPill}>
              <AppText style={styles.recurringText}>🔁 {recurringLabel}</AppText>
            </View>
          ) : null}
        </Animated.View>

        <View style={styles.actions}>
          <Animated.View entering={enteringBtnPrimary} style={styles.actionItem}>
            <Pressable
              onPress={handleShare}
              disabled={!canShare || sharing || dismissing}
              style={({ pressed }) => [
                styles.primaryWrap,
                pressed && canShare && styles.primaryPressed,
                (!canShare || sharing) && styles.primaryDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Share payment link"
              accessibilityState={{ disabled: !canShare || sharing }}
            >
              <LinearGradient
                colors={[SUCCESS_TOKENS.indigo, SUCCESS_TOKENS.indigoDeep]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primaryBtn}
              >
                {sharing ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Feather name="link-2" size={18} color="#fff" />
                    <AppText style={styles.primaryLabel}>Share payment link</AppText>
                  </>
                )}
              </LinearGradient>
            </Pressable>

            {!canShare && (
              <AppText style={styles.syncHint}>
                Link available once synced.
              </AppText>
            )}
          </Animated.View>

          <Animated.View entering={enteringBtnSecondary} style={styles.actionItem}>
            <Pressable
              onPress={() => dismissWithAnimation(onViewBill)}
              disabled={dismissing}
              style={({ pressed }) => [
                styles.secondaryBtn,
                pressed && styles.secondaryPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="View bill"
            >
              <AppText style={styles.secondaryLabel}>View bill</AppText>
            </Pressable>
          </Animated.View>

          <Animated.View entering={enteringBtnTertiary}>
            <Pressable
              onPress={() => dismissWithAnimation(onCreateAnother)}
              disabled={dismissing}
              style={styles.tertiaryBtn}
              accessibilityRole="button"
              accessibilityLabel="Create another bill"
            >
              <AppText style={styles.tertiaryLabel}>Create another</AppText>
            </Pressable>
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );

  if (Platform.OS === 'web') {
    if (!visible) return null;
    return (
      <View style={StyleSheet.absoluteFillObject} pointerEvents="auto">
        {content}
      </View>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => dismissWithAnimation(onViewBill)}
    >
      {content}
    </Modal>
  );
```

(`Platform` is already imported via `Platform.select` usage at the top.)

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: exit code 0

- [ ] **Step 3: Verify lint passes**

Run: `npm run lint`
Expected: no errors on this file

- [ ] **Step 4: Manual web verification**

Run: `npm run dev`
- Open the app in a browser, sign in
- Tap the + tab to create a bill
- Fill the minimal fields (title, an amount, one participant), submit
- After save, the success sheet should appear **inside the 430px phone column** with confetti
- Tap "View bill" → sheet dismisses
- Tap backdrop → sheet dismisses

- [ ] **Step 5: Commit**

```bash
git add src/components/bill/BillCreatedSheet.tsx
git commit -m "fix(bill): constrain BillCreatedSheet to phone shell on web"
```

---

## Task 4: Convert `CurrencySelector.tsx`

**Files:**
- Modify: `src/components/create/CurrencySelector.tsx:62-109`

- [ ] **Step 1: Import the Escape hook**

Add to the existing imports at top of file:

```tsx
import { Platform } from 'react-native';
import { useWebEscape } from '../../hooks/useWebEscape';
```

Update the existing `react-native` import to add `Platform`:

```tsx
import {
  View,
  Pressable,
  Modal,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
```

- [ ] **Step 2: Wire the Escape hook**

Inside the `CurrencySelector` component body, after the `const handleSelect = ...` declaration (line 36-40), add:

```tsx
  useWebEscape(open, () => setOpen(false));
```

- [ ] **Step 3: Wrap the Modal block**

Replace lines 62-109 (the `<Modal>` ... `</Modal>` block) with:

```tsx
      {(() => {
        const sheetContent = (
          <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
            <View
              style={[styles.sheet, { paddingBottom: insets.bottom + spacing[4], maxHeight: SCREEN_HEIGHT * 0.82 }]}
              onStartShouldSetResponder={() => true}
            >
              <View style={styles.handle} />

              <AppText style={styles.sheetTitle}>Select Currency</AppText>

              <FlatList
                data={SUPPORTED_CURRENCIES}
                keyExtractor={(item) => item}
                style={styles.list}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.option, item === value && styles.optionSelected]}
                    onPress={() => handleSelect(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.optionLeft}>
                      <View style={styles.symbolWrap}>
                        <AppText style={styles.optionSymbol}>{CURRENCY_SYMBOLS[item]}</AppText>
                      </View>
                      <View>
                        <AppText style={styles.optionCode}>{item}</AppText>
                        <AppText style={styles.optionLabel}>{CURRENCY_LABELS[item]}</AppText>
                      </View>
                    </View>
                    {item === value && (
                      <Feather name="check" size={18} color={gc.primary} />
                    )}
                  </TouchableOpacity>
                )}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                showsVerticalScrollIndicator={false}
                bounces={false}
              />
            </View>
          </Pressable>
        );

        if (Platform.OS === 'web') {
          if (!open) return null;
          return (
            <View style={StyleSheet.absoluteFillObject} pointerEvents="auto">
              {sheetContent}
            </View>
          );
        }

        return (
          <Modal
            visible={open}
            transparent
            animationType="slide"
            onRequestClose={() => setOpen(false)}
            statusBarTranslucent
          >
            {sheetContent}
          </Modal>
        );
      })()}
```

- [ ] **Step 4: Verify typecheck passes**

Run: `npm run typecheck`
Expected: exit code 0

- [ ] **Step 5: Verify lint passes**

Run: `npm run lint`
Expected: no errors

- [ ] **Step 6: Manual web verification**

Run: `npm run dev`
- Open the create-bill screen
- Tap the currency chip → sheet slides up **inside** the phone column
- Press `Escape` → sheet closes
- Re-open, tap backdrop → sheet closes
- Re-open, tap a currency → sheet closes and chip updates

- [ ] **Step 7: Commit**

```bash
git add src/components/create/CurrencySelector.tsx
git commit -m "fix(create): constrain CurrencySelector to phone shell on web"
```

---

## Task 5: Convert `AddParticipantModal.tsx`

**Files:**
- Modify: `src/components/create/AddParticipantModal.tsx:125-247`

- [ ] **Step 1: Add the Escape hook import**

Add to existing imports near the top:

```tsx
import { useWebEscape } from '../../hooks/useWebEscape';
```

(`Platform` is already imported.)

- [ ] **Step 2: Wire the Escape hook**

Inside the `AddParticipantModal` component body, just before the `return` statement (around line 125), add:

```tsx
  useWebEscape(visible, handleClose);
```

- [ ] **Step 3: Refactor the return block to be Platform-conditional**

Replace lines 125-248 (the entire `return ( <Modal ...>` through `</Modal>);`) with:

```tsx
  const content = (
    <KeyboardAvoidingView
      style={styles.overlay}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Pressable style={styles.backdrop} onPress={handleClose} />

      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing[6]) }]}>
        <View style={styles.handle} />

        <View style={styles.header}>
          <AppText style={styles.title}>Add Participant</AppText>
          <Pressable
            onPress={handleClose}
            style={styles.closeBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="x" size={20} color={colors.textSecondary} />
          </Pressable>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Name */}
          <View style={styles.fieldGroup}>
            <AppText style={styles.label}>
              Name <AppText style={styles.required}>*</AppText>
            </AppText>
            <View style={[styles.inputWrapper, nameError ? styles.inputError : null]}>
              <Feather name="user" size={16} color={nameError ? colors.error : colors.gray400} />
              <TextInput
                ref={nameRef}
                style={styles.input}
                value={name}
                onChangeText={(v) => {
                  setName(v);
                  if (nameError) setNameError('');
                }}
                placeholder="e.g. Sarah Lim"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => phoneRef.current?.focus()}
                maxLength={60}
              />
            </View>
            {nameError ? <AppText style={styles.errorText}>{nameError}</AppText> : null}
          </View>

          {/* Phone */}
          <View style={styles.fieldGroup}>
            <AppText style={styles.label}>
              Phone <AppText style={styles.optional}>(for WhatsApp reminders)</AppText>
            </AppText>
            <View style={[styles.inputWrapper, phoneError ? styles.inputError : null]}>
              <Feather name="phone" size={16} color={phoneError ? colors.error : colors.gray400} />
              <TextInput
                ref={phoneRef}
                style={styles.input}
                value={phone}
                onChangeText={(v) => {
                  setPhone(v);
                  if (phoneError) setPhoneError('');
                }}
                placeholder="e.g. 0123456789 or +60123456789"
                placeholderTextColor={colors.textTertiary}
                keyboardType="phone-pad"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
                maxLength={20}
              />
            </View>
            {phoneError ? <AppText style={styles.errorText}>{phoneError}</AppText> : null}
          </View>

          {/* Email */}
          <View style={styles.fieldGroup}>
            <AppText style={styles.label}>
              Email <AppText style={styles.optional}>(optional)</AppText>
            </AppText>
            <View style={styles.inputWrapper}>
              <Feather name="mail" size={16} color={colors.gray400} />
              <TextInput
                ref={emailRef}
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="sarah@example.com"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleAdd}
                maxLength={100}
              />
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.9 }]}
            onPress={handleAdd}
          >
            <Feather name="user-plus" size={18} color={colors.white} />
            <AppText style={styles.addBtnText}>Add Participant</AppText>
          </Pressable>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );

  if (Platform.OS === 'web') {
    if (!visible) return null;
    return (
      <View style={StyleSheet.absoluteFillObject} pointerEvents="auto">
        {content}
      </View>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      onShow={() => {
        setTimeout(() => nameRef.current?.focus(), 100);
      }}
    >
      {content}
    </Modal>
  );
```

**Note:** the `onShow` autofocus is RN-Modal-only. On web, the focus will not auto-trigger via this path. If autofocus on web is needed, add a `useEffect(() => { if (visible && Platform.OS === 'web') setTimeout(() => nameRef.current?.focus(), 100); }, [visible]);` — leave out for now and see if QA flags it.

- [ ] **Step 4: Verify typecheck passes**

Run: `npm run typecheck`
Expected: exit code 0

- [ ] **Step 5: Verify lint passes**

Run: `npm run lint`
Expected: no errors

- [ ] **Step 6: Manual web verification**

Run: `npm run dev`
- Open create-bill screen
- Tap "Add participant" → sheet slides up **inside** the phone column
- Press `Escape` → sheet closes
- Re-open, tap backdrop → sheet closes
- Re-open, fill name, tap "Add Participant" → participant added, sheet closes

- [ ] **Step 7: Commit**

```bash
git add src/components/create/AddParticipantModal.tsx
git commit -m "fix(create): constrain AddParticipantModal to phone shell on web"
```

---

## Task 6: Convert `PaymentReviewSheet.tsx` (both Modals)

**Files:**
- Modify: `src/components/payment/PaymentReviewSheet.tsx:85-174`

This file has **two** Modals: the review sheet (line 87) and the image viewer (line 164). Both need converting and both need Escape.

- [ ] **Step 1: Add Platform + Escape hook imports**

Update the existing `react-native` import to add `Platform`:

```tsx
import {
  Modal, View, StyleSheet, Pressable, ActivityIndicator, TextInput, Alert, Image, Platform,
} from 'react-native';
```

Add the hook import:

```tsx
import { useWebEscape } from '../../hooks/useWebEscape';
```

- [ ] **Step 2: Wire two Escape hooks**

The sheet is shown whenever `participant` is non-null; the viewer is shown whenever `viewerUrl` is non-null. Inside the component, after the existing effects (after the `if (!participant) return null;` early-return at line 51), add:

```tsx
  useWebEscape(!!participant, onClose);
  useWebEscape(!!viewerUrl, () => setViewerUrl(null));
```

**Order matters:** place these **before** the `if (!participant) return null;` check — hooks must run unconditionally. The `enabled` flag guards behavior. Move both `useWebEscape` calls to just before the existing `if (!participant) return null;` line.

Actually — the calls must precede the early return. Place them right after the existing `useEffect` block that resets `rejectMode/reason/busy` (around line 49). The full sequence becomes:

```tsx
  useEffect(() => {
    if (!participant) {
      setRejectMode(false);
      setReason('');
      setBusy(null);
    }
  }, [participant?.id]);

  useWebEscape(!!participant, onClose);
  useWebEscape(!!viewerUrl, () => setViewerUrl(null));

  if (!participant) return null;
```

- [ ] **Step 3: Refactor the return block**

Replace lines 85-175 (the `return (` through `);`) with:

```tsx
  const reviewSheet = (
    <Pressable style={styles.backdrop} onPress={onClose}>
      <Pressable style={styles.sheet} onPress={() => {}}>
        <View style={styles.handle} />
        <AppText style={styles.title}>Review payment</AppText>
        <AppText style={styles.subtitle}>
          {participant.name} • {symbol}{participant.amount.toFixed(2)}
        </AppText>

        <AISummaryBanner
          proofUrl={participant.proofUrl}
          proofSummary={participant.proofSummary}
          proofExtracted={participant.proofExtracted}
          onImageTap={setViewerUrl}
        />

        {participant.submittedAt && (
          <AppText style={styles.meta}>
            Submitted {new Date(participant.submittedAt).toLocaleString()}
          </AppText>
        )}

        {!rejectMode ? (
          <View style={styles.actions}>
            <Pressable
              style={[styles.btn, styles.rejectBtn]}
              onPress={() => setRejectMode(true)}
              disabled={busy !== null}
            >
              <Feather name="x" size={18} color="#DC2626" />
              <AppText style={[styles.btnText, { color: '#DC2626' }]}>Reject</AppText>
            </Pressable>
            <Animated.View style={[{ flex: 1 }, approveAnimatedStyle]}>
              <Pressable
                style={[styles.btn, styles.approveBtn]}
                onPress={handleApprove}
                disabled={busy !== null}
              >
                {busy === 'approve'
                  ? <ActivityIndicator color="#FFF" />
                  : <>
                      <Feather name="check" size={18} color="#FFF" />
                      <AppText style={[styles.btnText, { color: '#FFF' }]}>Approve</AppText>
                    </>}
              </Pressable>
            </Animated.View>
          </View>
        ) : (
          <View style={styles.rejectBlock}>
            <AppText style={styles.rejectLabel}>Reason</AppText>
            <TextInput
              style={styles.rejectInput}
              placeholder="e.g. Amount looks short, try again"
              value={reason}
              onChangeText={setReason}
              multiline
            />
            <View style={styles.actions}>
              <Pressable style={[styles.btn, styles.cancelBtn]} onPress={() => setRejectMode(false)}>
                <AppText style={[styles.btnText, { color: colors.textSecondary }]}>Cancel</AppText>
              </Pressable>
              <Pressable
                style={[styles.btn, styles.rejectConfirmBtn]}
                onPress={handleReject}
                disabled={busy !== null}
              >
                {busy === 'reject'
                  ? <ActivityIndicator color="#FFF" />
                  : <AppText style={[styles.btnText, { color: '#FFF' }]}>Send rejection</AppText>}
              </Pressable>
            </View>
          </View>
        )}
      </Pressable>
    </Pressable>
  );

  const imageViewer = viewerUrl ? (
    <Pressable style={styles.viewerBackdrop} onPress={() => setViewerUrl(null)}>
      <Image source={{ uri: viewerUrl }} style={styles.viewerImage} resizeMode="contain" />
      <Pressable onPress={() => setViewerUrl(null)} style={styles.viewerClose}>
        <Feather name="x" size={24} color="#FFF" />
      </Pressable>
    </Pressable>
  ) : null;

  if (Platform.OS === 'web') {
    return (
      <>
        <View style={StyleSheet.absoluteFillObject} pointerEvents="auto">
          {reviewSheet}
        </View>
        {viewerUrl && (
          <View style={StyleSheet.absoluteFillObject} pointerEvents="auto">
            {imageViewer}
          </View>
        )}
      </>
    );
  }

  return (
    <>
      <Modal animationType="slide" transparent onRequestClose={onClose}>
        {reviewSheet}
      </Modal>

      <Modal visible={!!viewerUrl} transparent animationType="fade" onRequestClose={() => setViewerUrl(null)}>
        {imageViewer}
      </Modal>
    </>
  );
```

- [ ] **Step 4: Verify typecheck passes**

Run: `npm run typecheck`
Expected: exit code 0

- [ ] **Step 5: Verify lint passes**

Run: `npm run lint`
Expected: no errors

- [ ] **Step 6: Manual web verification**

Run: `npm run dev`
- Open a bill detail screen with a participant who has submitted a proof
- Tap that participant → review sheet slides up inside the phone column
- Tap the proof image thumbnail → image viewer opens inside the phone column
- Press `Escape` → image viewer closes (review sheet remains visible)
- Press `Escape` again → review sheet closes
- Re-open, tap backdrop → review sheet closes
- Re-open, tap "Reject" → text input appears, type a reason, tap "Send rejection" → API call fires

- [ ] **Step 7: Commit**

```bash
git add src/components/payment/PaymentReviewSheet.tsx
git commit -m "fix(payment): constrain PaymentReviewSheet + image viewer to phone shell on web"
```

---

## Task 7: Convert profile.tsx display name editor Modal

**Files:**
- Modify: `app/(tabs)/profile.tsx:379-415`

- [ ] **Step 1: Add Escape hook import**

Add to the existing top-of-file imports:

```tsx
import { useWebEscape } from '../../src/hooks/useWebEscape';
```

(`Platform` is already imported via the existing `react-native` import block — verify around line 10.)

- [ ] **Step 2: Wire Escape hook for the name editor**

Find the component body of `ProfileScreen` and locate where `editingName` state is defined. After all hook calls and before the `return`, add:

```tsx
  useWebEscape(editingName, () => setEditingName(false));
```

- [ ] **Step 3: Refactor the name editor Modal**

Replace lines 379-415 (the `{/* Display name editor */}` block through `</Modal>`) with:

```tsx
      {/* Display name editor */}
      {(() => {
        const nameContent = (
          <Pressable style={styles.modalBackdrop} onPress={() => setEditingName(false)}>
            <Pressable style={[styles.modalCard, { backgroundColor: c.surface }]} onPress={() => {}}>
              <AppText style={[styles.modalTitle, { color: c.textPrimary }]}>Display name</AppText>
              <AppText style={[styles.modalSub, { color: c.textSecondary }]}>
                Shown to people you split bills with.
              </AppText>
              <TextInput
                value={nameDraft}
                onChangeText={setNameDraft}
                placeholder="Your name"
                placeholderTextColor={c.textTertiary}
                autoFocus
                maxLength={50}
                style={[styles.modalInput, { borderColor: c.border, color: c.textPrimary }]}
                onSubmitEditing={saveDisplayName}
                returnKeyType="done"
              />
              <View style={styles.modalRow}>
                <Pressable style={styles.modalBtnGhost} onPress={() => setEditingName(false)}>
                  <AppText style={[styles.modalBtnText, { color: c.textSecondary }]}>Cancel</AppText>
                </Pressable>
                <Pressable
                  style={[styles.modalBtnPrimary, { backgroundColor: colors.primary }]}
                  onPress={saveDisplayName}
                >
                  <AppText style={[styles.modalBtnText, { color: colors.white }]}>Save</AppText>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        );

        if (Platform.OS === 'web') {
          if (!editingName) return null;
          return (
            <View style={StyleSheet.absoluteFillObject} pointerEvents="auto">
              {nameContent}
            </View>
          );
        }

        return (
          <Modal
            visible={editingName}
            transparent
            animationType="fade"
            onRequestClose={() => setEditingName(false)}
          >
            {nameContent}
          </Modal>
        );
      })()}
```

- [ ] **Step 4: Verify typecheck passes**

Run: `npm run typecheck`
Expected: exit code 0

- [ ] **Step 5: Verify lint passes**

Run: `npm run lint`
Expected: no errors

- [ ] **Step 6: Manual web verification**

Run: `npm run dev`
- Open Profile tab
- Tap the display name row → modal appears **inside** the phone column
- Press `Escape` → modal closes
- Re-open, type a new name, press Enter → modal closes, name saved
- Re-open, tap backdrop → modal closes

- [ ] **Step 7: Commit**

```bash
git add app/(tabs)/profile.tsx
git commit -m "fix(profile): constrain display name editor modal to phone shell on web"
```

---

## Task 8: Convert profile.tsx currency picker Modal

**Files:**
- Modify: `app/(tabs)/profile.tsx:418-463`

- [ ] **Step 1: Wire Escape hook**

Below the previous `useWebEscape(editingName, ...)` call from Task 7, add:

```tsx
  useWebEscape(pickingCurrency, () => setPickingCurrency(false));
```

- [ ] **Step 2: Refactor the currency picker Modal**

Replace the `{/* Currency picker */}` block (lines 418-463 in the pre-change file) with:

```tsx
      {/* Currency picker */}
      {(() => {
        const currencyContent = (
          <Pressable style={styles.modalBackdrop} onPress={() => setPickingCurrency(false)}>
            <Pressable style={[styles.modalCard, { backgroundColor: c.surface }]} onPress={() => {}}>
              <AppText style={[styles.modalTitle, { color: c.textPrimary }]}>Default currency</AppText>
              <AppText style={[styles.modalSub, { color: c.textSecondary }]}>
                Used as the default when you create a new bill.
              </AppText>
              <View style={styles.currencyList}>
                {SUPPORTED_CURRENCIES.map((cur, i) => {
                  const isActive = cur === defaultCurrency;
                  return (
                    <Pressable
                      key={cur}
                      onPress={() => selectCurrency(cur)}
                      style={[
                        styles.currencyRow,
                        i !== SUPPORTED_CURRENCIES.length - 1 && {
                          borderBottomWidth: StyleSheet.hairlineWidth,
                          borderBottomColor: c.divider,
                        },
                      ]}
                    >
                      <View style={[styles.currencyBadge, { backgroundColor: c.primarySurface }]}>
                        <AppText style={[styles.currencySymbol, { color: colors.primary }]}>
                          {CURRENCY_SYMBOLS[cur]}
                        </AppText>
                      </View>
                      <View style={styles.currencyTextWrap}>
                        <AppText style={[styles.currencyName, { color: c.textPrimary }]}>
                          {CURRENCY_LABELS[cur]}
                        </AppText>
                        <AppText style={[styles.currencyCode, { color: c.textSecondary }]}>{cur}</AppText>
                      </View>
                      {isActive && <Feather name="check" size={18} color={colors.primary} />}
                    </Pressable>
                  );
                })}
              </View>
            </Pressable>
          </Pressable>
        );

        if (Platform.OS === 'web') {
          if (!pickingCurrency) return null;
          return (
            <View style={StyleSheet.absoluteFillObject} pointerEvents="auto">
              {currencyContent}
            </View>
          );
        }

        return (
          <Modal
            visible={pickingCurrency}
            transparent
            animationType="fade"
            onRequestClose={() => setPickingCurrency(false)}
          >
            {currencyContent}
          </Modal>
        );
      })()}
```

- [ ] **Step 3: Verify typecheck passes**

Run: `npm run typecheck`
Expected: exit code 0

- [ ] **Step 4: Verify lint passes**

Run: `npm run lint`
Expected: no errors

- [ ] **Step 5: Manual web verification**

Run: `npm run dev`
- Open Profile tab
- Tap the default currency row → modal appears inside the phone column
- Press `Escape` → modal closes
- Re-open, tap a currency → modal closes, currency updates
- Re-open, tap backdrop → modal closes

- [ ] **Step 6: Commit**

```bash
git add app/(tabs)/profile.tsx
git commit -m "fix(profile): constrain currency picker modal to phone shell on web"
```

---

## Task 9: Final full-suite manual QA

**Files:** none modified

- [ ] **Step 1: Web QA pass**

Run: `npm run dev`

Walk through every flow that opens a modal/sheet and confirm all stay within the 430px phone column:

- [ ] Create-bill flow → AddParticipantModal opens inside the column
- [ ] Create-bill flow → CurrencySelector opens inside the column
- [ ] Submit a bill → BillCreatedSheet appears inside the column with confetti
- [ ] Bill detail (existing fix, sanity check) → BillDetailModal opens inside the column
- [ ] Bill detail with a submitted proof → PaymentReviewSheet opens inside the column
- [ ] Inside PaymentReviewSheet, tap the proof image → image viewer opens inside the column
- [ ] Profile → Sign Out → SignOutOverlay covers the column only
- [ ] Profile → Edit display name → modal inside the column
- [ ] Profile → Change default currency → modal inside the column

- [ ] **Step 2: Native sanity check (if device available)**

If iOS/Android simulator is set up, run `npm run ios` or `npm run android` and confirm every modal still opens, animates, and dismisses identically to before. The native code path is unchanged so this should be a no-op, but verify.

If no simulator available, skip and note in PR description: "native code path unchanged, not retested on device."

- [ ] **Step 3: Typecheck + lint full repo**

Run: `npm run typecheck && npm run lint`
Expected: both pass with exit code 0

- [ ] **Step 4: No commit (verification-only task)**

If QA exposes a regression in any of the 7 files, fix it in a small follow-up commit referencing the affected task number.
