import {beforeEach,describe,it,expect,vi} from 'vitest';
vi.mock('server-only',()=>({}));
const session=vi.hoisted(()=>vi.fn());
vi.mock('../lib/auth',()=>({auth:()=>({getSession:session})}));
import {actor,sameOrigin} from '../lib/backend';
import {GET,POST} from '../app/api/records/route';
import {POST as consent} from '../app/api/consent/route';
import {POST as sharing} from '../app/api/sharing/route';
import {POST as education} from '../app/api/education/route';
describe('negação por padrão',()=>{
 beforeEach(()=>{process.env.SYNTHETIC_BACKEND_ENABLED='false';process.env.APP_ORIGIN='http://localhost:3000';session.mockReset();});
 it('recusa backend sem ativação explícita',async()=>{await expect(actor()).rejects.toMatchObject({status:503});expect((await GET(new Request('http://localhost:3000/api/records?patient=victim'))).status).toBe(503);});
 it('recusa sessão ausente mesmo com backend habilitado',async()=>{process.env.SYNTHETIC_BACKEND_ENABLED='true';session.mockResolvedValue({data:null});expect((await GET(new Request('http://localhost:3000/api/records'))).status).toBe(401);});
 it('verifica origem em toda escrita',async()=>{expect(()=>sameOrigin(new Request('http://localhost:3000'))).toThrow();for(const handler of [POST,consent,sharing])expect((await handler(new Request('http://localhost:3000',{method:'POST',headers:{Origin:'https://evil.test'},body:'{}'}))).status).toBe(403);});
 it('recusa payload que tenta escolher outro paciente',async()=>{process.env.SYNTHETIC_BACKEND_ENABLED='true';session.mockResolvedValue({data:{user:{id:'synthetic-user'}}});expect((await POST(new Request('http://localhost:3000',{method:'POST',headers:{Origin:'http://localhost:3000'},body:JSON.stringify({kind:'glucose',value:100,context:'jejum',measuredAt:'2026-10-01T00:00:00Z',patient:'victim'})}))).status).toBe(400);});
 it('não executa Gemini',async()=>{expect((await education()).status).toBe(503);});
});
