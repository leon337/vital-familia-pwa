import 'server-only';
import {createHash,createHmac} from 'node:crypto';
import {Pool, type PoolClient} from 'pg';
import {auth} from './auth';
let pool:Pool|undefined;
export class HttpError extends Error {constructor(public status:number,message:string){super(message);}}
export function enabled(){return process.env.SYNTHETIC_BACKEND_ENABLED==='true' && process.env.AUTH_SECURITY_VALIDATED==='true' && process.env.REAL_DATA_APPROVED==='true';}
export async function actor(){
 if(!enabled()) throw new HttpError(503,'Backend sintético não habilitado');
 const {data,error}=await auth().getSession();
 if(error||!validIdentity(data?.user?.id)) throw new HttpError(401,'Autenticação necessária');
 const allowed=await transaction(data.user.id,data.user.id,async c=>(await c.query('SELECT app.take_quota() AS ok')).rows[0]?.ok===true);
 if(!allowed)throw new HttpError(429,'Limite de requisições excedido');
 return data.user.id;
}
export function validIdentity(value:unknown):value is string{return typeof value==='string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/.test(value);}
export function sameOrigin(request:Request){if(request.headers.get('origin')!==process.env.APP_ORIGIN)throw new HttpError(403,'Origem recusada');}
export async function transaction<T>(user:string,patient:string,fn:(c:PoolClient)=>Promise<T>):Promise<T>{
 if(!enabled())throw new HttpError(503,'Backend não habilitado');
 if(!validIdentity(user)||!validIdentity(patient))throw new HttpError(401,'Identidade inválida');
 const key=process.env.ACTOR_SIGNING_KEY;
 if(!key||key.length<64||!process.env.DATABASE_URL)throw new HttpError(503,'Banco não configurado');
 pool??=new Pool({connectionString:process.env.DATABASE_URL,max:5,ssl:{rejectUnauthorized:true},connectionTimeoutMillis:5000,statement_timeout:10000});
 const c=await pool.connect();
 try {await c.query('BEGIN');
 const role=await c.query("SELECT rolsuper,rolbypassrls, (EXISTS(SELECT 1 FROM pg_class t JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='vital_private' AND t.relname IN ('actor_keys','admissions') AND has_table_privilege(current_user,t.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')) OR has_schema_privilege(current_user,'app','CREATE') OR has_schema_privilege(current_user,'vital_private','CREATE')) AS unsafe_private_access, EXISTS(SELECT 1 FROM pg_roles r WHERE r.rolname<>current_user AND pg_has_role(current_user,r.oid,'MEMBER') AND (r.rolsuper OR r.rolbypassrls OR EXISTS(SELECT 1 FROM pg_namespace n WHERE n.nspowner=r.oid AND n.nspname IN ('app','vital_private')))) AS unsafe_membership, EXISTS(SELECT 1 FROM pg_class WHERE relnamespace='app'::regnamespace AND relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)) AS owns_tables FROM pg_roles WHERE rolname=current_user");
 if(!role.rows[0]||role.rows[0].rolsuper||role.rows[0].rolbypassrls||role.rows[0].owns_tables||role.rows[0].unsafe_membership||role.rows[0].unsafe_private_access)throw new Error('Unsafe database role');
 const {rows}=await c.query('SELECT txid_current()::text AS id');
 const signature=createHmac('sha256',key).update(`${rows[0].id}:${user}`).digest('hex');
 await c.query("SELECT set_config('app.actor',$1,true),set_config('app.actor_signature',$2,true)",[user,signature]);
 await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['actor:'+user]);
 await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['patient:'+patient]);
 const admitted=await c.query('SELECT app.require_admission() AS ok');
 if(admitted.rows[0]?.ok!==true)throw new HttpError(403,'Admissão necessária');
 const verified=await c.query('SELECT app.actor()=$1 AS ok',[user]);
 if(verified.rows[0]?.ok!==true)throw new HttpError(503,'Identidade do banco não validada');
 const patientAdmission=await c.query('SELECT app.lock_patient_admission($1) AS ok',[patient]);
 if(patientAdmission.rows[0]?.ok!==true)throw new HttpError(403,'Acesso recusado');
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

// Clients must use random keys, never health values. Store only keyed digests and response identifiers.
export function idempotencyKey(request:Request){
 const key=request.headers.get('Idempotency-Key');
 if(!key||!/^[A-Za-z0-9_-]{16,128}$/.test(key))throw new HttpError(400,'Idempotency-Key obrigatório (16–128 caracteres)');
 return createHash('sha256').update(key).digest('hex');
}
export async function writeOnce<T>(c:PoolClient,scope:string,key:string,body:unknown,work:()=>Promise<T>):Promise<T>{
 const signingKey=process.env.ACTOR_SIGNING_KEY;
 if(!signingKey||signingKey.length<64)throw new HttpError(503,'Idempotência não configurada');
 const digest=createHmac('sha256',signingKey).update('idempotency:'+scope+':'+JSON.stringify(body)).digest('hex');
 const previous=await c.query('SELECT request_hash,result FROM app.write_requests WHERE actor_id=app.actor() AND scope=$1 AND key_hash=$2',[scope,key]);
 if(previous.rows[0]){
  if(previous.rows[0].request_hash!==digest)throw new HttpError(409,'Chave reutilizada com conteúdo diferente');
  return previous.rows[0].result as T;
 }
 const result=await work();
 await c.query('INSERT INTO app.write_requests(actor_id,scope,key_hash,request_hash,result) VALUES(app.actor(),$1,$2,$3,$4)',[scope,key,digest,JSON.stringify(result)]);
 return result;
}
