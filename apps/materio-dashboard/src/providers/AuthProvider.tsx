'use client';

import { type ReactNode, useCallback, useEffect, useState } from 'react';

import { usePathname, useRouter } from 'next/navigation';

import { AuthContext } from '@/contexts/AuthContext';
import { getCurrentUser } from '@/api/auth.service';
import type { ICurrentUser } from '@/interfaces/auth/current-user.interface';
import { Logout } from '@/api/sessions.service';
import { clearTokens } from '@/utils/authCookies';
import { PUBLIC_ROUTES } from '@/configs/publicRoutes';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<ICurrentUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshUser = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser();

      setUser(currentUser);
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = async () => {
    await Logout();
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
