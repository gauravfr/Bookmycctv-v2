import { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView, type VideoSource } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { ApiClientError } from '@/services/api-client';
import { StreamController } from '@/services/streaming';
import { useAppState } from '@/store/app-store';
import { radii, spacing, typography } from '@/theme/tokens';
import { AppButton, StatusBadge } from './ui';
import type { Camera } from '@/types/domain';
export function SecureCameraPlayer({ camera }: { camera: Camera }) {
  const { colors } = useAppState();
  const controller = useRef(new StreamController());
  const [connecting, setConnecting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const player = useVideoPlayer(null, (p) => {
    p.loop = true;
  });
  const status = useEvent(player, 'statusChange', { status: player.status, error: undefined });
  const stop = async () => {
    player.pause();
    setLive(false);
    await controller.current.stop();
  };
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') void stop();
    });
    return () => {
      subscription.remove();
      void controller.current.stop();
      player.pause();
    };
  }, [player]);
  useEffect(() => {
    if (status.status === 'error') {
      setLive(false);
      setMessage(status.error?.message ?? 'The player could not decode this stream.');
    }
  }, [status]);
  const start = async () => {
    if (connecting) return;
    setConnecting(true);
    setMessage(null);
    try {
      const stream = await controller.current.start(camera.id);
      const source: VideoSource = {
        uri: stream.endpoint!,
        contentType: 'hls',
        headers: { Authorization: `Bearer ${stream.authorization!.token}` },
      };
      await player.replaceAsync(source);
      player.play();
      setLive(true);
    } catch (error) {
      setMessage(
        error instanceof ApiClientError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Playback could not start.',
      );
    } finally {
      setConnecting(false);
    }
  };
  return (
    <View style={[s.player, { backgroundColor: colors.player }]}>
      {live ? (
        <VideoView
          style={StyleSheet.absoluteFill}
          player={player}
          nativeControls
          contentFit="contain"
          fullscreenOptions={{ enable: true }}
        />
      ) : (
        <View style={s.center}>
          <Ionicons
            name={camera.status === 'OFFLINE' ? 'cloud-offline' : 'shield-checkmark'}
            size={42}
            color={camera.status === 'OFFLINE' ? colors.danger : colors.primary}
          />
          <Text style={s.title}>
            {camera.status === 'OFFLINE'
              ? 'Camera offline'
              : connecting
                ? 'Connecting securely'
                : 'Secure live view'}
          </Text>
          <Text style={s.message}>
            {message ??
              'Creates an expiring, authorized HLS session. Camera credentials never leave the server.'}
          </Text>
          {camera.status !== 'OFFLINE' ? (
            <AppButton
              label={connecting ? 'Connecting…' : 'Start live view'}
              disabled={connecting}
              onPress={() => void start()}
            />
          ) : null}
        </View>
      )}
      <View style={s.badge}>
        <StatusBadge status={live ? 'ONLINE' : camera.mediaStatus} />
      </View>
      {live ? (
        <View style={s.stop}>
          <AppButton label="Stop" variant="danger" onPress={() => void stop()} />
        </View>
      ) : null}
    </View>
  );
}
const s = StyleSheet.create({
  player: { aspectRatio: 16 / 9, minHeight: 220, borderRadius: radii.lg, overflow: 'hidden' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
  },
  title: { color: '#F5F9FF', fontSize: typography.heading, fontWeight: '800' },
  message: { color: '#91A6BE', fontSize: typography.label, textAlign: 'center', maxWidth: 360 },
  badge: { position: 'absolute', left: spacing.md, top: spacing.md },
  stop: { position: 'absolute', right: spacing.md, bottom: spacing.md },
});
