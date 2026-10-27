'use client';
import {createAuthClient} from '@neondatabase/auth/next';
// Next adapter uses the same-origin /api/auth proxy. No browser tokens or storage.
export const authClient=createAuthClient();
