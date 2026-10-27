import {beforeEach,describe,expect,it,vi} from 'vitest';
vi.mock('server-only',()=>({}));
const backend=vi.hoisted(()=>({actor:vi.fn(),enabled:vi.fn()}));
vi.mock('../lib/backend',()=>backend);
const sdk=vi.hoisted(()=>({create:vi.fn(()=>({getSession:vi.fn(),signOut:vi.fn(),signIn:{social:vi.fn()}}))}));
vi.mock('@neondatabase/auth/next',()=>({createAuthClient:sdk.create}));
import {privateAccess} from '../lib/private-access';
import {authClient} from '../lib/auth-client';
import {confirmedPayload,privateRequest,recordsPath,PrivateAPIError} from '../lib/private-api';
beforeEach(()=>{vi.unstubAllGlobals();backend.enabled.mockReturnValue(true);backend.actor.mockReset();});
describe('private server admission boundary',()=>{
 it('does not query session or data when flags are closed',async()=>{backend.enabled.mockReturnValue(false);expect(await privateAccess()).toBe('blocked');expect(backend.actor).not.toHaveBeenCalled();});
 it('shows login only on absent session',async()=>{backend.actor.mockRejectedValue(Object.assign(new Error(),{status:401}));expect(await privateAccess()).toBe('login');});
 it.each([403,429,503])('denies status %i',async status=>{backend.actor.mockRejectedValue(Object.assign(new Error(),{status}));expect(await privateAccess()).toBe('blocked');});
 it('fails closed on unexpected session errors',async()=>{backend.actor.mockRejectedValue(new Error());expect(await privateAccess()).toBe('blocked');});
 it('opens only the shell after server authorization',async()=>{backend.actor.mockResolvedValue('synthetic-a');expect(await privateAccess()).toBe('ready');});
});
describe('private browser boundary',()=>{
 it('uses default same-origin Neon adapter',()=>{expect(sdk.create).toHaveBeenCalledWith();expect(authClient.getSession).toBeDefined();expect(authClient.signOut).toBeDefined();});
 it('sends reviewed JSON with a stable retry key and no image or demo id',async()=>{
  const fetcher=vi.fn().mockResolvedValue(new Response('{}'));vi.stubGlobal('fetch',fetcher);
  const payload=confirmedPayload({id:'demo-id',kind:'glucose',value:100,unit:'mg/dL',context:'jejum',measuredAt:'2026-10-01T00:00:00Z'});
  for(let i=0;i<2;i++)await privateRequest('/api/records',payload,'synthetic-retry-key');
  expect(payload).not.toHaveProperty('id');expect(payload.confirmed).toBe(true);
  expect(fetcher.mock.calls[0]).toEqual(fetcher.mock.calls[1]);
  expect(fetcher.mock.calls[0][1]).toMatchObject({cache:'no-store',credentials:'same-origin',headers:{'Content-Type':'application/json','Idempotency-Key':'synthetic-retry-key'},body:JSON.stringify(payload)});
 });
 it.each([401,403,409,503])('does not return denial bodies to the UI (%i)',async status=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{"sensitive":"never render"}',{status})));await expect(privateRequest('/api/records')).rejects.toEqual(new PrivateAPIError(status));});
 it('exports from the full authorized endpoint, independently of rendered records',()=>{expect(recordsPath('',true)).toBe('/api/records?format=csv');expect(recordsPath('synthetic-patient',true)).toBe('/api/records?patient=synthetic-patient&format=csv');});
});
