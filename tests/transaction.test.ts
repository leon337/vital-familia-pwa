import {beforeEach,describe,expect,it,vi} from 'vitest';
import {createHmac} from 'node:crypto';
vi.mock('server-only',()=>({}));
vi.mock('../lib/auth',()=>({auth:()=>({})}));
const db=vi.hoisted(()=>({query:vi.fn(),release:vi.fn()}));
vi.mock('pg',()=>({Pool:class{async connect(){return db;}}}));
import {transaction} from '../lib/backend';
describe('contexto transacional autenticado',()=>{
 beforeEach(()=>{
  process.env.ACTOR_SIGNING_KEY='synthetic-only-'.repeat(6);
  process.env.DATABASE_URL='postgresql://synthetic.invalid/test';
  db.query.mockReset();db.release.mockReset();
  db.query.mockImplementation(async(sql:string)=>{
   if(sql.includes('pg_roles WHERE rolname=current_user'))return {rows:[{rolsuper:false,rolbypassrls:false,owns_tables:false}]};
   if(sql==='SELECT txid_current()::text AS id')return {rows:[{id:'123'}]};
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
 it.each(['rolsuper','rolbypassrls','owns_tables'])('recusa papel privilegiado: %s',async privilege=>{
  db.query.mockResolvedValue({rows:[{[privilege]:true}]});
  const work=vi.fn();await expect(transaction('synthetic-a','synthetic-a',work)).rejects.toThrow('Unsafe database role');
  expect(work).not.toHaveBeenCalled();expect(db.query).toHaveBeenLastCalledWith('ROLLBACK');expect(db.release).toHaveBeenCalledOnce();
 });
 it('rollback e release em erro de negócio',async()=>{
  await expect(transaction('synthetic-a','synthetic-a',async()=>{throw new Error('synthetic');})).rejects.toThrow('synthetic');
  expect(db.query).toHaveBeenLastCalledWith('ROLLBACK');expect(db.release).toHaveBeenCalledOnce();
 });
});
