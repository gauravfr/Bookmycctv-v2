import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { useColorScheme } from 'react-native';
import { authSession } from '@/services/auth-session';
import { ApiClientError } from '@/services/api-client';
import { pushNotifications } from '@/services/push-notifications';
import type { User, UserRole } from '@/types/domain';
import { dark, light, type ThemeColors } from '@/theme/tokens';
type ThemePreference = 'system' | 'dark' | 'light';
type SessionStatus = 'initializing' | 'guest' | 'authenticated';
interface AppState {
  role: UserRole | null;
  user: User | null;
  preview: boolean;
  sessionStatus: SessionStatus;
  sessionError: string | null;
  themePreference: ThemePreference;
  colors: ThemeColors;
  signIn: (username: string, password: string) => Promise<User>;
  signOut: () => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
  setRole: (role: UserRole | null) => void;
  setPreview: (preview: boolean) => void;
  setThemePreference: (theme: ThemePreference) => void;
}
const AppContext = createContext<AppState | null>(null);
export function AppProvider({ children }: PropsWithChildren) {
  const system = useColorScheme();
  const [role, setRole] = useState<UserRole | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [preview, setPreview] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('initializing');
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [themePreference, setThemePreference] = useState<ThemePreference>('system');
  useEffect(() => {
    let active = true;
    authSession.onLost(async () => {
      if (active) {
        setUser(null);
        setRole(null);
        setPreview(false);
        setSessionStatus('guest');
      }
    });
    authSession
      .restore()
      .then((restored) => {
        if (!active) return;
        setUser(restored);
        setRole(restored?.role ?? null);
        setSessionStatus(restored ? 'authenticated' : 'guest');
      })
      .catch(() => {
        if (active) {
          setSessionError('The saved session could not be restored.');
          setSessionStatus('guest');
        }
      });
    return () => {
      active = false;
    };
  }, []);
  const signIn = async (username: string, password: string) => {
    setSessionError(null);
    try {
      const signedIn = await authSession.login(username, password);
      setUser(signedIn);
      setRole(signedIn.role);
      setPreview(false);
      setSessionStatus('authenticated');
      return signedIn;
    } catch (error) {
      setSessionError(error instanceof ApiClientError ? error.message : 'Sign in failed.');
      throw error;
    }
  };
  const signOut = async () => {
    await pushNotifications.revoke().catch(() => undefined);
    await authSession.logout();
    setUser(null);
    setRole(null);
    setPreview(false);
    setSessionStatus('guest');
  };
  const changePassword = async (current: string, next: string) => {
    await authSession.changePassword(current, next);
    setUser(null);
    setRole(null);
    setPreview(false);
    setSessionStatus('guest');
  };
  const colors =
    themePreference === 'light' || (themePreference === 'system' && system === 'light')
      ? light
      : dark;
  const value = useMemo(
    () => ({
      role,
      user,
      preview,
      sessionStatus,
      sessionError,
      themePreference,
      colors,
      signIn,
      signOut,
      changePassword,
      setRole,
      setPreview,
      setThemePreference,
    }),
    [role, user, preview, sessionStatus, sessionError, themePreference, colors],
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
export function useAppState(): AppState {
  const value = useContext(AppContext);
  if (!value) throw new Error('useAppState must be used inside AppProvider');
  return value;
}
