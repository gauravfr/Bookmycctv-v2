import { RoleTabs } from '@/components/role-tabs';
export default function Layout() {
  return (
    <RoleTabs
      role="PLATFORM_ADMIN"
      tabs={[
        { name: 'index', title: 'Overview', icon: 'grid-outline', iconFocused: 'grid' },
        {
          name: 'organizations',
          title: 'Organizations',
          icon: 'business-outline',
          iconFocused: 'business',
        },
        { name: 'health', title: 'Health', icon: 'pulse-outline', iconFocused: 'pulse' },
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
