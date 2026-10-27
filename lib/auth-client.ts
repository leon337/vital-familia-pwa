'use client';
import './zod'; // Configure before evaluating SDK dependencies that may create schemas.
import {createAuthClient} from '@neondatabase/auth/next';
// Next adapter uses the same-origin /api/auth proxy. No browser tokens or storage.
export const authClient=createAuthClient();
