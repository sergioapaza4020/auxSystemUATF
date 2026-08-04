'use client';

import { type ReactNode, useCallback, useEffect, useState } from 'react';

import { usePathname, useRouter } from 'next/navigation';

import { AuthContext } from '@/contexts/AuthContext';
import { getCurrentUser } from '@/api/auth.service';
import type { ICurrentUser } from '@/interfaces/auth/current-user.interface';
import { logout as apiLogout } from '@/api/sessions.service';
import { clearTokens } from '@/utils/authCookies';
import { PUBLIC_ROUTES } from '@/configs/publicRoutes';
import { useSnackbar } from '@/hooks/useSnackbar';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<ICurrentUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const snackbar = useSnackbar();

  const refreshUser = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser();

      setUser(currentUser);
    } catch (error) {
      setUser(null);
      snackbar.error(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [snackbar]);

  const logout = async () => {
    await apiLogout();
    setUser(null);
    clearTokens();
    router.push('/login');
  };

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
