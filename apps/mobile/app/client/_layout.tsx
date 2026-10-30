import { RoleTabs } from '@/components/role-tabs';
export default function Layout() {
  return (
    <RoleTabs
      role="CLIENT"
      tabs={[
        { name: 'index', title: 'Overview', icon: 'grid-outline', iconFocused: 'grid' },
        { name: 'cameras', title: 'Cameras', icon: 'videocam-outline', iconFocused: 'videocam' },
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
