import type { UserRole } from '@/types/domain';
export const roleHomes: Record<UserRole, '/platform' | '/installer' | '/client'> = {
  PLATFORM_ADMIN: '/platform',
  INSTALLER_ADMIN: '/installer',
  CLIENT: '/client',
};
export const isPreviewAvailable = __DEV__;
