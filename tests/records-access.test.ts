import {beforeEach,describe,it,expect,vi} from 'vitest';
vi.mock('server-only',()=>({}));
const state=vi.hoisted(()=>({session:vi.fn(),query:vi.fn(),release:vi.fn(),admitted:true,patientAdmitted:true,access:true,quota:true,rows:[] as {id:string,payload:object}[]}));
vi.mock('../lib/auth',()=>({auth:()=>({getSession:state.session})}));
vi.mock('pg',()=>({Pool:class{async connect(){return {query:state.query,release:state.release};}}}));
import {GET,POST} from '../app/api/records/route';
import {POST as consent} from '../app/api/consent/route';
import {POST as sharing,GET as getSharing} from '../app/api/sharing/route';
const reading={kind:'glucose',value:100,unit:'mg/dL',confirmed:true,context:'jejum',measuredAt:'2026-10-01T00:00:00Z'};
function request(path='records',body:unknown=reading){return new Request(`https://synthetic.test/api/${path}`,{method:'POST',headers:{Origin:'https://synthetic.test','Content-Type':'application/json','Idempotency-Key':'synthetic-key-0001'},body:JSON.stringify(body)});}
beforeEach(()=>{
 process.env.SYNTHETIC_BACKEND_ENABLED='true';process.env.AUTH_SECURITY_VALIDATED='true';process.env.REAL_DATA_APPROVED='true';
 process.env.APP_ORIGIN='https://synthetic.test';process.env.ACTOR_SIGNING_KEY='synthetic-only-'.repeat(6);process.env.DATABASE_URL='postgresql://synthetic.invalid/test';
 state.admitted=true;state.patientAdmitted=true;state.access=true;state.quota=true;state.rows=[];state.query.mockReset();
 state.session.mockResolvedValue({data:{user:{id:'synthetic-a'}}});
 state.query.mockImplementation(async(sql:string)=>{
  if(sql.includes('pg_roles WHERE rolname=current_user'))return {rows:[{}]};
  if(sql==='SELECT txid_current()::text AS id')return {rows:[{id:'123'}]};
  if(sql.includes('app.require_admission'))return {rows:[{ok:state.admitted}]};
  if(sql.includes('app.lock_patient_admission'))return {rows:[{ok:state.patientAdmitted}]};
  if(sql.includes('app.take_quota'))return {rows:[{ok:state.quota}]};
  if(sql.includes('app.actor()=$1'))return {rows:[{ok:true}]};
  if(sql.includes('app.can_access'))return {rows:[{ok:state.access}]};
  if(sql.startsWith('SELECT id,payload'))return {rows:sql.includes('LIMIT 1001')?state.rows.slice(0,1001):state.rows};
  if(sql.startsWith('INSERT INTO app.measurements'))return {rows:[{id:'synthetic-result'}]};
  return {rows:[]};
 });
});
describe('exportação completa e autorização',()=>{
 it.each([999,1000,1001])('CSV inclui todos os %i registros com timestamps iguais',async count=>{
  state.rows=Array.from({length:count},(_,i)=>({id:`synthetic-${i}`,payload:reading}));
  const response=await GET(new Request('https://synthetic.test/api/records?format=csv'));
  expect(response.status).toBe(200);expect((await response.text()).split('\r\n')).toHaveLength(count+1);
  expect(state.query).toHaveBeenCalledWith('SELECT id,payload FROM app.measurements WHERE patient_id=$1 ORDER BY measured_at DESC,id DESC',['synthetic-a']);
 });
 it.each([999,1000,1001])('JSON não oculta limite em %i registros',async count=>{
  state.rows=Array.from({length:count},(_,i)=>({id:`synthetic-${i}`,payload:reading}));
  const response=await GET(new Request('https://synthetic.test/api/records'));
  expect(response.status).toBe(count>1000?409:200);
  const body=await response.json();if(count<=1000)expect(body).toHaveLength(count);else expect(body.error).toContain('format=csv');
 });
 it.each(['','?format=csv'])('nega IDOR e consentimento retirado %s',async format=>{
  state.access=false;const response=await GET(new Request(`https://synthetic.test/api/records${format?format+'&':'?'}patient=synthetic-victim`));
  expect(response.status).toBe(403);expect(state.query.mock.calls.some(([sql])=>sql.startsWith('SELECT id,payload'))).toBe(false);
 });
 it('nega paciente com admissão revogada',async()=>{state.patientAdmitted=false;expect((await GET(new Request('https://synthetic.test/api/records?format=csv'))).status).toBe(403);});
 it('nega ator não admitido em todas as rotas privadas antes de ler corpo ou dados',async()=>{
  state.admitted=false;
  for(const handler of [POST,consent,sharing])expect((await handler(request())).status).toBe(403);
  expect((await GET(new Request('https://synthetic.test/api/records?format=csv'))).status).toBe(403);
  expect((await getSharing()).status).toBe(403);
  expect(state.query.mock.calls.some(([sql])=>sql.startsWith('INSERT INTO app.'))).toBe(false);
 });
 it('retorna 429 antes do trabalho privado quando quota distribuída nega',async()=>{state.quota=false;expect((await POST(request())).status).toBe(429);expect(state.query.mock.calls.some(([sql])=>sql.startsWith('INSERT INTO app.'))).toBe(false);});
 it('nega escrita sem consentimento inclusive replay',async()=>{state.access=false;expect((await POST(request())).status).toBe(403);expect(state.query.mock.calls.some(([sql])=>sql.includes('FROM app.write_requests'))).toBe(false);});
});
