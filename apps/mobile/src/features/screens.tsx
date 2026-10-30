import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  AppButton,
  AppHeader,
  AppScreen,
  AppTextField,
  EmptyState,
  FormSection,
  IconButton,
  MetricCard,
  PasswordField,
  SectionHeader,
  SettingRow,
  StateView,
  StatusBadge,
  Surface,
} from '@/components/ui';
import {
  CameraGrid,
  CameraPlayerShell,
  CapabilityIndicator,
  PermissionSelector,
} from '@/components/camera';
import {
  previewCameras,
  previewDevices,
  previewEvents,
  previewOrganizations,
} from '@/fixtures/development';
import { useAppState } from '@/store/app-store';
import { radii, spacing, typography } from '@/theme/tokens';
import type { CameraPermission, Device, UserRole } from '@/types/domain';

const unavailable = () =>
  Alert.alert(
    'Preview only',
    'This action is intentionally unavailable until authenticated API integration in Prompt 2.',
  );
function PreviewBanner() {
  const { colors } = useAppState();
  return (
    <View
      style={[s.banner, { backgroundColor: colors.warning + '20', borderColor: colors.warning }]}
    >
      <Ionicons name="flask" color={colors.warning} size={17} />
      <Text style={[s.bannerText, { color: colors.text }]}>
        Development preview · fixture data · no backend actions
      </Text>
    </View>
  );
}
function MetricRow({ children }: { children: React.ReactNode }) {
  return <View style={s.metrics}>{children}</View>;
}
function QuickAction({
  icon,
  title,
  detail,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  detail: string;
  onPress: () => void;
}) {
  const { colors } = useAppState();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        s.quick,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <View style={[s.quickIcon, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name={icon} color={colors.primary} size={21} />
      </View>
      <View style={s.flex}>
        <Text style={[s.itemTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[s.meta, { color: colors.textMuted }]}>{detail}</Text>
      </View>
      <Ionicons name="chevron-forward" color={colors.textMuted} size={18} />
    </Pressable>
  );
}
function EventList() {
  const { colors } = useAppState();
  return (
    <View style={s.list}>
      {previewEvents().map((event) => (
        <Surface key={event.id} style={s.row}>
          <View
            style={[
              s.eventIcon,
              {
                backgroundColor:
                  (event.severity === 'CRITICAL'
                    ? colors.danger
                    : event.severity === 'HIGH'
                      ? colors.warning
                      : colors.primary) + '20',
              },
            ]}
          >
            <Ionicons
              name="shield-outline"
              size={20}
              color={
                event.severity === 'CRITICAL'
                  ? colors.danger
                  : event.severity === 'HIGH'
                    ? colors.warning
                    : colors.primary
              }
            />
          </View>
          <View style={s.flex}>
            <Text style={[s.itemTitle, { color: colors.text }]}>
              {String(event.metadata.title ?? event.eventType).replaceAll('_', ' ')}
            </Text>
            <Text style={[s.meta, { color: colors.textMuted }]}>
              {event.eventType.replaceAll('_', ' ')} · {event.occurredAt}
            </Text>
          </View>
          <StatusBadge
            status={event.resolved ? 'RESOLVED' : event.acknowledged ? 'ACKNOWLEDGED' : 'OPEN'}
          />
        </Surface>
      ))}
    </View>
  );
}
export function PlatformDashboard() {
  const { colors } = useAppState();
  return (
    <AppScreen>
      <AppHeader
        eyebrow="Platform operations"
        title="Good morning"
        subtitle="A clear view across every organization and installer."
        action={
          <IconButton
            icon="notifications-outline"
            label="Notifications"
            onPress={() => router.push('/alerts')}
          />
        }
      />
      <PreviewBanner />
      <MetricRow>
        <MetricCard label="Organizations" value="24" icon="business" />
        <MetricCard label="Active installers" value="38" icon="people" tone={colors.cyan} />
      </MetricRow>
      <MetricRow>
        <MetricCard
          label="Managed devices"
          value="412"
          icon="hardware-chip"
          tone={colors.success}
        />
        <MetricCard label="Needs attention" value="7" icon="warning" tone={colors.warning} />
      </MetricRow>
      <SectionHeader title="Operations" />
      <QuickAction
        icon="business-outline"
        title="Organizations"
        detail="Create, review and manage tenants"
        onPress={() => router.push('/platform/organizations')}
      />
      <QuickAction
        icon="pulse-outline"
        title="System health"
        detail="API, database and media readiness"
        onPress={() => router.push('/platform/health')}
      />
      <QuickAction
        icon="person-add-outline"
        title="Installer management"
        detail="Available from organization detail"
        onPress={() => router.push('/platform/organizations')}
      />
    </AppScreen>
  );
}
export function OrganizationsScreen() {
  const { colors } = useAppState();
  return (
    <AppScreen>
      <AppHeader
        eyebrow="Platform"
        title="Organizations"
        subtitle="Tenant status and installer administration."
        action={
          <IconButton
            icon="add"
            label="Create organization"
            onPress={() => router.push('/platform/organizations/new')}
          />
        }
      />
      <PreviewBanner />
      <View style={s.list}>
        {previewOrganizations().map((org) => (
          <Pressable
            key={org.id}
            onPress={() => router.push('/platform/organizations/detail')}
            style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
          >
            <Surface style={s.org}>
              <View style={[s.avatar, { backgroundColor: colors.primarySoft }]}>
                <Text style={[s.avatarText, { color: colors.primary }]}>
                  {org.code.slice(0, 2)}
                </Text>
              </View>
              <View style={s.flex}>
                <Text style={[s.itemTitle, { color: colors.text }]}>{org.name}</Text>
                <Text style={[s.meta, { color: colors.textMuted }]}>
                  {org.code} · {org.contactName}
                </Text>
              </View>
              <StatusBadge status={org.status} />
            </Surface>
          </Pressable>
        ))}
      </View>
    </AppScreen>
  );
}
export function OrganizationDetailScreen() {
  const { colors } = useAppState();
  const org = previewOrganizations()[0]!;
  return (
    <AppScreen>
      <AppHeader
        eyebrow={org.code}
        title={org.name}
        subtitle="Organization overview and installer access."
      />
      <PreviewBanner />
      <Surface>
        <View style={s.between}>
          <StatusBadge status={org.status} />
          <Text style={[s.meta, { color: colors.textMuted }]}>Created 18 Aug 2026</Text>
        </View>
        <View style={s.infoGrid}>
          <Info label="Contact" value={org.contactName ?? 'Not provided'} />
          <Info label="Email" value={org.contactEmail ?? 'Not provided'} />
          <Info label="Phone" value={org.contactPhone ?? 'Not provided'} />
          <Info label="Installer admins" value="3 active" />
        </View>
      </Surface>
      <SectionHeader
        title="Installer administrators"
        action={<AppButton label="Add installer" variant="ghost" onPress={unavailable} />}
      />
      <Surface style={s.row}>
        <View style={[s.avatar, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name="person" size={20} color={colors.primary} />
        </View>
        <View style={s.flex}>
          <Text style={[s.itemTitle, { color: colors.text }]}>Arjun Verma</Text>
          <Text style={[s.meta, { color: colors.textMuted }]}>installer.admin · Active</Text>
        </View>
        <StatusBadge status="ACTIVE" />
      </Surface>
    </AppScreen>
  );
}
export function OrganizationFormScreen() {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  return (
    <AppScreen>
      <AppHeader
        eyebrow="New tenant"
        title="Create organization"
        subtitle="Set up the organization. Installer access is added separately."
      />
      <PreviewBanner />
      <FormSection title="Organization identity" description="Codes are uppercase and unique.">
        <AppTextField
          label="Organization name"
          value={name}
          onChangeText={setName}
          placeholder="Northstar Logistics"
        />
        <AppTextField
          label="Organization code"
          value={code}
          onChangeText={(value) => setCode(value.toUpperCase())}
          placeholder="NORTHSTAR"
          helper="3–20 uppercase letters, numbers or underscores."
        />
      </FormSection>
      <FormSection title="Primary contact">
        <AppTextField label="Contact name" value={contact} onChangeText={setContact} />
        <AppTextField
          label="Contact email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
        />
      </FormSection>
      <AppButton
        label="Create organization"
        icon="business"
        onPress={unavailable}
        disabled={!name || code.length < 3}
      />
    </AppScreen>
  );
}
export function HealthScreen() {
  const { colors } = useAppState();
  return (
    <AppScreen>
      <AppHeader
        eyebrow="Operational overview"
        title="System health"
        subtitle="Public readiness endpoints are available; deeper platform telemetry is not exposed by the API."
      />
      <PreviewBanner />
      <MetricRow>
        <MetricCard label="API" value="Ready" icon="checkmark-circle" tone={colors.success} />
        <MetricCard label="Database" value="Ready" icon="server" tone={colors.success} />
      </MetricRow>
      <MetricRow>
        <MetricCard label="Media gateways" value="3 / 4" icon="radio" tone={colors.warning} />
        <MetricCard
          label="AI workers"
          value="Unavailable"
          icon="sparkles"
          tone={colors.textMuted}
        />
      </MetricRow>
      <StateView
        icon="information-circle-outline"
        title="Audit feed unavailable"
        message="The backend records audit events internally but does not expose a supported mobile audit endpoint."
      />
    </AppScreen>
  );
}
export function InstallerDashboard() {
  const { colors } = useAppState();
  return (
    <AppScreen>
      <AppHeader
        eyebrow="Aster Retail Group"
        title="Security workspace"
        subtitle="Devices, clients and camera access in one place."
        action={
          <IconButton
            icon="notifications-outline"
            label="Notifications"
            onPress={() => router.push('/alerts')}
          />
        }
      />
      <PreviewBanner />
      <MetricRow>
        <MetricCard label="Clients" value="18" icon="people" />
        <MetricCard label="Cameras online" value="46 / 49" icon="videocam" tone={colors.success} />
      </MetricRow>
      <MetricRow>
        <MetricCard label="Devices" value="12" icon="hardware-chip" tone={colors.cyan} />
        <MetricCard label="Open alerts" value="3" icon="shield" tone={colors.warning} />
      </MetricRow>
      <SectionHeader title="Quick actions" />
      <QuickAction
        icon="person-add"
        title="Add client"
        detail="Create a client account securely"
        onPress={() => router.push('/installer/clients/new')}
      />
      <QuickAction
        icon="add-circle"
        title="Register device"
        detail="Dahua, CP Plus or Hikvision"
        onPress={() => router.push('/installer/devices/new')}
      />
      <QuickAction
        icon="scan"
        title="Discover cameras"
        detail="Probe registered device channels"
        onPress={() => router.push('/installer/discovery')}
      />
      <SectionHeader title="Recent alerts" />
      <EventList />
    </AppScreen>
  );
}
export function ClientsScreen() {
  const { colors } = useAppState();
  const clients = [
    ['Priya Sharma', 'priya.sharma', '6 cameras'],
    ['Facility Desk', 'facility.desk', '12 cameras'],
    ['Night Supervisor', 'night.supervisor', '4 cameras'],
  ];
  return (
    <AppScreen>
      <AppHeader
        eyebrow="Installer"
        title="Clients"
        subtitle="Accounts and assigned camera access."
        action={
          <IconButton
            icon="person-add"
            label="Add client"
            onPress={() => router.push('/installer/clients/new')}
          />
        }
      />
      <PreviewBanner />
      <View style={s.list}>
        {clients.map(([name, user, cameras]) => (
          <Pressable key={user} onPress={() => router.push('/installer/clients/detail')}>
            <Surface style={s.row}>
              <View style={[s.avatar, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name="person-outline" size={20} color={colors.primary} />
              </View>
              <View style={s.flex}>
                <Text style={[s.itemTitle, { color: colors.text }]}>{name}</Text>
                <Text style={[s.meta, { color: colors.textMuted }]}>
                  {user} · {cameras}
                </Text>
              </View>
              <StatusBadge status="ACTIVE" />
            </Surface>
          </Pressable>
        ))}
      </View>
    </AppScreen>
  );
}
export function ClientFormScreen() {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  return (
    <AppScreen>
      <AppHeader
        eyebrow="New client"
        title="Create client account"
        subtitle="The client will be required to replace the temporary password."
      />
      <PreviewBanner />
      <FormSection title="Account details">
        <AppTextField label="Display name" value={name} onChangeText={setName} />
        <AppTextField label="Username" value={username} onChangeText={setUsername} />
        <AppTextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
        />
        <PasswordField
          label="Temporary password"
          value={password}
          onChangeText={setPassword}
          helper="Use at least 12 characters; never reuse an installer password."
        />
      </FormSection>
      <AppButton
        label="Create client"
        icon="person-add"
        onPress={unavailable}
        disabled={!name || !username || password.length < 12}
      />
    </AppScreen>
  );
}
export function ClientDetailScreen() {
  const { colors } = useAppState();
  const [permissions, setPermissions] = useState<CameraPermission[]>([
    'camera:view',
    'camera:snapshot',
  ]);
  const camera = previewCameras()[1]!;
  return (
    <AppScreen>
      <AppHeader eyebrow="Client account" title="Priya Sharma" subtitle="priya.sharma · Active" />
      <PreviewBanner />
      <MetricRow>
        <MetricCard label="Assigned cameras" value="6" icon="videocam" />
        <MetricCard label="Active sessions" value="2" icon="phone-portrait" tone={colors.cyan} />
      </MetricRow>
      <SectionHeader title="Assign camera access" />
      <Surface>
        <Text style={[s.itemTitle, { color: colors.text }]}>{camera.displayName}</Text>
        <Text style={[s.meta, { color: colors.textMuted }]}>
          Only verified capabilities can be granted.
        </Text>
      </Surface>
      <PermissionSelector
        value={permissions}
        capabilities={camera.capabilities}
        onChange={setPermissions}
      />
      <AppButton label="Save permissions" onPress={unavailable} />
    </AppScreen>
  );
}
function DeviceCard({ device }: { device: Device }) {
  const { colors } = useAppState();
  return (
    <Pressable onPress={() => router.push('/installer/devices/detail')}>
      <Surface>
        <View style={s.between}>
          <View style={[s.avatar, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="hardware-chip-outline" size={21} color={colors.primary} />
          </View>
          <StatusBadge
            status={
              device.connectionState === 'GATEWAY_NOT_READY' ? 'UNKNOWN' : device.connectionState
            }
          />
        </View>
        <Text style={[s.itemTitle, { color: colors.text, marginTop: spacing.md }]}>
          {device.displayName}
        </Text>
        <Text style={[s.meta, { color: colors.textMuted }]}>
          {device.brand.replace('_', ' ')} · {device.deviceType.replace('_', ' ')}
        </Text>
        <Text style={[s.meta, { color: colors.textMuted }]}>
          {device.connectionMethod.replaceAll('_', ' ')} · {device.streamTransport}
        </Text>
      </Surface>
    </Pressable>
  );
}
export function DevicesScreen() {
  return (
    <AppScreen>
      <AppHeader
        eyebrow="Installer"
        title="Devices"
        subtitle="Connection health without exposing credentials."
        action={
          <IconButton
            icon="add"
            label="Register device"
            onPress={() => router.push('/installer/devices/new')}
          />
        }
      />
      <PreviewBanner />
      <View style={s.list}>
        {previewDevices().map((device) => (
          <DeviceCard key={device.id} device={device} />
        ))}
      </View>
    </AppScreen>
  );
}
export function DeviceFormScreen() {
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [brand, setBrand] = useState<'HIKVISION' | 'DAHUA' | 'CP_PLUS'>('HIKVISION');
  const { colors } = useAppState();
  return (
    <AppScreen>
      <AppHeader
        eyebrow="Secure enrollment"
        title="Register CCTV device"
        subtitle="Credentials are encrypted by the backend and never returned to this app."
      />
      <PreviewBanner />
      <FormSection title="Device">
        <AppTextField label="Display name" value={name} onChangeText={setName} />
        <Text style={[s.fieldLabel, { color: colors.text }]}>Brand</Text>
        <View style={s.chips}>
          {(['HIKVISION', 'DAHUA', 'CP_PLUS'] as const).map((item) => (
            <Pressable
              key={item}
              onPress={() => setBrand(item)}
              style={[
                s.chip,
                { backgroundColor: brand === item ? colors.primary : colors.surfaceRaised },
              ]}
            >
              <Text style={{ color: brand === item ? '#fff' : colors.text, fontWeight: '700' }}>
                {item.replace('_', ' ')}
              </Text>
            </Pressable>
          ))}
        </View>
        <Info label="Device type" value="NVR" />
        <Info label="Connection method" value="SECURE GATEWAY" />
      </FormSection>
      <FormSection
        title="Connection"
        description="TCP and standard ports are safe defaults. Confirm them with the device administrator."
      >
        <AppTextField
          label="Hostname"
          value={host}
          onChangeText={setHost}
          placeholder="10.0.0.25"
        />
        <AppTextField
          label="RTSP port"
          value="554"
          onChangeText={() => undefined}
          keyboardType="number-pad"
        />
        <AppTextField
          label="ONVIF port"
          value="80"
          onChangeText={() => undefined}
          keyboardType="number-pad"
        />
        <AppTextField label="Username" value={user} onChangeText={setUser} />
        <PasswordField label="Password" value={password} onChangeText={setPassword} />
      </FormSection>
      <AppButton
        label="Register device"
        icon="shield-checkmark"
        onPress={unavailable}
        disabled={!name || !host || !user || !password}
      />
    </AppScreen>
  );
}
export function DeviceDetailScreen() {
  const { colors } = useAppState();
  const device = previewDevices()[0]!;
  const camera = previewCameras()[1]!;
  return (
    <AppScreen>
      <AppHeader
        eyebrow={device.brand}
        title={device.displayName}
        subtitle={`${device.model} · Firmware ${device.firmwareVersion}`}
      />
      <PreviewBanner />
      <Surface>
        <View style={s.between}>
          <StatusBadge
            status={
              device.connectionState === 'GATEWAY_NOT_READY' ? 'UNKNOWN' : device.connectionState
            }
          />
          <Text style={[s.meta, { color: colors.textMuted }]}>Checked 2 min ago</Text>
        </View>
        <View style={s.infoGrid}>
          <Info label="Connection" value="Secure gateway" />
          <Info label="Transport" value={device.streamTransport} />
          <Info label="RTSP" value={`Port ${device.ports.rtsp}`} />
          <Info label="TLS" value={device.tlsEnabled ? 'Enabled' : 'Disabled'} />
        </View>
      </Surface>
      <SectionHeader title="Capabilities" />
      <Surface style={s.capabilities}>
        {Object.entries(camera.capabilities).map(([name, cap]) => (
          <CapabilityIndicator key={name} label={name} state={cap.state} />
        ))}
      </Surface>
      <AppButton
        label="Test connection"
        icon="pulse"
        onPress={() => router.push('/installer/devices/test')}
      />
      <AppButton
        label="Discover channels"
        variant="secondary"
        icon="scan"
        onPress={() => router.push('/installer/discovery')}
      />
    </AppScreen>
  );
}
export function ConnectionTestScreen() {
  const [state, setState] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const config =
    state === 'testing'
      ? {
          icon: 'sync' as const,
          title: 'Testing secure connection',
          message: 'Checking reachability, authentication and device metadata…',
        }
      : state === 'success'
        ? {
            icon: 'checkmark-circle' as const,
            title: 'Connection verified',
            message: 'ONVIF responded and 8 channels are ready for discovery.',
          }
        : state === 'error'
          ? {
              icon: 'warning' as const,
              title: 'Authentication failed',
              message: 'The device rejected the supplied credentials. Update them and try again.',
            }
          : {
              icon: 'pulse' as const,
              title: 'Ready to test',
              message:
                'This preview demonstrates every connection-test state without contacting a device.',
            };
  return (
    <AppScreen>
      <AppHeader eyebrow="Diagnostics" title="Connection test" subtitle="Warehouse NVR" />
      <PreviewBanner />
      <StateView
        {...config}
        action={
          <View style={s.buttonStack}>
            <AppButton
              label={state === 'testing' ? 'Testing…' : 'Run test'}
              disabled={state === 'testing'}
              onPress={() => {
                setState('testing');
                setTimeout(() => setState('success'), 900);
              }}
            />
            <AppButton label="Show error state" variant="ghost" onPress={() => setState('error')} />
          </View>
        }
      />
    </AppScreen>
  );
}
export function DiscoveryScreen() {
  const [selected, setSelected] = useState<string[]>([]);
  const { colors } = useAppState();
  return (
    <AppScreen>
      <AppHeader
        eyebrow="Channel discovery"
        title="8 cameras found"
        subtitle="Review verified capabilities before assigning access."
      />
      <PreviewBanner />
      <View style={s.list}>
        {previewCameras().map((camera) => (
          <Pressable
            key={camera.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected.includes(camera.id) }}
            onPress={() =>
              setSelected(
                selected.includes(camera.id)
                  ? selected.filter((id) => id !== camera.id)
                  : [...selected, camera.id],
              )
            }
          >
            <Surface style={s.row}>
              <Ionicons
                name={selected.includes(camera.id) ? 'checkbox' : 'square-outline'}
                size={23}
                color={colors.primary}
              />
              <View style={s.flex}>
                <Text style={[s.itemTitle, { color: colors.text }]}>{camera.displayName}</Text>
                <Text style={[s.meta, { color: colors.textMuted }]}>
                  Channel {camera.channelId} · {camera.profiles[0]?.codec ?? 'Unknown codec'}
                </Text>
              </View>
              <StatusBadge status={camera.status} />
            </Surface>
          </Pressable>
        ))}
      </View>
      <AppButton
        label={`Add ${selected.length} selected cameras`}
        disabled={!selected.length}
        onPress={unavailable}
      />
    </AppScreen>
  );
}
export function ClientDashboard() {
  const cameras = previewCameras();
  const { colors } = useAppState();
  return (
    <AppScreen>
      <AppHeader
        eyebrow="Live security"
        title="Your cameras"
        subtitle="3 locations · Updated just now"
        action={
          <IconButton
            icon="notifications-outline"
            label="Notifications"
            onPress={() => router.push('/alerts')}
          />
        }
      />
      <PreviewBanner />
      <MetricRow>
        <MetricCard label="Online" value="2" icon="videocam" tone={colors.success} />
        <MetricCard label="Needs attention" value="1" icon="warning" tone={colors.warning} />
      </MetricRow>
      <SectionHeader
        title="Camera overview"
        action={
          <AppButton
            label="View all"
            variant="ghost"
            onPress={() => router.push('/client/cameras')}
          />
        }
      />
      <CameraGrid
        cameras={cameras.slice(0, 2)}
        onPress={() => router.push('/client/cameras/detail')}
      />
      <SectionHeader title="Latest events" />
      <EventList />
    </AppScreen>
  );
}
export function CamerasScreen() {
  return (
    <AppScreen>
      <AppHeader
        eyebrow="Monitoring"
        title="Cameras"
        subtitle="Assigned cameras and verified capabilities."
      />
      <PreviewBanner />
      <CameraGrid
        cameras={previewCameras()}
        onPress={() => router.push('/client/cameras/detail')}
      />
    </AppScreen>
  );
}
export function CameraDetailScreen() {
  const camera = previewCameras()[1]!;
  const { colors } = useAppState();
  return (
    <AppScreen>
      <AppHeader
        eyebrow="Warehouse"
        title={camera.displayName}
        subtitle="Authorized player shell · No RTSP data stored on device"
      />
      <PreviewBanner />
      <CameraPlayerShell
        camera={camera}
        state="idle"
        onFullscreen={() => router.push('/client/cameras/fullscreen')}
      />
      <SectionHeader title="Camera status" />
      <Surface>
        <View style={s.between}>
          <StatusBadge status={camera.status} />
          <Text style={[s.meta, { color: colors.textMuted }]}>Last seen just now</Text>
        </View>
        <View style={s.capabilities}>
          {Object.entries(camera.capabilities).map(([name, cap]) => (
            <CapabilityIndicator key={name} label={name} state={cap.state} />
          ))}
        </View>
      </Surface>
      <SectionHeader title="Stream profiles" />
      <Surface>
        <Info label="Primary" value="H.265 · 2560 × 1440" />
        <Text style={[s.meta, { color: colors.textMuted, marginTop: spacing.sm }]}>
          Playback formats and authorized session endpoints are requested from the server in Prompt
          2.
        </Text>
      </Surface>
    </AppScreen>
  );
}
export function FullscreenCameraScreen() {
  const camera = previewCameras()[1]!;
  return (
    <View style={{ flex: 1, backgroundColor: '#02060C', justifyContent: 'center' }}>
      <CameraPlayerShell camera={camera} state="idle" onFullscreen={() => router.back()} />
    </View>
  );
}
export function AlertsScreen() {
  return (
    <AppScreen>
      <AppHeader
        eyebrow="Security intelligence"
        title="Alerts & events"
        subtitle="Motion, person detection and device health events supported by the backend."
      />
      <PreviewBanner />
      <EventList />
      <EmptyState
        title="No more events"
        message="New authorized events will appear here after Prompt 2 integration."
      />
    </AppScreen>
  );
}
export function AccountScreen() {
  const { colors, themePreference, setThemePreference, setRole, setPreview } = useAppState();
  const [biometric, setBiometric] = useState(false);
  return (
    <AppScreen>
      <AppHeader
        eyebrow="Account"
        title="Profile & settings"
        subtitle="Session controls and accessible appearance."
      />
      <PreviewBanner />
      <Surface>
        <View style={s.profile}>
          <View style={[s.avatarLarge, { backgroundColor: colors.primarySoft }]}>
            <Text style={[s.avatarText, { color: colors.primary }]}>PS</Text>
          </View>
          <View>
            <Text style={[s.itemTitle, { color: colors.text }]}>Priya Sharma</Text>
            <Text style={[s.meta, { color: colors.textMuted }]}>Client · Aster Retail Group</Text>
          </View>
        </View>
      </Surface>
      <SectionHeader title="Preferences" />
      <Surface>
        <SettingRow
          icon="contrast-outline"
          title="Appearance"
          subtitle={`Currently ${themePreference}`}
          onValueChange={() => setThemePreference(themePreference === 'dark' ? 'light' : 'dark')}
          value={themePreference === 'dark'}
        />
        <SettingRow
          icon="finger-print"
          title="Biometric unlock"
          subtitle="Integration reserved for Prompt 2"
          value={biometric}
          onValueChange={setBiometric}
        />
        <SettingRow
          icon="notifications-outline"
          title="Notification preferences"
          subtitle="Backed by the notifications API"
        />
      </Surface>
      <SectionHeader title="Session" />
      <AppButton
        label="Change password"
        variant="secondary"
        onPress={() => router.push('/change-password')}
      />
      <AppButton
        label="Sign out of preview"
        variant="danger"
        onPress={() => {
          setRole(null);
          setPreview(false);
          router.replace('/sign-in');
        }}
      />
    </AppScreen>
  );
}
export function Info({ label, value }: { label: string; value: string }) {
  const { colors } = useAppState();
  return (
    <View style={s.info}>
      <Text style={[s.infoLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[s.infoValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}
export function DeniedScreen() {
  return (
    <AppScreen>
      <AppHeader title="Access denied" />
      <StateView
        icon="lock-closed"
        title="You cannot open this area"
        message="Navigation visibility is only a convenience. The backend remains the authority for every protected operation."
        action={<AppButton label="Return home" onPress={() => router.replace('/sign-in')} />}
      />
    </AppScreen>
  );
}
export function SessionExpiredScreen() {
  return (
    <AppScreen>
      <AppHeader title="Session expired" />
      <StateView
        icon="time"
        title="Please sign in again"
        message="Your secure session is no longer valid. No local preview data was retained."
        action={<AppButton label="Go to sign in" onPress={() => router.replace('/sign-in')} />}
      />
    </AppScreen>
  );
}
export function roleLabel(role: UserRole) {
  return role === 'PLATFORM_ADMIN'
    ? 'Platform Admin'
    : role === 'INSTALLER_ADMIN'
      ? 'Installer Admin'
      : 'Client';
}
const s = StyleSheet.create({
  banner: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  bannerText: { fontSize: typography.label, fontWeight: '700', flex: 1 },
  metrics: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  quick: {
    minHeight: 74,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  quickIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
  itemTitle: { fontSize: typography.body, fontWeight: '800' },
  meta: { fontSize: typography.label, lineHeight: 19 },
  list: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  eventIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  between: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  org: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontWeight: '900', fontSize: typography.heading },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.lg, gap: spacing.lg },
  info: { minWidth: '42%', flex: 1, gap: 3 },
  infoLabel: {
    fontSize: typography.caption,
    textTransform: 'uppercase',
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  infoValue: { fontSize: typography.body, fontWeight: '700' },
  capabilities: { gap: spacing.md },
  buttonStack: { gap: spacing.md, minWidth: 230, marginTop: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: radii.pill },
  fieldLabel: { fontSize: typography.label, fontWeight: '700' },
  profile: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatarLarge: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
