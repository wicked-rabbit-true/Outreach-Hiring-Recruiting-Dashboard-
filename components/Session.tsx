'use client';
import { createContext, useContext } from 'react';
import type { Role } from '@/lib/types';

const Ctx = createContext<Role>('viewer');
export const RoleProvider = Ctx.Provider;
export const useRole = () => useContext(Ctx);
