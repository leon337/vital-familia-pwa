import 'server-only';
import {createHmac} from 'node:crypto';
import {Pool, type PoolClient} from 'pg';
import {auth} from './auth';
let pool:Pool|undefined;
export class HttpError extends Error {constructor(public status:number,message:string){super(message);}}
export function enabled(){return process.env.SYNTHETIC_BACKEND_ENABLED==='true' && process.env.AUTH_SECURITY_VALIDATED==='true' && process.env.REAL_DATA_APPROVED==='true';}
export async function actor(){
 if(!enabled()) throw new HttpError(503,'Backend sintético não habilitado');
 const {data,error}=await auth().getSession();
 if(error||!data?.user?.id||data.user.id.length>200) throw new HttpError(401,'Autenticação necessária');
 return data.user.id;
}
export function sameOrigin(request:Request){if(request.headers.get('origin')!==process.env.APP_ORIGIN)throw new HttpError(403,'Origem recusada');}
export async function transaction<T>(user:string,patient:string,fn:(c:PoolClient)=>Promise<T>):Promise<T>{
 const key=process.env.ACTOR_SIGNING_KEY;
 if(!key||key.length<64||!process.env.DATABASE_URL)throw new HttpError(503,'Banco não configurado');
 pool??=new Pool({connectionString:process.env.DATABASE_URL,max:5,ssl:{rejectUnauthorized:true},connectionTimeoutMillis:5000,statement_timeout:10000});
 const c=await pool.connect();
 try {await c.query('BEGIN');
 const role=await c.query("SELECT rolsuper,rolbypassrls, EXISTS(SELECT 1 FROM pg_class WHERE relnamespace='app'::regnamespace AND relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)) AS owns_tables FROM pg_roles WHERE rolname=current_user");
 if(!role.rows[0]||role.rows[0].rolsuper||role.rows[0].rolbypassrls||role.rows[0].owns_tables)throw new Error('Unsafe database role');
 const {rows}=await c.query('SELECT txid_current()::text AS id');
 const signature=createHmac('sha256',key).update(`${rows[0].id}:${user}`).digest('hex');
 await c.query("SELECT set_config('app.actor',$1,true),set_config('app.actor_signature',$2,true)",[user,signature]);
 await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[patient]);
 const verified=await c.query('SELECT app.actor()=$1 AS ok',[user]);
 if(verified.rows[0]?.ok!==true)throw new HttpError(503,'Identidade do banco não validada');
 const result=await fn(c);await c.query('COMMIT');return result;
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
export function failure(e:unknown){if(e instanceof HttpError)return Response.json({error:e.message},{status:e.status,headers:{'Cache-Control':'no-store'}});return Response.json({error:'Operação recusada ou serviço indisponível'},{status:503,headers:{'Cache-Control':'no-store'}});}
export async function boundedJson(request:Request){
 if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw new HttpError(415,'JSON necessário');
 const reader=request.body?.getReader();if(!reader)throw new HttpError(400,'Corpo ausente');
 const chunks:Uint8Array[]=[];let length=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>4096){await reader.cancel();throw new HttpError(413,'Corpo excessivo');}chunks.push(value);}}finally{reader.releaseLock();}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new HttpError(400,'JSON inválido');}
}
