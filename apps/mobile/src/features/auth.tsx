import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  AppButton,
  AppHeader,
  AppScreen,
  AppTextField,
  FormSection,
  PasswordField,
  StateView,
  Surface,
} from '@/components/ui';
import { isPreviewAvailable, roleHomes } from '@/constants/routes';
import { useAppState } from '@/store/app-store';
import { radii, spacing, typography } from '@/theme/tokens';
import type { UserRole } from '@/types/domain';
import { roleLabel } from './screens';
export function SplashScreen() {
  const { colors, sessionStatus, role } = useAppState();
  useEffect(() => {
    if (sessionStatus === 'guest') router.replace('/sign-in');
    if (sessionStatus === 'authenticated' && role) router.replace(roleHomes[role]);
  }, [role, sessionStatus]);
  return (
    <View style={[s.splash, { backgroundColor: colors.background }]}>
      <View style={[s.mark, { backgroundColor: colors.primary }]}>
        <Ionicons name="shield-checkmark" size={38} color="#fff" />
      </View>
      <Text style={[s.brand, { color: colors.text }]}>BookMyCCTV</Text>
      <Text style={[s.tag, { color: colors.textMuted }]}>Securing your workspace…</Text>
    </View>
  );
}
export function SignInScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { colors, signIn, sessionError } = useAppState();
  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const user = await signIn(username, password);
      router.replace(user.mustChangePassword ? '/change-password' : roleHomes[user.role]);
    } catch {
      // The session store exposes a safe error message beside the password field.
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AppScreen>
        <View style={s.signinTop}>
          <View style={[s.smallMark, { backgroundColor: colors.primary }]}>
            <Ionicons name="shield-checkmark" size={25} color="#fff" />
          </View>
          <AppHeader
            eyebrow="Secure monitoring"
            title="Welcome back"
            subtitle="Sign in with your BookMyCCTV account."
          />
        </View>
        <Surface>
          <View style={s.form}>
            <AppTextField
              label="Username"
              value={username}
              onChangeText={setUsername}
              placeholder="your.username"
            />
            <PasswordField
              label="Password"
              value={password}
              onChangeText={setPassword}
              error={sessionError ?? undefined}
            />
            <AppButton
              label={submitting ? 'Signing in…' : 'Sign in'}
              icon="log-in-outline"
              disabled={!username || !password || submitting}
              onPress={() => void submit()}
            />
            <Text style={[s.notice, { color: colors.textMuted }]}>
              Your refresh token is stored in the device keychain/keystore. Passwords are never
              stored.
            </Text>
          </View>
        </Surface>
        {isPreviewAvailable ? (
          <View style={s.preview}>
            <Text style={[s.previewTitle, { color: colors.text }]}>Development preview</Text>
            <Text style={[s.notice, { color: colors.textMuted }]}>
              Fixture data is available only in development builds.
            </Text>
            <View style={s.form}>
              {(['PLATFORM_ADMIN', 'INSTALLER_ADMIN', 'CLIENT'] as const).map((role) => (
                <PreviewRole key={role} role={role} />
              ))}
            </View>
          </View>
        ) : null}
      </AppScreen>
    </KeyboardAvoidingView>
  );
}
function PreviewRole({ role }: { role: UserRole }) {
  const { setRole, setPreview } = useAppState();
  return (
    <AppButton
      label={`Preview ${roleLabel(role)}`}
      variant="secondary"
      onPress={() => {
        setRole(role);
        setPreview(true);
        router.replace(roleHomes[role]);
      }}
    />
  );
}
export function ChangePasswordScreen() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { changePassword } = useAppState();
  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await changePassword(current, next);
      router.replace('/sign-in');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Password change failed.');
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <AppScreen>
      <AppHeader
        eyebrow="Account security"
        title="Change password"
        subtitle="Changing your password revokes every active session and requires a fresh sign-in."
      />
      <FormSection title="Password">
        <PasswordField label="Current password" value={current} onChangeText={setCurrent} />
        <PasswordField
          label="New password"
          value={next}
          onChangeText={setNext}
          helper="At least 12 characters with uppercase, lowercase, number and symbol."
        />
        <PasswordField
          label="Confirm new password"
          value={confirm}
          onChangeText={setConfirm}
          error={(confirm && confirm !== next ? 'Passwords do not match' : error) ?? undefined}
        />
      </FormSection>
      <AppButton
        label={submitting ? 'Changing…' : 'Change password'}
        disabled={submitting || !current || next.length < 12 || next !== confirm}
        onPress={() => void submit()}
      />
    </AppScreen>
  );
}
export function InitializingScreen() {
  return (
    <AppScreen>
      <StateView
        icon="shield-checkmark"
        title="Securing your workspace"
        message="Restoring the protected session and checking your access…"
      />
    </AppScreen>
  );
}
const s = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  mark: {
    width: 76,
    height: 76,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  brand: { fontSize: 30, fontWeight: '900', letterSpacing: -0.8 },
  tag: { fontSize: typography.body, marginTop: spacing.sm },
  signinTop: { paddingTop: spacing.xl },
  smallMark: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  form: { gap: spacing.lg },
  notice: { fontSize: typography.label, lineHeight: 19, textAlign: 'center' },
  preview: { gap: spacing.md },
  previewTitle: { fontSize: typography.heading, fontWeight: '800' },
});
