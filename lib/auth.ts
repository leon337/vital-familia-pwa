import 'server-only';
import {createNeonAuth} from '@neondatabase/auth/next/server';
export function auth(){
 if(!process.env.NEON_AUTH_BASE_URL || !process.env.NEON_AUTH_COOKIE_SECRET) throw new Error('Auth não configurado');
 return createNeonAuth({baseUrl:process.env.NEON_AUTH_BASE_URL,cookies:{secret:process.env.NEON_AUTH_COOKIE_SECRET,sessionDataTtl:0}});
}
