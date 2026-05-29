import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, radius } from '../../theme/tokens';
import type { Participant } from '../../types';

interface AvatarStackProps {
  people: Participant[];
  size?: number;
  max?: number;
}

export function AvatarStack({ people, size = 28, max = 5 }: AvatarStackProps) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;

  return (
    <View style={styles.row}>
      {shown.map((person, index) => {
        const bg = person.avatarColor || colors.avatar[index % colors.avatar.length];
        return (
          <View
            key={person.id}
            style={[
              styles.avatar,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: bg,
                marginLeft: index === 0 ? 0 : -8,
              },
            ]}
          >
            <Text
              style={[
                styles.initial,
                { fontSize: Math.round(size * 0.4) },
              ]}
            >
              {person.name.charAt(0).toUpperCase()}
            </Text>
          </View>
        );
      })}
      {extra > 0 && (
        <View
          style={[
            styles.avatar,
            styles.extraChip,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              marginLeft: -8,
            },
          ]}
        >
          <Text style={[styles.initial, styles.extraText, { fontSize: Math.round(size * 0.38) }]}>
            +{extra}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
  },
  initial: {
    fontFamily: typography.sansBold,
    color: colors.white,
  },
  extraChip: {
    backgroundColor: colors.gray300,
  },
  extraText: {
    color: colors.gray700,
  },
});
