import { useState, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { haptic, NotificationFeedbackType } from '../../lib/haptics';
import type { Participant } from '../../types';
import { colors, typography, fontSize, spacing, radius, shadow } from '../../theme/tokens';

const AVATAR_PALETTE = [
  '#4F46E5', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16',
];

function randomAvatarColor(): string {
  return AVATAR_PALETTE[Math.floor(Math.random() * AVATAR_PALETTE.length)] ?? '#4F46E5';
}

function formatPhone(raw: string): string {
  // Strip everything except digits and leading +
  const stripped = raw.replace(/[^\d+]/g, '');
  // Ensure Malaysian numbers start with country code
  if (stripped.startsWith('0') && stripped.length >= 10) {
    return '+6' + stripped;
  }
  return stripped;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onAdd: (participant: Participant) => void;
  existingNames: string[];
}

export function AddParticipantModal({ visible, onClose, onAdd, existingNames }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [nameError, setNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const insets = useSafeAreaInsets();
  const nameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);

  const validate = (): boolean => {
    let valid = true;
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Name is required');
      valid = false;
    } else if (trimmed.length < 2) {
      setNameError('Name must be at least 2 characters');
      valid = false;
    } else if (existingNames.some((n) => n.toLowerCase() === trimmed.toLowerCase())) {
      setNameError('A participant with this name already exists');
      valid = false;
    } else {
      setNameError('');
    }

    const trimmedPhone = phone.trim();
    if (trimmedPhone) {
      const digits = trimmedPhone.replace(/\D/g, '');
      if (digits.length < 7 || digits.length > 15) {
        setPhoneError('Enter a valid phone number');
        valid = false;
      } else {
        setPhoneError('');
      }
    } else {
      setPhoneError('');
    }

    return valid;
  };

  const handleAdd = () => {
    if (!validate()) {
      haptic.notification(NotificationFeedbackType.Error);
      return;
    }

    haptic.notification(NotificationFeedbackType.Success);

    const participant: Participant = {
      id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() ? formatPhone(phone.trim()) : undefined,
      amount: 0,
      isPaid: false,
      avatarColor: randomAvatarColor(),
    };

    onAdd(participant);
    setName('');
    setEmail('');
    setPhone('');
    setNameError('');
    setPhoneError('');
    onClose();
  };

  const handleClose = () => {
    setName('');
    setEmail('');
    setPhone('');
    setNameError('');
    setPhoneError('');
    onClose();
  };

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
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={styles.backdrop} onPress={handleClose} />

        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing[6]) }]}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>Add Participant</Text>
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
              <Text style={styles.label}>
                Name <Text style={styles.required}>*</Text>
              </Text>
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
              {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}
            </View>

            {/* Phone */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                Phone <Text style={styles.optional}>(for WhatsApp reminders)</Text>
              </Text>
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
              {phoneError ? <Text style={styles.errorText}>{phoneError}</Text> : null}
            </View>

            {/* Email */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                Email <Text style={styles.optional}>(optional)</Text>
              </Text>
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
              <Text style={styles.addBtnText}>Add Participant</Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius['3xl'],
    borderTopRightRadius: radius['3xl'],
    paddingTop: spacing[2],
    paddingHorizontal: spacing[4],
    maxHeight: '90%',
    ...shadow.lg,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.gray200,
    borderRadius: radius.full,
    alignSelf: 'center',
    marginBottom: spacing[5],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[6],
  },
  title: {
    fontFamily: typography.sansBold,
    fontSize: fontSize.lg,
    color: colors.textPrimary,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldGroup: {
    marginBottom: spacing[4],
  },
  label: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    marginBottom: spacing[1.5],
  },
  required: { color: colors.error },
  optional: {
    fontFamily: typography.sansRegular,
    color: colors.textSecondary,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.gray50,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing[3],
    height: 52,
  },
  inputError: {
    borderColor: colors.error,
    backgroundColor: colors.errorSurface,
  },
  input: {
    flex: 1,
    fontFamily: typography.sansRegular,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },
  errorText: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.xs,
    color: colors.error,
    marginTop: spacing[1],
    marginLeft: spacing[1],
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    height: 56,
    marginTop: spacing[2],
    marginBottom: spacing[2],
    ...shadow.lg,
  },
  addBtnText: {
    fontFamily: typography.sansSemiBold,
    fontSize: fontSize.base,
    color: colors.white,
  },
});
