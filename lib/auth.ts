import 'server-only';
import {createNeonAuth} from '@neondatabase/auth/next/server';
export function auth(){
 if(!process.env.NEON_AUTH_BASE_URL || !process.env.NEON_AUTH_COOKIE_SECRET) throw new Error('Auth não configurado');
 const url=new URL(process.env.NEON_AUTH_BASE_URL);
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.hostname!=='ep-shy-leaf-b6dt67xj.neonauth.c-2.sa-east-1.aws.neon.tech'||url.pathname!=='/neondb/auth')throw new Error('Auth fora da branch aprovada');
 return createNeonAuth({baseUrl:process.env.NEON_AUTH_BASE_URL,cookies:{secret:process.env.NEON_AUTH_COOKIE_SECRET,sessionDataTtl:0}});
}
