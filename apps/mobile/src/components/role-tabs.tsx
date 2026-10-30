import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppState } from '@/store/app-store';
import type { UserRole } from '@/types/domain';
type Tab = {
  name: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconFocused: keyof typeof Ionicons.glyphMap;
};
export function RoleTabs({ tabs, role }: { tabs: Tab[]; role: UserRole }) {
  const { colors, role: activeRole, user, preview } = useAppState();
  if (user?.mustChangePassword && !preview) return <Redirect href={'/change-password'} />;
  if (activeRole !== role) return <Redirect href={activeRole ? '/access-denied' : '/sign-in'} />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 64,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
    >
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? tab.iconFocused : tab.icon}
                color={typeof color === 'string' ? color : colors.textMuted}
                size={22}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
