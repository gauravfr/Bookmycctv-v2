import { RoleTabs } from '@/components/role-tabs';
export default function Layout() {
  return (
    <RoleTabs
      role="INSTALLER_ADMIN"
      tabs={[
        { name: 'index', title: 'Overview', icon: 'grid-outline', iconFocused: 'grid' },
        { name: 'clients', title: 'Clients', icon: 'people-outline', iconFocused: 'people' },
        {
          name: 'devices',
          title: 'Devices',
          icon: 'hardware-chip-outline',
          iconFocused: 'hardware-chip',
        },
        { name: 'discovery', title: 'Discover', icon: 'scan-outline', iconFocused: 'scan' },
        {
          name: 'account',
          title: 'Account',
          icon: 'person-circle-outline',
          iconFocused: 'person-circle',
        },
      ]}
    />
  );
}
