'use client';

import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

import { usePathname, useRouter } from 'next/navigation';

import { AuthContext } from '@/contexts/AuthContext';
import { getCurrentUser } from '@/api/auth.service';
import type { ICurrentUser } from '@/interfaces/auth/current-user.interface';
import { logout as apiLogout } from '@/api/sessions.service';
import { clearTokens } from '@/utils/authCookies';
import { isPublicRoute } from '@/configs/publicRoutes';
import { useSnackbar } from '@/hooks/useSnackbar';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';
import { clearPendingQr } from '@/utils/student-qr-flow';
import { SESSION_EXPIRED_EVENT } from '@/utils/authEvents';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<ICurrentUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const authEpoch = useRef(0);

  const { error: showError } = useSnackbar();

  const refreshUser = useCallback(async () => {
    const epoch = authEpoch.current;

    try {
      const currentUser = await getCurrentUser();

      if (epoch === authEpoch.current) setUser(currentUser);
    } catch (error) {
      if (epoch === authEpoch.current) {
        setUser(null);
        showError(getApiErrorMessage(error));
      }
    } finally {
      if (epoch === authEpoch.current) setLoading(false);
    }
  }, [showError]);

  const logout = async () => {
    clearPendingQr();

    try {
      await apiLogout();
    } catch {
      showError('No se pudo confirmar el cierre. Reintenta desde el inicio de sesión al recuperar la conexión.');
    } finally {
      authEpoch.current += 1;
      setUser(null);
      clearTokens();
      router.push('/login');
    }
  };

  useEffect(() => {
    const expired = () => {
      authEpoch.current += 1;
      setUser(null);
      setLoading(false);
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, expired);

    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, expired);
  }, []);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel('uatf-auth');

    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (!event.data || typeof event.data !== 'object' || !('type' in event.data)) return;
      const type = event.data.type;

      if (type === 'logout') {
        authEpoch.current += 1;
        setUser(null);
        clearTokens();
        setLoading(false);
      } else if (type === 'login') {
        authEpoch.current += 1;
        clearTokens();
        setUser(null);
        setLoading(true);
        void refreshUser();
      }
    };

    return () => channel.close();
  }, [refreshUser]);

  useEffect(() => {
    if (!isPublicRoute(pathname)) void refreshUser();
  }, [refreshUser, pathname]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        refreshUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
