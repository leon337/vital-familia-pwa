import {beforeEach,describe,expect,it,vi} from 'vitest';
import {createHmac} from 'node:crypto';
vi.mock('server-only',()=>({}));
vi.mock('../lib/auth',()=>({auth:()=>({})}));
const db=vi.hoisted(()=>({query:vi.fn(),release:vi.fn()}));
vi.mock('pg',()=>({Pool:class{async connect(){return db;}}}));
import {transaction} from '../lib/backend';
describe('contexto transacional autenticado',()=>{
 beforeEach(()=>{
  process.env.SYNTHETIC_BACKEND_ENABLED='true';process.env.AUTH_SECURITY_VALIDATED='true';process.env.REAL_DATA_APPROVED='true';
  process.env.ACTOR_SIGNING_KEY='synthetic-only-'.repeat(6);
  process.env.DATABASE_URL='postgresql://synthetic.invalid/test';
  db.query.mockReset();db.release.mockReset();
  db.query.mockImplementation(async(sql:string)=>{
   if(sql.includes('pg_roles WHERE rolname=current_user'))return {rows:[{rolsuper:false,rolbypassrls:false,owns_tables:false}]};
   if(sql==='SELECT txid_current()::text AS id')return {rows:[{id:'123'}]};
   if(sql==='SELECT app.require_admission() AS ok'||sql==='SELECT app.lock_patient_admission($1) AS ok')return {rows:[{ok:true}]};
   if(sql==='SELECT app.actor()=$1 AS ok')return {rows:[{ok:true}]};
   return {rows:[]};
  });
 });
 it('vincula assinatura ao usuário e transação antes da query de negócio',async()=>{
  const work=vi.fn(async()=>42);
  expect(await transaction('synthetic-a','synthetic-a',work)).toBe(42);
  const signature=createHmac('sha256',process.env.ACTOR_SIGNING_KEY!).update('123:synthetic-a').digest('hex');
  expect(db.query).toHaveBeenCalledWith("SELECT set_config('app.actor',$1,true),set_config('app.actor_signature',$2,true)",['synthetic-a',signature]);
  expect(db.query).toHaveBeenLastCalledWith('COMMIT');expect(db.release).toHaveBeenCalledOnce();
 });
 it.each(['rolsuper','rolbypassrls','owns_tables','unsafe_membership','unsafe_private_access'])('recusa papel privilegiado: %s',async privilege=>{
  db.query.mockResolvedValue({rows:[{[privilege]:true}]});
  const work=vi.fn();await expect(transaction('synthetic-a','synthetic-a',work)).rejects.toThrow('Unsafe database role');
  expect(work).not.toHaveBeenCalled();expect(db.query).toHaveBeenLastCalledWith('ROLLBACK');expect(db.release).toHaveBeenCalledOnce();
 });
 it.each(['', ' ', 'bad:identity', 'bad\nidentity', 123, null, 'x'.repeat(201)])('recusa identidade inválida %j antes de conectar',async id=>{const work=vi.fn();await expect(transaction(id as string,'synthetic-a',work)).rejects.toMatchObject({status:401});expect(db.query).not.toHaveBeenCalled();expect(work).not.toHaveBeenCalled();});
 it('nega admissão retirada antes de executar negócio',async()=>{db.query.mockImplementation(async(sql:string)=>{if(sql.includes('pg_roles WHERE rolname=current_user'))return {rows:[{}]};if(sql.includes('txid_current'))return {rows:[{id:'123'}]};return {rows:[{ok:false}]};});const work=vi.fn();await expect(transaction('synthetic-a','synthetic-a',work)).rejects.toMatchObject({status:403});expect(work).not.toHaveBeenCalled();});
 it('nega assinatura inválida antes do trabalho privado',async()=>{const normal=db.query.getMockImplementation()!;db.query.mockImplementation(async(sql:string,...args:unknown[])=>sql==='SELECT app.actor()=$1 AS ok'?{rows:[{ok:false}]}:normal(sql,...args));const work=vi.fn();await expect(transaction('synthetic-a','synthetic-a',work)).rejects.toMatchObject({status:503});expect(work).not.toHaveBeenCalled();expect(db.query).toHaveBeenLastCalledWith('ROLLBACK');});
 it('rollback e release em erro de negócio',async()=>{
  await expect(transaction('synthetic-a','synthetic-a',async()=>{throw new Error('synthetic');})).rejects.toThrow('synthetic');
  expect(db.query).toHaveBeenLastCalledWith('ROLLBACK');expect(db.release).toHaveBeenCalledOnce();
 });
});
