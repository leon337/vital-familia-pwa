import {beforeEach,describe,it,expect,vi} from 'vitest';
vi.mock('server-only',()=>({}));
const upstream=vi.hoisted(()=>vi.fn());
vi.mock('../lib/auth',()=>({auth:()=>({handler:()=>({GET:upstream,POST:upstream})})}));
import {GET,POST} from '../app/api/auth/[...path]/route';
const context=(path:string)=>({params:Promise.resolve({path:path.split('/')})});
function request(path:string,body:unknown){return new Request(`https://synthetic.test/api/auth/${path}`,{method:'POST',headers:{Origin:'https://synthetic.test','Content-Type':'application/json'},body:JSON.stringify(body)});}
beforeEach(()=>{process.env.SYNTHETIC_BACKEND_ENABLED='true';process.env.AUTH_SECURITY_VALIDATED='true';process.env.REAL_DATA_APPROVED='true';process.env.APP_ORIGIN='https://synthetic.test';upstream.mockReset();upstream.mockImplementation(async()=>new Response('{}'));});
describe('OAuth provider separado da admissão da aplicação',()=>{
 it.each(['sign-up/email','sign-in/email','admin/create-user','invitation/accept','enroll'])('não encaminha cadastro %s',async path=>{expect((await POST(request(path,{}),context(path))).status).toBe(403);expect(upstream).not.toHaveBeenCalled();});
 it('força login-only Google no servidor',async()=>{expect((await POST(request('sign-in/social',{provider:'google'}),context('sign-in/social'))).status).toBe(200);expect(await upstream.mock.calls[0][0].json()).toEqual({provider:'google',disableSignUp:true});});
 it.each([{provider:'google',disableSignUp:false},{provider:'password'},{provider:'google',callbackURL:'https://evil.test'},null])('nega alteração de ingresso e callbacks hostis %j',async body=>{expect((await POST(request('sign-in/social',body),context('sign-in/social'))).status).toBeGreaterThanOrEqual(400);expect(upstream).not.toHaveBeenCalled();});
 it('mantém proxy desligado por padrão',async()=>{delete process.env.SYNTHETIC_BACKEND_ENABLED;expect((await GET(new Request('https://synthetic.test/api/auth/get-session'),context('get-session'))).status).toBe(503);expect(upstream).not.toHaveBeenCalled();});
});
