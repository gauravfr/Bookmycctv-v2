import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  AppButton,
  AppHeader,
  AppScreen,
  AppTextField,
  EmptyState,
  ErrorState,
  FormSection,
  IconButton,
  LoadingState,
  MetricCard,
  PasswordField,
  SectionHeader,
  SettingRow,
  StatusBadge,
  Surface,
} from '@/components/ui';
import { CameraGrid, CapabilityIndicator, PermissionSelector } from '@/components/camera';
import { SecureCameraPlayer } from '@/components/secure-player';
import { useAsyncResource } from '@/hooks/use-async';
import { api } from '@/services/bookmycctv-api';
import { useAppState } from '@/store/app-store';
import { pushNotifications } from '@/services/push-notifications';
import { spacing, typography } from '@/theme/tokens';
import type { Camera, CameraPermission, SecurityEvent } from '@/types/domain';
import * as Preview from './screens';
import {
  buildDeviceRegistrationPayload,
  deviceTypeDescriptions,
  unavailableConnectionReason,
  validateDeviceRegistration,
  type DeviceRegistrationDraft,
  type DeviceRegistrationErrors,
} from './device-registration';
const message = (title: string, body: string) => Alert.alert(title, body);
function Remote<T>({
  state,
  children,
  empty,
}: {
  state: ReturnType<typeof useAsyncResource<T>>;
  children: (data: T) => React.ReactNode;
  empty?: boolean;
}) {
  if (state.loading) return <LoadingState />;
  if (state.error)
    return (
      <ErrorState
        title={state.error.isOffline ? 'You appear offline' : 'Unable to load'}
        message={state.error.message}
        action={<AppButton label="Retry" onPress={state.reload} />}
      />
    );
  if (state.data === null || empty)
    return (
      <EmptyState title="Nothing here yet" message="No records are available for this account." />
    );
  return <>{children(state.data)}</>;
}
function Item({
  icon,
  title,
  subtitle,
  onPress,
  status,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress?: () => void;
  status?: Parameters<typeof StatusBadge>[0]['status'];
}) {
  const { colors } = useAppState();
  const content = (
    <Surface style={s.row}>
      <Ionicons name={icon} size={22} color={colors.primary} />
      <View style={s.flex}>
        <Text style={[s.title, { color: colors.text }]}>{title}</Text>
        <Text style={[s.meta, { color: colors.textMuted }]}>{subtitle}</Text>
      </View>
      {status ? (
        <StatusBadge status={status} />
      ) : onPress ? (
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      ) : null}
    </Surface>
  );
  return onPress ? <Pressable onPress={onPress}>{content}</Pressable> : content;
}
export function PlatformDashboard() {
  const { preview, colors } = useAppState();
  if (preview) return <Preview.PlatformDashboard />;
  return <RealPlatformDashboard />;
  function RealPlatformDashboard() {
    const orgs = useAsyncResource(() => api.organizations(1, 100), []);
    return (
      <AppScreen>
        <AppHeader
          eyebrow="Platform operations"
          title="Platform overview"
          subtitle="Live tenant data from BookMyCCTV."
        />
        <Remote state={orgs}>
          {(data) => (
            <>
              <View style={s.metrics}>
                <MetricCard
                  label="Organizations"
                  value={String(data.pagination.total)}
                  icon="business"
                />
                <MetricCard
                  label="Active"
                  value={String(data.items.filter((o) => o.status === 'ACTIVE').length)}
                  icon="checkmark-circle"
                  tone={colors.success}
                />
              </View>
              <SectionHeader title="Organizations" />
              <AppButton
                label="Manage organizations"
                onPress={() => router.push('/platform/organizations')}
              />
            </>
          )}
        </Remote>
      </AppScreen>
    );
  }
}
export function OrganizationsScreen() {
  const { preview } = useAppState();
  if (preview) return <Preview.OrganizationsScreen />;
  return <Real />;
  function Real() {
    const state = useAsyncResource(() => api.organizations(), []);
    return (
      <AppScreen>
        <AppHeader
          eyebrow="Platform"
          title="Organizations"
          subtitle="Real tenant status and installer administration."
          action={
            <IconButton
              icon="add"
              label="Create organization"
              onPress={() => router.push('/platform/organizations/new')}
            />
          }
        />
        <Remote state={state} empty={state.data?.items.length === 0}>
          {(data) => (
            <View style={s.list}>
              {data.items.map((org) => (
                <Item
                  key={org.id}
                  icon="business"
                  title={org.name}
                  subtitle={`${org.code} · ${org.contactName ?? 'No contact'}`}
                  status={org.status}
                  onPress={() =>
                    router.push({
                      pathname: '/platform/organizations/detail',
                      params: { id: org.id },
                    })
                  }
                />
              ))}
            </View>
          )}
        </Remote>
      </AppScreen>
    );
  }
}
export function OrganizationDetailScreen() {
  const { preview } = useAppState();
  if (preview) return <Preview.OrganizationDetailScreen />;
  return <Real />;
  function Real() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const state = useAsyncResource(() => api.organization(id), [id]);
    const admins = useAsyncResource(() => api.installers(id), [id]);
    return (
      <AppScreen>
        <Remote state={state}>
          {(org) => (
            <>
              <AppHeader
                eyebrow={org.code}
                title={org.name}
                subtitle={org.contactEmail ?? 'No contact email'}
              />
              <StatusBadge status={org.status} />
              <SectionHeader
                title="Installer administrators"
                action={
                  <IconButton
                    icon="person-add"
                    label="Add installer"
                    onPress={() =>
                      router.push({
                        pathname: './installer-new',
                        params: { id },
                      })
                    }
                  />
                }
              />
              <Remote state={admins} empty={admins.data?.length === 0}>
                {(items) => (
                  <View style={s.list}>
                    {items.map((user) => (
                      <Item
                        key={user.id}
                        icon="person"
                        title={user.displayName}
                        subtitle={`${user.username} · ${user.email ?? 'No email'}`}
                        status={user.status}
                      />
                    ))}
                  </View>
                )}
              </Remote>
            </>
          )}
        </Remote>
      </AppScreen>
    );
  }
}
export function OrganizationFormScreen() {
  const { preview } = useAppState();
  if (preview) return <Preview.OrganizationFormScreen />;
  return <Real />;
  function Real() {
    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [contactName, setContactName] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const save = async () => {
      setSaving(true);
      setError(null);
      try {
        await api.createOrganization({
          name,
          code,
          contactName: contactName || undefined,
          contactEmail: contactEmail || undefined,
        });
        message('Organization created', 'The tenant is ready for installer administration.');
        router.back();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Creation failed.');
      } finally {
        setSaving(false);
      }
    };
    return (
      <AppScreen>
        <AppHeader eyebrow="New tenant" title="Create organization" />
        <FormSection title="Organization">
          <AppTextField label="Name" value={name} onChangeText={setName} />
          <AppTextField label="Code" value={code} onChangeText={(v) => setCode(v.toUpperCase())} />
          <AppTextField label="Contact name" value={contactName} onChangeText={setContactName} />
          <AppTextField
            label="Contact email"
            value={contactEmail}
            onChangeText={setContactEmail}
            keyboardType="email-address"
            error={error ?? undefined}
          />
        </FormSection>
        <AppButton
          label={saving ? 'Creating…' : 'Create organization'}
          disabled={saving || name.length < 2 || code.length < 2}
          onPress={() => void save()}
        />
      </AppScreen>
    );
  }
}
export function InstallerFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.createInstaller(id, {
        displayName,
        username,
        email: email || undefined,
        temporaryPassword,
      });
      message(
        'Installer created',
        'The installer must change the temporary password at first sign-in.',
      );
      router.back();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Creation failed.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <AppScreen>
      <AppHeader eyebrow="Organization access" title="Create installer admin" />
      <FormSection title="Installer account">
        <AppTextField label="Display name" value={displayName} onChangeText={setDisplayName} />
        <AppTextField label="Username" value={username} onChangeText={setUsername} />
        <AppTextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
        />
        <PasswordField
          label="Temporary password"
          value={temporaryPassword}
          onChangeText={setTemporaryPassword}
          error={error ?? undefined}
          helper="Must satisfy the backend password policy."
        />
      </FormSection>
      <AppButton
        label={saving ? 'Creating…' : 'Create installer'}
        disabled={
          saving || displayName.length < 2 || username.length < 3 || temporaryPassword.length < 12
        }
        onPress={() => void save()}
      />
    </AppScreen>
  );
}
export function HealthScreen() {
  const { preview, colors } = useAppState();
  if (preview) return <Preview.HealthScreen />;
  return <Real />;
  function Real() {
    const health = useAsyncResource(() => api.health(), []);
    const ready = useAsyncResource(() => api.ready(), []);
    return (
      <AppScreen>
        <AppHeader
          eyebrow="Operational overview"
          title="System health"
          subtitle="Only supported public health and readiness signals are shown."
        />
        <View style={s.metrics}>
          <MetricCard
            label="API"
            value={health.error ? 'Unavailable' : health.loading ? 'Checking' : 'Online'}
            icon="pulse"
            tone={health.error ? colors.danger : colors.success}
          />
          <MetricCard
            label="Readiness"
            value={ready.error ? 'Not ready' : ready.loading ? 'Checking' : 'Ready'}
            icon="server"
            tone={ready.error ? colors.warning : colors.success}
          />
        </View>
        <EmptyState
          title="Detailed telemetry unavailable"
          message="No mobile operational analytics or audit-log endpoint is exposed."
        />
      </AppScreen>
    );
  }
}
export function InstallerDashboard() {
  const { preview, colors } = useAppState();
  if (preview) return <Preview.InstallerDashboard />;
  return <Real />;
  function Real() {
    const clients = useAsyncResource(() => api.clients(), []);
    const devices = useAsyncResource(() => api.devices(), []);
    const cameras = useAsyncResource(() => api.cameras(), []);
    return (
      <AppScreen>
        <AppHeader eyebrow="Installer workspace" title="Security operations" />
        <View style={s.metrics}>
          <MetricCard
            label="Clients"
            value={clients.data ? String(clients.data.pagination.total) : '—'}
            icon="people"
          />
          <MetricCard
            label="Devices"
            value={devices.data ? String(devices.data.pagination.total) : '—'}
            icon="hardware-chip"
            tone={colors.cyan}
          />
          <MetricCard
            label="Cameras online"
            value={
              cameras.data
                ? `${cameras.data.filter((c) => c.status === 'ONLINE').length}/${cameras.data.length}`
                : '—'
            }
            icon="videocam"
            tone={colors.success}
          />
        </View>
        {clients.error || devices.error || cameras.error ? (
          <ErrorState
            title="Some data is unavailable"
            message={(clients.error ?? devices.error ?? cameras.error)!.message}
          />
        ) : null}
        <AppButton label="Register device" onPress={() => router.push('/installer/devices/new')} />
        <AppButton
          label="Create client"
          variant="secondary"
          onPress={() => router.push('/installer/clients/new')}
        />
      </AppScreen>
    );
  }
}
export function ClientsScreen() {
  const { preview } = useAppState();
  if (preview) return <Preview.ClientsScreen />;
  return <Real />;
  function Real() {
    const state = useAsyncResource(() => api.clients(), []);
    return (
      <AppScreen>
        <AppHeader
          eyebrow="Installer"
          title="Clients"
          action={
            <IconButton
              icon="person-add"
              label="Create client"
              onPress={() => router.push('/installer/clients/new')}
            />
          }
        />
        <Remote state={state} empty={state.data?.items.length === 0}>
          {(data) => (
            <View style={s.list}>
              {data.items.map((client) => (
                <Item
                  key={client.id}
                  icon="person"
                  title={client.displayName}
                  subtitle={client.username}
                  status={client.status}
                  onPress={() =>
                    router.push({
                      pathname: '/installer/clients/detail',
                      params: { id: client.id },
                    })
                  }
                />
              ))}
            </View>
          )}
        </Remote>
      </AppScreen>
    );
  }
}
export function ClientFormScreen() {
  const { preview } = useAppState();
  if (preview) return <Preview.ClientFormScreen />;
  return <Real />;
  function Real() {
    const [displayName, setDisplayName] = useState('');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [temporaryPassword, setPassword] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const save = async () => {
      setSaving(true);
      setError(null);
      try {
        await api.createClient({
          displayName,
          username,
          email: email || undefined,
          temporaryPassword,
        });
        message(
          'Client created',
          'The client must change the temporary password at first sign-in.',
        );
        router.back();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Creation failed.');
      } finally {
        setSaving(false);
      }
    };
    return (
      <AppScreen>
        <AppHeader eyebrow="New client" title="Create client account" />
        <FormSection title="Account">
          <AppTextField label="Display name" value={displayName} onChangeText={setDisplayName} />
          <AppTextField label="Username" value={username} onChangeText={setUsername} />
          <AppTextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
          />
          <PasswordField
            label="Temporary password"
            value={temporaryPassword}
            onChangeText={setPassword}
            error={error ?? undefined}
            helper="12+ characters with uppercase, lowercase, number and symbol."
          />
        </FormSection>
        <AppButton
          label={saving ? 'Creating…' : 'Create client'}
          disabled={saving || !displayName || !username || temporaryPassword.length < 12}
          onPress={() => void save()}
        />
      </AppScreen>
    );
  }
}
export function ClientDetailScreen() {
  const { preview } = useAppState();
  if (preview) return <Preview.ClientDetailScreen />;
  return <Real />;
  function Real() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const client = useAsyncResource(() => api.client(id), [id]);
    const cameras = useAsyncResource(() => api.cameras(), []);
    const assignments = useAsyncResource(() => api.assignments(id), [id]);
    const [cameraId, setCameraId] = useState<string | null>(null);
    const [permissions, setPermissions] = useState<CameraPermission[]>(['camera:view']);
    const [saving, setSaving] = useState(false);
    const firstCameraId = cameras.data?.[0]?.id;
    const selected = cameras.data?.find((c) => c.id === (cameraId ?? firstCameraId));
    const save = async () => {
      if (!selected) return;
      setSaving(true);
      try {
        const existing = assignments.data?.find((a) => a.cameraId === selected.id);
        if (existing) await api.updateAssignment(id, selected.id, permissions);
        else await api.assignCamera(id, selected.id, permissions);
        message('Access saved', 'Server-side capability and organization checks passed.');
        assignments.reload();
      } catch (reason) {
        message(
          'Assignment failed',
          reason instanceof Error ? reason.message : 'Unable to save assignment.',
        );
      } finally {
        setSaving(false);
      }
    };
    return (
      <AppScreen>
        <Remote state={client}>
          {(user) => (
            <AppHeader
              eyebrow="Client account"
              title={user.displayName}
              subtitle={`${user.username} · ${user.status}`}
            />
          )}
        </Remote>
        <SectionHeader title="Camera access" />
        <Remote state={cameras} empty={cameras.data?.length === 0}>
          {(items) => (
            <>
              <View style={s.chips}>
                {items.map((camera) => (
                  <Pressable key={camera.id} onPress={() => setCameraId(camera.id)}>
                    <Surface>
                      <Text style={s.title}>{camera.displayName}</Text>
                      <StatusBadge status={camera.status} />
                    </Surface>
                  </Pressable>
                ))}
              </View>
              {selected ? (
                <>
                  <PermissionSelector
                    value={permissions}
                    capabilities={selected.capabilities}
                    onChange={setPermissions}
                  />
                  <AppButton
                    label={saving ? 'Saving…' : 'Save verified permissions'}
                    disabled={saving || permissions.length === 0}
                    onPress={() => void save()}
                  />
                </>
              ) : null}
            </>
          )}
        </Remote>
      </AppScreen>
    );
  }
}
export function DevicesScreen() {
  const { preview } = useAppState();
  if (preview) return <Preview.DevicesScreen />;
  return <Real />;
  function Real() {
    const state = useAsyncResource(() => api.devices(), []);
    return (
      <AppScreen>
        <AppHeader
          eyebrow="Installer"
          title="Devices"
          action={
            <IconButton
              icon="add"
              label="Register device"
              onPress={() => router.push('/installer/devices/new')}
            />
          }
        />
        <Remote state={state} empty={state.data?.items.length === 0}>
          {(data) => (
            <View style={s.list}>
              {data.items.map((device) => (
                <Item
                  key={device.id}
                  icon="hardware-chip"
                  title={device.displayName}
                  subtitle={`${device.brand.replace('_', ' ')} · ${device.deviceType.replace('_', ' ')}`}
                  status={
                    device.connectionState === 'GATEWAY_NOT_READY'
                      ? 'UNKNOWN'
                      : device.connectionState
                  }
                  onPress={() =>
                    router.push({
                      pathname: '/installer/devices/detail',
                      params: { id: device.id },
                    })
                  }
                />
              ))}
            </View>
          )}
        </Remote>
      </AppScreen>
    );
  }
}
export function DeviceFormScreen() {
  const { preview, colors } = useAppState();
  if (preview) return <Preview.DeviceFormScreen />;
  return <Real />;
  function Real() {
    const [draft, setDraft] = useState<DeviceRegistrationDraft>({
      displayName: '',
      hostname: '',
      username: '',
      password: '',
      gatewayId: '',
      rtspPort: '554',
      httpPort: '80',
      onvifPort: '80',
      customRtspPath: '',
      streamTransport: 'TCP',
      brand: 'HIKVISION',
      deviceType: 'NVR',
      connectionMethod: 'LOCAL_LAN',
    });
    const options = useAsyncResource(() => api.deviceOptions(), []);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<DeviceRegistrationErrors>({});
    const [submitError, setSubmitError] = useState<string | null>(null);
    const set = <K extends keyof DeviceRegistrationDraft>(
      key: K,
      value: DeviceRegistrationDraft[K],
    ) => {
      setDraft((current) => ({ ...current, [key]: value }));
      setErrors((current) => ({ ...current, [key]: undefined }));
    };
    const save = async () => {
      const nextErrors = validateDeviceRegistration(draft);
      if (Object.keys(nextErrors).length) {
        setErrors(nextErrors);
        setSubmitError('Review the highlighted fields. Your credentials have not been sent.');
        return;
      }
      if (unavailableConnectionReason[draft.connectionMethod]) {
        setSubmitError(unavailableConnectionReason[draft.connectionMethod]!);
        return;
      }
      setSaving(true);
      setSubmitError(null);
      try {
        const created = await api.registerDevice(buildDeviceRegistrationPayload(draft));
        message(
          'Device registered',
          'Credentials were encrypted by the backend. Continue with a connection test.',
        );
        router.replace({ pathname: '/installer/devices/detail', params: { id: created.id } });
      } catch (reason) {
        setSubmitError(reason instanceof Error ? reason.message : 'Registration failed.');
      } finally {
        setSaving(false);
      }
    };
    const choices = <T extends string>(
      label: string,
      items: readonly T[],
      value: T,
      choose: (v: T) => void,
      disabled?: (v: T) => boolean,
    ) => (
      <View style={s.list}>
        <Text style={[s.meta, { color: colors.textMuted }]}>{label}</Text>
        <View style={s.chips}>
          {items.map((item) => (
            <Pressable
              key={item}
              accessibilityRole="radio"
              accessibilityState={{ checked: item === value, disabled: disabled?.(item) }}
              disabled={disabled?.(item)}
              onPress={() => choose(item)}
              style={{
                minHeight: 44,
                justifyContent: 'center',
                paddingHorizontal: 14,
                backgroundColor: item === value ? colors.primary : colors.surfaceRaised,
                borderRadius: 20,
                opacity: disabled?.(item) ? 0.4 : 1,
              }}
            >
              <Text style={{ color: item === value ? '#fff' : colors.text }}>
                {item.replaceAll('_', ' ')}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
    if (options.loading)
      return (
        <AppScreen>
          <LoadingState label="Loading supported device options…" />
        </AppScreen>
      );
    if (options.error || !options.data)
      return (
        <AppScreen>
          <ErrorState
            title="Device options unavailable"
            message={options.error?.message ?? 'The backend did not provide supported options.'}
            action={<AppButton label="Retry" onPress={options.reload} />}
          />
        </AppScreen>
      );
    return (
      <AppScreen>
        <AppHeader
          eyebrow="Secure enrollment"
          title="Register CCTV device"
          subtitle="Only options advertised by the authenticated backend are shown."
        />
        <FormSection title="Device">
          <AppTextField
            label="Display name"
            value={draft.displayName}
            onChangeText={(v) => set('displayName', v)}
            error={errors.displayName}
          />
          {choices('Brand', options.data.brands, draft.brand, (v) => set('brand', v))}
          {choices('Device type', options.data.deviceTypes, draft.deviceType, (v) =>
            set('deviceType', v),
          )}
          <Text style={[s.meta, { color: colors.textMuted }]}>
            {deviceTypeDescriptions[draft.deviceType]}
          </Text>
          {choices(
            'Connection method',
            options.data.connectionMethods,
            draft.connectionMethod,
            (v) => set('connectionMethod', v),
            (v) => Boolean(unavailableConnectionReason[v]),
          )}
          {options.data.connectionMethods
            .filter((v) => unavailableConnectionReason[v])
            .map((v) => (
              <Text key={v} style={[s.meta, { color: colors.textMuted }]}>
                {v.replaceAll('_', ' ')} unavailable: {unavailableConnectionReason[v]}
              </Text>
            ))}
        </FormSection>
        <FormSection title="Connection">
          {draft.connectionMethod === 'LOCAL_LAN' ? (
            <AppTextField
              label="Hostname or IP"
              value={draft.hostname}
              onChangeText={(v) => set('hostname', v)}
              error={errors.hostname}
              helper="DNS names and IPv4 are accepted; the backend network policy still applies."
            />
          ) : null}
          {draft.connectionMethod === 'SECURE_GATEWAY' ? (
            <AppTextField
              label="Gateway ID"
              value={draft.gatewayId}
              onChangeText={(v) => set('gatewayId', v)}
              error={errors.gatewayId}
            />
          ) : null}
          <View style={s.metrics}>
            <AppTextField
              label="RTSP port"
              value={draft.rtspPort}
              onChangeText={(v) => set('rtspPort', v)}
              keyboardType="number-pad"
              error={errors.rtspPort}
            />
            <AppTextField
              label="HTTP port"
              value={draft.httpPort}
              onChangeText={(v) => set('httpPort', v)}
              keyboardType="number-pad"
              error={errors.httpPort}
            />
            <AppTextField
              label="ONVIF port"
              value={draft.onvifPort}
              onChangeText={(v) => set('onvifPort', v)}
              keyboardType="number-pad"
              error={errors.onvifPort}
            />
          </View>
          <AppTextField
            label="Custom RTSP path"
            value={draft.customRtspPath}
            onChangeText={(v) => set('customRtspPath', v)}
            error={errors.customRtspPath}
            helper={
              draft.brand === 'CP_PLUS'
                ? 'Recommended for model-specific CP Plus streams. Path only; no scheme or credentials.'
                : 'Optional when ONVIF supplies a stream URI. Path only; no scheme or credentials.'
            }
          />
          {choices('RTSP transport', ['TCP', 'UDP'] as const, draft.streamTransport, (v) =>
            set('streamTransport', v),
          )}
          <AppTextField
            label="Username"
            value={draft.username}
            onChangeText={(v) => set('username', v)}
            error={errors.username}
          />
          <PasswordField
            label="Device password"
            value={draft.password}
            onChangeText={(v) => set('password', v)}
            error={errors.password}
          />
        </FormSection>
        {submitError ? <ErrorState title="Device not registered" message={submitError} /> : null}
        <AppButton
          label={saving ? 'Registering…' : 'Register device'}
          disabled={saving}
          onPress={() => void save()}
        />
      </AppScreen>
    );
  }
}
export function DeviceDetailScreen() {
  const { preview } = useAppState();
  if (preview) return <Preview.DeviceDetailScreen />;
  return <Real />;
  function Real() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const device = useAsyncResource(() => api.device(id), [id]);
    const cameras = useAsyncResource(() => api.deviceCameras(id), [id]);
    return (
      <AppScreen>
        <Remote state={device}>
          {(item) => (
            <>
              <AppHeader
                eyebrow={item.brand}
                title={item.displayName}
                subtitle={`${item.connectionMethod.replaceAll('_', ' ')} · ${item.streamTransport}`}
              />
              <StatusBadge
                status={
                  item.connectionState === 'GATEWAY_NOT_READY' ? 'UNKNOWN' : item.connectionState
                }
              />
              <AppButton
                label="Test connection"
                onPress={() => router.push({ pathname: '/installer/devices/test', params: { id } })}
              />
              <AppButton
                label="Discover channels"
                variant="secondary"
                onPress={() => router.push({ pathname: '/installer/discovery', params: { id } })}
              />
            </>
          )}
        </Remote>
        <SectionHeader title="Discovered cameras" />
        <Remote state={cameras} empty={cameras.data?.length === 0}>
          {(items) => <CameraGrid cameras={items} onPress={() => undefined} />}
        </Remote>
      </AppScreen>
    );
  }
}
export function ConnectionTestScreen() {
  const { preview } = useAppState();
  if (preview) return <Preview.ConnectionTestScreen />;
  return <Real />;
  function Real() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const [testing, setTesting] = useState(false);
    const [result, setResult] = useState<Awaited<ReturnType<typeof api.testConnection>> | null>(
      null,
    );
    const [error, setError] = useState<string | null>(null);
    const run = async () => {
      setTesting(true);
      setResult(null);
      setError(null);
      try {
        const out = await api.testConnection(id);
        setResult(out);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Connection test failed.');
      } finally {
        setTesting(false);
      }
    };
    return (
      <AppScreen>
        <AppHeader eyebrow="Diagnostics" title="Connection test" />
        {error ? <ErrorState title="Connection test failed" message={error} /> : null}
        {result ? (
          <Surface style={s.list}>
            <StatusBadge
              status={result.networkReachable ? 'SUPPORTED' : 'UNSUPPORTED'}
              label={`Network ${result.networkReachable ? 'reachable' : 'unreachable'}`}
            />
            <StatusBadge
              status={result.authenticationSuccessful ? 'SUPPORTED' : 'UNSUPPORTED'}
              label={`Authentication ${result.authenticationSuccessful ? 'successful' : 'failed'}`}
            />
            <StatusBadge
              status={result.channelsDiscovered ? 'SUPPORTED' : 'UNSUPPORTED'}
              label={`ONVIF discovery ${result.channelsDiscovered ? 'successful' : 'not verified'}`}
            />
            <StatusBadge
              status={result.streamMediaVerified ? 'SUPPORTED' : 'REQUIRES_CONFIGURATION'}
              label={`RTSP media ${result.streamMediaVerified ? 'verified' : 'not verified'}`}
            />
            <Text style={s.meta}>
              {result.profiles.length} channel profile(s) returned. Mobile playback must still be
              tested from the camera screen.
            </Text>
            {result.warnings.map((warning) => (
              <Text key={warning} style={s.meta}>
                Warning: {warning}
              </Text>
            ))}
          </Surface>
        ) : (
          <Surface>
            <Text style={s.title}>
              Ready to test network reachability, authentication, ONVIF discovery, and RTSP media
              negotiation separately.
            </Text>
          </Surface>
        )}
        <AppButton
          label={testing ? 'Testing…' : 'Run connection test'}
          disabled={testing}
          onPress={() => void run()}
        />
      </AppScreen>
    );
  }
}
export function DiscoveryScreen() {
  const { preview } = useAppState();
  if (preview) return <Preview.DiscoveryScreen />;
  return <Real />;
  function Real() {
    const { id } = useLocalSearchParams<{ id?: string }>();
    const [loading, setLoading] = useState(false);
    const [cameras, setCameras] = useState<Camera[]>([]);
    const [error, setError] = useState<string | null>(null);
    const discover = async () => {
      if (!id) {
        setError('Open discovery from a registered device.');
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const result = await api.discover(id);
        setCameras(result.cameras);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Discovery failed.');
      } finally {
        setLoading(false);
      }
    };
    return (
      <AppScreen>
        <AppHeader
          eyebrow="ONVIF discovery"
          title="Camera channels"
          subtitle="Capabilities shown here come from the real connector result."
        />
        {error ? <ErrorState title="Discovery unavailable" message={error} /> : null}
        {cameras.map((camera) => (
          <Surface key={camera.id}>
            <Text style={s.title}>{camera.displayName}</Text>
            <StatusBadge status={camera.status} />
            <View style={s.list}>
              {Object.entries(camera.capabilities).map(([name, cap]) => (
                <CapabilityIndicator key={name} label={name} state={cap.state} />
              ))}
            </View>
          </Surface>
        ))}
        <AppButton
          label={loading ? 'Discovering…' : 'Discover cameras'}
          disabled={loading}
          onPress={() => void discover()}
        />
      </AppScreen>
    );
  }
}
export function ClientDashboard() {
  const { preview, colors } = useAppState();
  if (preview) return <Preview.ClientDashboard />;
  return <Real />;
  function Real() {
    const assigned = useAsyncResource(() => api.assignedCameras(), []);
    return (
      <AppScreen>
        <AppHeader
          eyebrow="Live security"
          title="Your cameras"
          action={
            <IconButton
              icon="notifications"
              label="Events"
              onPress={() => router.push('/alerts')}
            />
          }
        />
        <Remote state={assigned} empty={assigned.data?.length === 0}>
          {(items) => (
            <>
              <View style={s.metrics}>
                <MetricCard label="Assigned" value={String(items.length)} icon="videocam" />
                <MetricCard
                  label="Online"
                  value={String(items.filter((i) => i.camera.status === 'ONLINE').length)}
                  icon="checkmark-circle"
                  tone={colors.success}
                />
              </View>
              <CameraGrid
                cameras={items.map((i) => i.camera)}
                onPress={(camera) =>
                  router.push({ pathname: '/client/cameras/detail', params: { id: camera.id } })
                }
              />
            </>
          )}
        </Remote>
      </AppScreen>
    );
  }
}
export function CamerasScreen() {
  const { preview } = useAppState();
  if (preview) return <Preview.CamerasScreen />;
  return <Real />;
  function Real() {
    const state = useAsyncResource(() => api.assignedCameras(), []);
    return (
      <AppScreen>
        <AppHeader eyebrow="Authorized access" title="Assigned cameras" />
        <Remote state={state} empty={state.data?.length === 0}>
          {(items) => (
            <CameraGrid
              cameras={items.map((i) => i.camera)}
              onPress={(camera) =>
                router.push({ pathname: '/client/cameras/detail', params: { id: camera.id } })
              }
            />
          )}
        </Remote>
      </AppScreen>
    );
  }
}
function CameraActions({ camera }: { camera: Camera }) {
  const { colors } = useAppState();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const snapshotSupported = camera.capabilities.snapshot?.state === 'SUPPORTED';
  const ptzSupported = camera.capabilities.ptz?.state === 'SUPPORTED';
  const run = async (action: () => Promise<unknown>, success: string) => {
    if (busy) return;
    setBusy(true);
    setResult(null);
    try {
      await action();
      setResult(success);
    } catch (reason) {
      setResult(reason instanceof Error ? reason.message : 'Camera action failed.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Surface>
      <SectionHeader title="Camera controls" />
      <View style={s.chips}>
        <AppButton
          label={busy ? 'Working…' : 'Request snapshot'}
          disabled={busy || !snapshotSupported}
          onPress={() =>
            void run(() => api.snapshot(camera.id), 'Authenticated snapshot received successfully.')
          }
        />
        <AppButton
          label="Pan left"
          variant="secondary"
          disabled={busy || !ptzSupported}
          onPress={() =>
            void run(
              () => api.ptzMove(camera.id, { x: -0.35, y: 0, zoom: 0, durationMs: 350 }),
              'PTZ command acknowledged and stopped.',
            )
          }
        />
        <AppButton
          label="Pan right"
          variant="secondary"
          disabled={busy || !ptzSupported}
          onPress={() =>
            void run(
              () => api.ptzMove(camera.id, { x: 0.35, y: 0, zoom: 0, durationMs: 350 }),
              'PTZ command acknowledged and stopped.',
            )
          }
        />
      </View>
      <Text style={[s.meta, { color: colors.textMuted }]}>
        {result ??
          'Controls are enabled only for verified capabilities. Audio/talkback remains unavailable.'}
      </Text>
    </Surface>
  );
}
export function CameraDetailScreen() {
  const { preview } = useAppState();
  if (preview) return <Preview.CameraDetailScreen />;
  return <Real />;
  function Real() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const state = useAsyncResource(() => api.camera(id), [id]);
    return (
      <AppScreen>
        <Remote state={state}>
          {(camera) => (
            <>
              <AppHeader
                eyebrow={`Channel ${camera.channelId}`}
                title={camera.displayName}
                subtitle="Expiring server-authorized HLS playback"
              />
              <SecureCameraPlayer camera={camera} />
              <CameraActions camera={camera} />
              <Surface>
                <StatusBadge status={camera.status} />
                <View style={s.list}>
                  {Object.entries(camera.capabilities).map(([name, cap]) => (
                    <CapabilityIndicator key={name} label={name} state={cap.state} />
                  ))}
                </View>
              </Surface>
            </>
          )}
        </Remote>
      </AppScreen>
    );
  }
}
export function FullscreenCameraScreen() {
  return <CameraDetailScreen />;
}
function eventStatus(event: SecurityEvent): 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' {
  return event.resolved ? 'RESOLVED' : event.acknowledged ? 'ACKNOWLEDGED' : 'OPEN';
}
export function AlertsScreen() {
  const { preview } = useAppState();
  if (preview) return <Preview.AlertsScreen />;
  return <Real />;
  function Real() {
    const state = useAsyncResource(() => api.events(), []);
    return (
      <AppScreen>
        <AppHeader
          eyebrow="Security events"
          title="Alerts"
          subtitle="Only detector events returned by the backend are shown."
        />
        <Remote state={state} empty={state.data?.length === 0}>
          {(items) => (
            <View style={s.list}>
              {items.map((event) => (
                <Item
                  key={event.id}
                  icon="shield"
                  title={event.eventType.replaceAll('_', ' ')}
                  subtitle={`${event.severity} · ${new Date(event.occurredAt).toLocaleString()}`}
                  status={eventStatus(event)}
                  onPress={() => {
                    if (eventStatus(event) === 'OPEN')
                      void api
                        .acknowledgeEvent(event.id)
                        .then(state.reload)
                        .catch((reason) =>
                          message(
                            'Unable to acknowledge',
                            reason instanceof Error ? reason.message : 'Request failed.',
                          ),
                        );
                  }}
                />
              ))}
            </View>
          )}
        </Remote>
      </AppScreen>
    );
  }
}
export function AccountScreen() {
  const { preview } = useAppState();
  if (preview) return <Preview.AccountScreen />;
  return <RealAccountScreen />;
}
function RealAccountScreen() {
  const { user, colors, themePreference, setThemePreference, signOut } = useAppState();
  const preferences = useAsyncResource(() => api.notificationPreferences(), []);
  const [saving, setSaving] = useState(false);
  const logout = async () => {
    await signOut();
    router.replace('/sign-in');
  };
  return (
    <AppScreen>
      <AppHeader
        eyebrow="Account"
        title={user?.displayName ?? 'Profile'}
        subtitle={`${user?.role.replaceAll('_', ' ') ?? ''} · ${user?.username ?? ''}`}
      />
      <Surface>
        <SettingRow
          icon="contrast-outline"
          title="Dark appearance"
          subtitle={`Currently ${themePreference}`}
          value={themePreference === 'dark'}
          onValueChange={() => setThemePreference(themePreference === 'dark' ? 'light' : 'dark')}
        />
        <SettingRow
          icon="notifications-outline"
          title="Push preferences"
          subtitle={preferences.data?.pushEnabled ? 'Enabled' : 'Disabled'}
          value={preferences.data?.pushEnabled ?? false}
          onValueChange={async (value) => {
            const current = preferences.data ?? {
              pushEnabled: false,
              eventTypes: [],
              minimumSeverity: 'HIGH' as const,
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              cameraIds: [],
            };
            setSaving(true);
            try {
              if (value) await pushNotifications.register();
              else await pushNotifications.revoke();
              await api.saveNotificationPreferences({ ...current, pushEnabled: value });
              preferences.reload();
            } catch (reason) {
              message(
                'Unable to update',
                reason instanceof Error ? reason.message : 'Request failed.',
              );
            } finally {
              setSaving(false);
            }
          }}
        />
      </Surface>
      {preferences.error ? (
        <Text style={{ color: colors.danger }}>{preferences.error.message}</Text>
      ) : null}
      <AppButton
        label="Change password"
        variant="secondary"
        onPress={() => router.push('/change-password')}
      />
      <AppButton
        label={saving ? 'Saving…' : 'Sign out'}
        variant="danger"
        disabled={saving}
        onPress={() => void logout()}
      />
    </AppScreen>
  );
}
const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  title: { fontSize: typography.body, fontWeight: '800' },
  meta: { fontSize: typography.label },
  list: { gap: spacing.md, marginTop: spacing.md },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  chips: { gap: spacing.sm },
});
