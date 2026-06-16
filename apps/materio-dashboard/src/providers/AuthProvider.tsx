'use client';

import { type ReactNode, useEffect, useState } from 'react';

import { useRouter } from 'next/navigation';

import { AuthContext } from '@/contexts/authContext';
import { getCurrentUser } from '@/api/auth.service';
import type { ICurrentUser } from '@/interfaces/auth/current-user.interface';
import { Logout } from '@/api/sessions.service';
import { clearTokens } from '@/utils/authCookies';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter();

  const [user, setUser] = useState<ICurrentUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshUser = async () => {
    try {
      const currentUser = await getCurrentUser();

      setUser(currentUser);
    } catch (error) {
      console.error(error);

      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await Logout();
    setUser(null);
    clearTokens();
    router.push('/login');
  };

  useEffect(() => {
    void refreshUser();
  }, []);

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
