import { useState, type PropsWithChildren, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppState } from '@/store/app-store';
import { radii, spacing, typography } from '@/theme/tokens';
import type { EntityStatus } from '@/types/domain';

export function AppScreen({ children, scroll = true }: PropsWithChildren<{ scroll?: boolean }>) {
  const { colors } = useAppState();
  const content = (
    <View style={[styles.content, { backgroundColor: colors.background }]}>{children}</View>
  );
  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.safe, { backgroundColor: colors.background }]}
    >
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {scroll ? (
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {content}
          </ScrollView>
        ) : (
          content
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function AppHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  const { colors } = useAppState();
  return (
    <View style={styles.header}>
      <View style={styles.grow}>
        {eyebrow ? <Text style={[styles.eyebrow, { color: colors.cyan }]}>{eyebrow}</Text> : null}
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>
        ) : null}
      </View>
      {action}
    </View>
  );
}
export function AppButton({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
}) {
  const { colors } = useAppState();
  const bg =
    variant === 'primary'
      ? colors.primary
      : variant === 'danger'
        ? colors.danger
        : variant === 'secondary'
          ? colors.surfaceRaised
          : 'transparent';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: bg,
          borderColor: variant === 'ghost' ? colors.border : bg,
          opacity: disabled ? 0.45 : pressed ? 0.78 : 1,
        },
      ]}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={18}
          color={variant === 'primary' || variant === 'danger' ? '#fff' : colors.text}
        />
      ) : null}
      <Text
        style={[
          styles.buttonText,
          { color: variant === 'primary' || variant === 'danger' ? '#fff' : colors.text },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function IconButton({
  icon,
  label,
  onPress,
  disabled = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors } = useAppState();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        {
          backgroundColor: colors.surfaceRaised,
          borderColor: colors.border,
          opacity: disabled ? 0.35 : pressed ? 0.7 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={21} color={colors.text} />
    </Pressable>
  );
}
export function AppTextField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  helper,
  error,
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  helper?: string;
  error?: string;
  multiline?: boolean;
}) {
  const { colors } = useAppState();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.text }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize="none"
        multiline={multiline}
        style={[
          styles.input,
          multiline && styles.multiline,
          {
            backgroundColor: colors.surface,
            borderColor: error ? colors.danger : colors.border,
            color: colors.text,
          },
        ]}
      />
      {error || helper ? (
        <Text style={[styles.helper, { color: error ? colors.danger : colors.textMuted }]}>
          {error ?? helper}
        </Text>
      ) : null}
    </View>
  );
}
export function PasswordField(props: Omit<Parameters<typeof AppTextField>[0], 'secureTextEntry'>) {
  const [hidden, setHidden] = useState(true);
  const { colors } = useAppState();
  return (
    <View>
      <AppTextField {...props} secureTextEntry={hidden} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={hidden ? `Show ${props.label}` : `Hide ${props.label}`}
        onPress={() => setHidden((value) => !value)}
        style={styles.passwordToggle}
      >
        <Ionicons
          name={hidden ? 'eye-outline' : 'eye-off-outline'}
          size={20}
          color={colors.textMuted}
        />
      </Pressable>
    </View>
  );
}
export function Surface({ children, style }: PropsWithChildren<{ style?: object }>) {
  const { colors } = useAppState();
  return (
    <View
      style={[
        styles.surface,
        { backgroundColor: colors.surface, borderColor: colors.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  const { colors } = useAppState();
  return (
    <View style={styles.sectionHeader}>
      <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text }]}>
        {title}
      </Text>
      {action}
    </View>
  );
}
export function StatusBadge({
  status,
  label,
}: {
  status:
    | EntityStatus
    | 'ACTIVE'
    | 'SUSPENDED'
    | 'DISABLED'
    | 'OPEN'
    | 'ACKNOWLEDGED'
    | 'RESOLVED'
    | 'SUPPORTED'
    | 'UNSUPPORTED'
    | 'REQUIRES_CONFIGURATION';
  label?: string;
}) {
  const { colors } = useAppState();
  const tone = ['ONLINE', 'ACTIVE', 'SUPPORTED', 'RESOLVED'].includes(status)
    ? colors.success
    : ['OFFLINE', 'DISABLED', 'OPEN'].includes(status)
      ? colors.danger
      : ['DEGRADED', 'SUSPENDED', 'REQUIRES_CONFIGURATION'].includes(status)
        ? colors.warning
        : colors.textMuted;
  return (
    <View style={[styles.badge, { backgroundColor: `${tone}22` }]}>
      <View style={[styles.dot, { backgroundColor: tone }]} />
      <Text style={[styles.badgeText, { color: tone }]}>
        {label ?? status.replaceAll('_', ' ')}
      </Text>
    </View>
  );
}
export function MetricCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone?: string;
}) {
  const { colors } = useAppState();
  return (
    <Surface style={styles.metric}>
      <View style={[styles.metricIcon, { backgroundColor: `${tone ?? colors.primary}22` }]}>
        <Ionicons name={icon} size={20} color={tone ?? colors.primary} />
      </View>
      <Text style={[styles.metricValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: colors.textMuted }]}>{label}</Text>
    </Surface>
  );
}
export function StateView({
  icon,
  title,
  message,
  action,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  action?: ReactNode;
}) {
  const { colors } = useAppState();
  return (
    <Surface style={styles.state}>
      <Ionicons name={icon} size={34} color={colors.primary} />
      <Text style={[styles.stateTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.stateMessage, { color: colors.textMuted }]}>{message}</Text>
      {action}
    </Surface>
  );
}
export const EmptyState = (props: Omit<Parameters<typeof StateView>[0], 'icon'>) => (
  <StateView icon="file-tray-outline" {...props} />
);
export const ErrorState = (props: Omit<Parameters<typeof StateView>[0], 'icon'>) => (
  <StateView icon="warning-outline" {...props} />
);
export function LoadingState({ label = 'Loading secure workspace…' }: { label?: string }) {
  const { colors } = useAppState();
  return (
    <View accessibilityRole="progressbar" style={styles.loading}>
      <ActivityIndicator color={colors.primary} />
      <Text style={{ color: colors.textMuted }}>{label}</Text>
    </View>
  );
}
export function FormSection({
  title,
  description,
  children,
}: PropsWithChildren<{ title: string; description?: string }>) {
  const { colors } = useAppState();
  return (
    <Surface>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      {description ? (
        <Text style={[styles.helper, { color: colors.textMuted }]}>{description}</Text>
      ) : null}
      <View style={styles.formChildren}>{children}</View>
    </Surface>
  );
}
export function SettingRow({
  icon,
  title,
  subtitle,
  value,
  onValueChange,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  value?: boolean;
  onValueChange?: (value: boolean) => void;
}) {
  const { colors } = useAppState();
  return (
    <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
      <Ionicons name={icon} size={21} color={colors.primary} />
      <View style={styles.grow}>
        <Text style={[styles.itemTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.helper, { color: colors.textMuted }]}>{subtitle}</Text>
      </View>
      {value !== undefined && onValueChange ? (
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: colors.border, true: colors.primary }}
        />
      ) : (
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flexGrow: 1 },
  content: { flex: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingTop: spacing.md,
  },
  grow: { flex: 1 },
  eyebrow: {
    fontSize: typography.caption,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  title: { fontSize: typography.display, lineHeight: 36, fontWeight: '800', letterSpacing: -0.8 },
  subtitle: { fontSize: typography.body, lineHeight: 22, marginTop: spacing.sm },
  button: {
    minHeight: 48,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
  },
  buttonText: { fontSize: typography.body, fontWeight: '700' },
  iconButton: {
    width: 46,
    height: 46,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  field: { gap: spacing.sm },
  passwordToggle: {
    position: 'absolute',
    right: 12,
    top: 39,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: { fontSize: typography.label, fontWeight: '700' },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    fontSize: typography.body,
  },
  multiline: { minHeight: 92, paddingTop: spacing.md, textAlignVertical: 'top' },
  helper: { fontSize: typography.label, lineHeight: 18 },
  surface: { borderWidth: 1, borderRadius: radii.lg, padding: spacing.lg },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: typography.heading, fontWeight: '800' },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    height: 27,
    borderRadius: radii.pill,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  metric: { flex: 1, minWidth: 140, gap: spacing.sm },
  metricIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: { fontSize: 26, fontWeight: '800' },
  metricLabel: { fontSize: typography.label },
  state: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm },
  stateTitle: { fontSize: typography.heading, fontWeight: '800', textAlign: 'center' },
  stateMessage: { fontSize: typography.body, lineHeight: 21, textAlign: 'center', maxWidth: 320 },
  loading: { minHeight: 160, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  formChildren: { gap: spacing.lg, marginTop: spacing.lg },
  settingRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemTitle: { fontSize: typography.body, fontWeight: '700' },
});
