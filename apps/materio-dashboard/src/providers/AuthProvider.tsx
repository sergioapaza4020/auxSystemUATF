'use client';

import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

import { usePathname, useRouter } from 'next/navigation';

import { AuthContext } from '@/contexts/AuthContext';
import { getCurrentUser } from '@/api/auth.service';
import type { ICurrentUser } from '@/interfaces/auth/current-user.interface';
import { logout as apiLogout } from '@/api/sessions.service';
import { clearTokens } from '@/utils/authCookies';
import { PUBLIC_ROUTES } from '@/configs/publicRoutes';
import { useSnackbar } from '@/hooks/useSnackbar';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';
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
    await apiLogout();
    setUser(null);
    clearTokens();
    router.push('/login');
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
    const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));

    if (!isPublicRoute) void refreshUser();
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
