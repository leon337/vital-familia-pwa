import {beforeEach,describe,expect,it,vi} from 'vitest';
vi.mock('server-only',()=>({}));
const state=vi.hoisted(()=>({id:'fixture-a',admitted:true,consent:true,quota:true,count:999,query:vi.fn(),release:vi.fn(),saved:new Map<string,{request_hash:string,result:unknown}>()}));
vi.mock('../lib/auth',()=>({auth:()=>({getSession:async()=>({data:{user:{id:state.id}}})})}));
vi.mock('pg',()=>({Pool:class{async connect(){return {query:state.query,release:state.release};}}}));
import {GET,POST} from '../app/api/records/route';
import {POST as consent} from '../app/api/consent/route';
import {POST as sharing} from '../app/api/sharing/route';
const reading={kind:'glucose',value:100,unit:'mg/dL',confirmed:true,context:'jejum',measuredAt:'2026-10-01T00:00:00Z'};
function request(body:unknown,key='synthetic-key-0001'){return new Request('https://synthetic.test/api',{method:'POST',headers:{origin:'https://synthetic.test','content-type':'application/json','idempotency-key':key},body:JSON.stringify(body)});}
describe('admission, complete exports and authorized idempotency',()=>{
 beforeEach(()=>{
  process.env.SYNTHETIC_BACKEND_ENABLED='true';process.env.AUTH_SECURITY_VALIDATED='true';process.env.REAL_DATA_APPROVED='true';process.env.APP_ORIGIN='https://synthetic.test';process.env.ACTOR_SIGNING_KEY='synthetic-only-'.repeat(6);process.env.DATABASE_URL='postgresql://synthetic.invalid/test';
  state.id='fixture-a';state.admitted=true;state.consent=true;state.quota=true;state.count=999;state.saved.clear();state.query.mockReset();
  state.query.mockImplementation(async(sql:string,args:unknown[]=[])=>{
   if(sql.includes('pg_roles WHERE'))return {rows:[{}]};
   if(sql.includes('txid_current'))return {rows:[{id:'123'}]};
   if(sql.includes('require_admission')||sql.includes('lock_patient_admission'))return {rows:[{ok:state.admitted}]};
   if(sql.includes('app.actor()=$1'))return {rows:[{ok:true}]};
   if(sql.includes('take_quota'))return {rows:[{ok:state.quota}]};
   if(sql.includes('can_access'))return {rows:[{ok:state.consent&&args[0]==='fixture-a'}]};
   if(sql.startsWith('SELECT id,payload'))return {rows:Array.from({length:state.count},(_,i)=>({id:`fixture-${i}`,payload:reading}))};
   if(sql.startsWith('SELECT request_hash'))return {rows:state.saved.has(String(args[1]))?[state.saved.get(String(args[1]))]:[]};
   if(sql.startsWith('INSERT INTO app.write_requests')){state.saved.set(String(args[1]),{request_hash:String(args[2]),result:JSON.parse(String(args[3]))});return {rows:[]};}
   if(sql.startsWith('INSERT INTO app.measurements'))return {rows:[{id:'synthetic-id'}]};
   return {rows:[]};
  });
 });
 it.each([999,1000,1001])('exports all %i records with tied timestamps',async count=>{
  state.count=count;const response=await GET(new Request('https://synthetic.test/api/records?format=csv'));
  expect(response.status).toBe(200);const lines=(await response.text()).split('\r\n');expect(lines).toHaveLength(count+1);expect(new Set(lines.slice(1)).size).toBe(count);
  const sql=state.query.mock.calls.find(([sql])=>sql.startsWith('SELECT id,payload'))?.[0];expect(sql).toContain('measured_at DESC,id DESC');expect(sql).not.toContain('LIMIT');
 });
 it.each([999,1000,1001])('JSON explicitly refuses truncation at %i',async count=>{state.count=count;const response=await GET(new Request('https://synthetic.test/api/records'));expect(response.status).toBe(count>1000?409:200);});
 it.each([false,true])('denies unadmitted identity before consent, sharing, records and CSV (consent=%s)',async accepted=>{
  state.admitted=false;
  for(const response of [await consent(request({accepted,version:'2026-10-27.v1'})),await sharing(request({caregiverId:'fixture-b',active:true})),await POST(request(reading)),await GET(new Request('https://synthetic.test/api?format=csv'))])expect(response.status).toBe(403);
  expect(state.query.mock.calls.some(([sql])=>sql.startsWith('INSERT')||sql.startsWith('SELECT id,payload'))).toBe(false);
 });
 it('denies invalid session before any DB context',async()=>{state.id='bad:identity';expect((await POST(request(reading))).status).toBe(401);expect(state.query).not.toHaveBeenCalled();});
 it('denies IDOR and withdrawn consent for exports',async()=>{expect((await GET(new Request('https://synthetic.test/api?format=csv&patient=fixture-b'))).status).toBe(403);state.consent=false;expect((await GET(new Request('https://synthetic.test/api?format=csv'))).status).toBe(403);});
 it('replays once, conflicts on changed content, and requires current consent',async()=>{
  expect((await POST(request(reading))).status).toBe(201);expect((await POST(request(reading))).status).toBe(201);
  expect(state.query.mock.calls.filter(([sql])=>sql.startsWith('INSERT INTO app.measurements'))).toHaveLength(1);
  expect((await POST(request({...reading,value:101}))).status).toBe(409);
  state.consent=false;expect((await POST(request(reading))).status).toBe(403);
 });
 it('rejects missing keys and payload IDOR',async()=>{expect((await POST(request(reading,''))).status).toBe(400);expect((await POST(request({...reading,patient:'fixture-b'}))).status).toBe(400);});
 it('commits distributed quota denial before returning 429',async()=>{state.quota=false;expect((await POST(request(reading))).status).toBe(429);expect(state.query).toHaveBeenLastCalledWith('COMMIT');});
});
