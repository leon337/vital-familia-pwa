import {describe,it,expect,vi} from 'vitest';
import type {PoolClient} from 'pg';
vi.mock('server-only',()=>({}));
vi.mock('../lib/auth',()=>({auth:()=>({})}));
import {idempotencyKey,writeOnce} from '../lib/backend';
describe('idempotência sem payload clínico persistido',()=>{
 it.each([null,'','short','bad key'.repeat(4)])('recusa chave ausente/inválida %j',key=>{const headers=new Headers();if(key!==null)headers.set('Idempotency-Key',key);expect(()=>idempotencyKey(new Request('https://synthetic.test',{headers}))).toThrow();});
 it('deduplica, isola scope e recusa conteúdo divergente',async()=>{
  process.env.ACTOR_SIGNING_KEY='synthetic-only-'.repeat(6);
  const saved=new Map();const query=vi.fn(async(sql:string,params:unknown[])=>{
   if(sql.startsWith('SELECT'))return {rows:saved.has(`${params[0]}:${params[1]}`)?[saved.get(`${params[0]}:${params[1]}`)]:[]};
   saved.set(`${params[0]}:${params[1]}`,{request_hash:params[2],result:JSON.parse(params[3] as string)});return {rows:[]};
  });const c={query} as unknown as PoolClient;const work=vi.fn(async()=>({id:'synthetic-result'}));
  expect(await writeOnce(c,'records','key',{confirmed:true},work)).toEqual({id:'synthetic-result'});
  expect(await writeOnce(c,'records','key',{confirmed:true},work)).toEqual({id:'synthetic-result'});expect(work).toHaveBeenCalledOnce();
  await expect(writeOnce(c,'records','key',{confirmed:false},work)).rejects.toMatchObject({status:409});
  await writeOnce(c,'consent','key',{confirmed:true},work);expect(work).toHaveBeenCalledTimes(2);
  expect(JSON.stringify([...saved.values()])).not.toContain('confirmed');
 });
});
