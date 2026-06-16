'use client';

import { createContext } from 'react';

import type { AuthContextType } from '@/interfaces/auth/auth-context.interface';

export const AuthContext = createContext<AuthContextType | null>(null);
