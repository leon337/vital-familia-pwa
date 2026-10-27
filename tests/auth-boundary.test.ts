import {beforeEach,describe,expect,it,vi} from 'vitest';
vi.mock('server-only',()=>({}));
const upstream=vi.hoisted(()=>vi.fn());
vi.mock('../lib/auth',()=>({auth:()=>({handler:()=>({POST:upstream,GET:upstream})})}));
import {POST,GET} from '../app/api/auth/[...path]/route';
const context=(path:string)=>({params:Promise.resolve({path:path.split('/')})});
beforeEach(()=>{process.env.SYNTHETIC_BACKEND_ENABLED='true';process.env.AUTH_SECURITY_VALIDATED='true';process.env.REAL_DATA_APPROVED='true';process.env.APP_ORIGIN='https://synthetic.test';upstream.mockReset();upstream.mockResolvedValue(new Response('{}'));});
describe('provider login does not enroll application accounts',()=>{
 it.each(['sign-up/email','sign-in/email','admin/create-user','unknown'])('rejects %s without reaching provider',async path=>{expect((await POST(new Request('https://synthetic.test/api/auth/'+path,{method:'POST'}),context(path))).status).toBe(403);expect(upstream).not.toHaveBeenCalled();});
 it('forces login-only Google and refuses client signup overrides',async()=>{
  const request=(body:unknown)=>new Request('https://synthetic.test/api/auth/sign-in/social',{method:'POST',headers:{origin:'https://synthetic.test','content-type':'application/json'},body:JSON.stringify(body)});
  expect((await POST(request({provider:'google',disableSignUp:false}),context('sign-in/social'))).status).toBe(400);
  expect(upstream).not.toHaveBeenCalled();
  expect((await POST(request({provider:'google',callbackURL:'/'}),context('sign-in/social'))).status).toBe(200);
  expect(await upstream.mock.calls[0][0].json()).toEqual({provider:'google',callbackURL:'/',disableSignUp:true});
 });
 it('refuses signup GET too',async()=>{expect((await GET(new Request('https://synthetic.test/api/auth/sign-up/email'),context('sign-up/email'))).status).toBe(403);expect(upstream).not.toHaveBeenCalled();});
});
