import {beforeEach,describe,it,expect,vi} from 'vitest';
vi.mock('server-only',()=>({}));
const session=vi.hoisted(()=>vi.fn());
vi.mock('../lib/auth',()=>({auth:()=>({getSession:session})}));
const db=vi.hoisted(()=>({query:vi.fn(),release:vi.fn()}));
vi.mock('pg',()=>({Pool:class{async connect(){return db;}}}));
import {actor,sameOrigin} from '../lib/backend';
import {GET,POST} from '../app/api/records/route';
import {POST as consent} from '../app/api/consent/route';
import {POST as sharing} from '../app/api/sharing/route';
import {POST as education} from '../app/api/education/route';
describe('negação por padrão',()=>{
 beforeEach(()=>{process.env.SYNTHETIC_BACKEND_ENABLED='false';process.env.AUTH_SECURITY_VALIDATED='true';process.env.REAL_DATA_APPROVED='true';process.env.APP_ORIGIN='http://localhost:3000';session.mockReset();process.env.ACTOR_SIGNING_KEY='synthetic-only-'.repeat(6);process.env.DATABASE_URL='postgresql://synthetic.invalid/test';db.query.mockImplementation(async(sql:string)=>{if(sql.includes('pg_roles WHERE rolname=current_user'))return {rows:[{}]};if(sql.includes('txid_current'))return {rows:[{id:'123'}]};return {rows:[{ok:true}]};});});
 it('recusa backend sem ativação explícita',async()=>{await expect(actor()).rejects.toMatchObject({status:503});expect((await GET(new Request('http://localhost:3000/api/records?patient=victim'))).status).toBe(503);});
 it.each(['AUTH_SECURITY_VALIDATED','REAL_DATA_APPROVED'])('bloqueia histórico e CSV sem gate %s',async gate=>{
  process.env.SYNTHETIC_BACKEND_ENABLED='true';process.env[gate]='false';
  for(const suffix of ['', '?format=csv'])expect((await GET(new Request('http://localhost:3000/api/records'+suffix))).status).toBe(503);
  expect(session).not.toHaveBeenCalled();
 });
 it('recusa sessão ausente mesmo com backend habilitado',async()=>{process.env.SYNTHETIC_BACKEND_ENABLED='true';session.mockResolvedValue({data:null});expect((await GET(new Request('http://localhost:3000/api/records'))).status).toBe(401);});
 it('verifica origem em toda escrita',async()=>{expect(()=>sameOrigin(new Request('http://localhost:3000'))).toThrow();for(const handler of [POST,consent,sharing])expect((await handler(new Request('http://localhost:3000',{method:'POST',headers:{Origin:'https://evil.test'},body:'{}'}))).status).toBe(403);});
 it('recusa payload que tenta escolher outro paciente',async()=>{process.env.SYNTHETIC_BACKEND_ENABLED='true';session.mockResolvedValue({data:{user:{id:'synthetic-user'}}});expect((await POST(new Request('http://localhost:3000',{method:'POST',headers:{Origin:'http://localhost:3000','Content-Type':'application/json','Idempotency-Key':'synthetic-key-0001'},body:JSON.stringify({kind:'glucose',value:100,context:'jejum',measuredAt:'2026-10-01T00:00:00Z',patient:'victim'})}))).status).toBe(400);});
 it.each([undefined,null,'',123,'bad:actor','actor\nforged'])('recusa identidade de sessão inválida %j',async id=>{process.env.SYNTHETIC_BACKEND_ENABLED='true';session.mockResolvedValue({data:{user:{id}}});await expect(actor()).rejects.toMatchObject({status:401});});
 it('não executa Gemini',async()=>{expect((await education()).status).toBe(503);});
});
