import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppState } from '@/store/app-store';
import { radii, spacing, typography } from '@/theme/tokens';
import type { Camera, CameraPermission, CapabilityState, PlayerState } from '@/types/domain';
import { IconButton, StatusBadge, Surface } from './ui';

export function CapabilityIndicator({ label, state }: { label: string; state: CapabilityState }) {
  const { colors } = useAppState();
  const icon: keyof typeof Ionicons.glyphMap =
    state === 'SUPPORTED'
      ? 'checkmark-circle'
      : state === 'UNSUPPORTED'
        ? 'close-circle'
        : state === 'REQUIRES_CONFIGURATION'
          ? 'construct'
          : 'help-circle';
  const color =
    state === 'SUPPORTED'
      ? colors.success
      : state === 'UNSUPPORTED'
        ? colors.danger
        : state === 'REQUIRES_CONFIGURATION'
          ? colors.warning
          : colors.textMuted;
  return (
    <View accessibilityLabel={`${label}: ${state}`} style={styles.capability}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={[styles.capabilityText, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}
export function CameraTile({ camera, onPress }: { camera: Camera; onPress: () => void }) {
  const { colors } = useAppState();
  const codec = camera.profiles[0]?.codec ?? 'Codec unknown';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${camera.displayName}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.78 : 1,
        },
      ]}
    >
      <View style={[styles.thumbnail, { backgroundColor: colors.player }]}>
        <Ionicons
          name={camera.status === 'ONLINE' ? 'videocam' : 'videocam-off'}
          size={30}
          color={camera.status === 'ONLINE' ? colors.primary : colors.textMuted}
        />
        <View style={styles.statusOverlay}>
          <StatusBadge status={camera.status} />
        </View>
        <View style={styles.secure}>
          <Ionicons name="shield-checkmark" size={13} color="#C8D7E8" />
          <Text style={styles.secureText}>SECURE PREVIEW</Text>
        </View>
      </View>
      <View style={styles.tileBody}>
        <Text numberOfLines={1} style={[styles.tileTitle, { color: colors.text }]}>
          {camera.displayName}
        </Text>
        <Text style={[styles.meta, { color: colors.textMuted }]}>
          {codec} · Channel {camera.channelId}
        </Text>
      </View>
    </Pressable>
  );
}
export function CameraGrid({
  cameras,
  onPress,
}: {
  cameras: Camera[];
  onPress: (camera: Camera) => void;
}) {
  const { width } = useWindowDimensions();
  const columns = width >= 700 ? 3 : width >= 430 ? 2 : 1;
  return (
    <View style={styles.grid}>
      {cameras.map((camera) => (
        <View key={camera.id} style={{ width: `${100 / columns}%`, padding: spacing.xs }}>
          <CameraTile camera={camera} onPress={() => onPress(camera)} />
        </View>
      ))}
    </View>
  );
}
const messages: Record<
  PlayerState,
  { icon: keyof typeof Ionicons.glyphMap; title: string; message: string }
> = {
  idle: {
    icon: 'play-circle',
    title: 'Ready to connect',
    message: 'A secure playback session will be requested in Prompt 2.',
  },
  loading: {
    icon: 'hourglass',
    title: 'Preparing player',
    message: 'Checking the authorized playback descriptor.',
  },
  connecting: {
    icon: 'radio',
    title: 'Connecting securely',
    message: 'Negotiating a server-mediated playable stream.',
  },
  live: { icon: 'radio-button-on', title: 'Live', message: 'Secure player surface ready.' },
  offline: {
    icon: 'cloud-offline',
    title: 'Camera offline',
    message: 'The device is not currently reachable.',
  },
  unavailable: {
    icon: 'ban',
    title: 'Playback unavailable',
    message: 'No playable media source is available.',
  },
  unauthorized: {
    icon: 'lock-closed',
    title: 'Access denied',
    message: 'Your account does not have camera:view permission.',
  },
  error: {
    icon: 'warning',
    title: 'Playback error',
    message: 'The stream could not be started. Try again later.',
  },
};
export function CameraPlayerShell({
  camera,
  state = 'idle',
  onFullscreen,
}: {
  camera: Camera;
  state?: PlayerState;
  onFullscreen?: () => void;
}) {
  const { colors } = useAppState();
  const copy = messages[state];
  return (
    <View
      accessibilityLabel={`${camera.displayName} player: ${copy.title}`}
      style={[styles.player, { backgroundColor: colors.player }]}
    >
      <View style={styles.playerCenter}>
        <Ionicons
          name={copy.icon}
          size={42}
          color={state === 'live' ? colors.success : colors.primary}
        />
        <Text style={styles.playerTitle}>{copy.title}</Text>
        <Text style={styles.playerMessage}>{copy.message}</Text>
      </View>
      <View style={styles.playerTop}>
        <StatusBadge status={camera.mediaStatus} />
        <Text style={styles.liveLabel}>{camera.displayName}</Text>
      </View>
      <View style={styles.controls}>
        <IconButton
          icon="camera-outline"
          label="Snapshot unavailable in preview"
          disabled
          onPress={() => undefined}
        />
        <IconButton
          icon="navigate-circle-outline"
          label="PTZ unavailable in preview"
          disabled
          onPress={() => undefined}
        />
        <IconButton
          icon="volume-high-outline"
          label="Audio unavailable in preview"
          disabled
          onPress={() => undefined}
        />
        <IconButton
          icon="expand-outline"
          label="Enter fullscreen"
          onPress={onFullscreen ?? (() => undefined)}
        />
      </View>
    </View>
  );
}
export function PermissionSelector({
  value,
  capabilities,
  onChange,
}: {
  value: CameraPermission[];
  capabilities: Camera['capabilities'];
  onChange: (value: CameraPermission[]) => void;
}) {
  const { colors } = useAppState();
  const options: Array<{ permission: CameraPermission; label: string; capability: string }> = [
    { permission: 'camera:view', label: 'Live video', capability: 'liveVideo' },
    { permission: 'camera:snapshot', label: 'Snapshots', capability: 'snapshot' },
    { permission: 'camera:ptz', label: 'PTZ control', capability: 'ptz' },
    { permission: 'camera:audio', label: 'Listen to audio', capability: 'audioInput' },
    { permission: 'camera:events', label: 'Security events', capability: 'events' },
  ];
  return (
    <Surface>
      {options.map((option) => {
        const state = capabilities[option.capability]?.state ?? 'UNKNOWN';
        const disabled = state !== 'SUPPORTED';
        const selected = value.includes(option.permission);
        return (
          <Pressable
            key={option.permission}
            disabled={disabled}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected, disabled }}
            onPress={() =>
              onChange(
                selected
                  ? value.filter((item) => item !== option.permission)
                  : [...value, option.permission],
              )
            }
            style={[
              styles.permission,
              { borderBottomColor: colors.border, opacity: disabled ? 0.48 : 1 },
            ]}
          >
            <Ionicons
              name={selected ? 'checkbox' : 'square-outline'}
              size={22}
              color={selected ? colors.primary : colors.textMuted}
            />
            <View style={styles.permissionText}>
              <Text style={[styles.tileTitle, { color: colors.text }]}>{option.label}</Text>
              <Text style={[styles.meta, { color: colors.textMuted }]}>
                {disabled
                  ? `Unavailable: ${state.toLowerCase().replaceAll('_', ' ')}`
                  : option.permission}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </Surface>
  );
}
const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.xs },
  tile: { borderWidth: 1, borderRadius: radii.lg, overflow: 'hidden' },
  thumbnail: { height: 132, alignItems: 'center', justifyContent: 'center' },
  statusOverlay: { position: 'absolute', left: spacing.sm, top: spacing.sm },
  secure: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  secureText: { color: '#C8D7E8', fontSize: 9, fontWeight: '800' },
  tileBody: { padding: spacing.md, gap: spacing.xs },
  tileTitle: { fontSize: typography.body, fontWeight: '700' },
  meta: { fontSize: typography.label },
  capability: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  capabilityText: { fontSize: typography.label },
  player: { aspectRatio: 16 / 9, borderRadius: radii.lg, overflow: 'hidden', minHeight: 220 },
  playerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  playerTitle: { color: '#F5F9FF', fontSize: typography.heading, fontWeight: '800' },
  playerMessage: { color: '#91A6BE', fontSize: typography.label, textAlign: 'center' },
  playerTop: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    top: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  liveLabel: { color: '#F5F9FF', fontSize: typography.label, fontWeight: '700' },
  controls: {
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  permission: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  permissionText: { flex: 1, gap: 2 },
});
