import 'server-only';
import {Pool, type PoolClient} from 'pg';
import {auth} from './auth';
let pool:Pool|undefined;
export class HttpError extends Error {constructor(public status:number,message:string){super(message);}}
export function enabled(){return process.env.SYNTHETIC_BACKEND_ENABLED==='true';}
export async function actor(){
 if(!enabled()) throw new HttpError(503,'Backend sintético não habilitado');
 const {data,error}=await auth().getSession();
 if(error||!data?.user?.id) throw new HttpError(401,'Autenticação necessária');
 return data.user.id;
}
export function sameOrigin(request:Request){if(request.headers.get('origin')!==process.env.APP_ORIGIN)throw new HttpError(403,'Origem recusada');}
export async function transaction<T>(user:string,patient:string,fn:(c:PoolClient)=>Promise<T>):Promise<T>{
 pool??=new Pool({connectionString:process.env.DATABASE_URL,max:5});
 const c=await pool.connect();
 try {await c.query('BEGIN');
 const role=await c.query("SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user");
 if(!role.rows[0]||role.rows[0].rolsuper||role.rows[0].rolbypassrls)throw new Error('Unsafe database role');
 await c.query("SELECT set_config('app.actor',$1,true)",[user]);
 await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[patient]);
 const result=await fn(c);await c.query('COMMIT');return result;
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
export function failure(e:unknown){if(e instanceof HttpError)return Response.json({error:e.message},{status:e.status});return Response.json({error:'Operação recusada ou serviço indisponível'},{status:403});}
export async function boundedJson(request:Request){const text=await request.text();if(text.length>4096)throw new HttpError(413,'Corpo excessivo');try{return JSON.parse(text);}catch{throw new HttpError(400,'JSON inválido');}}
