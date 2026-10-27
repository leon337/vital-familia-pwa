import {expect,it,vi} from 'vitest';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// A fresh V8 per control is essential: resetModules does not reset externalized
// Zod's memoized Function capability probe. Never run the positive probe here.
// This static ESM script resolves both imports from this checkout. Only the leaf
// wrapper is loaded as TS: Node 24 strips its types, with no extensionless local
// imports to resolve (domain/auth still need Vitest's transform).
const controlScript=`
import assert from 'node:assert/strict';
const positive = process.argv[1] === 'positive';
const originalFunction = globalThis.Function;
let calls = 0;
globalThis.Function = function () {
 calls++;
 throw new Error('Synthetic CSP');
};
try {
 const {z: raw} = await import('zod');
 raw.core.config({jitless:false});
 const z = positive ? raw : (await import('./lib/zod.ts')).z;
 assert.equal(z, raw);
 assert.equal(z.core.config().jitless, !positive);
 const schema = z.object({value:z.string()}).strict();
 assert.equal(schema.safeParse({value:'ok'}).success, true);
 for (const invalid of [{value:42}, {value:'ok', extra:true}, null, [], {}]) {
  assert.equal(schema.safeParse(invalid).success, false);
 }
 assert.equal(positive ? calls > 0 : calls === 0, true);
} finally {
 globalThis.Function = originalFunction;
}
process.stdout.write('zod-control-ok');
`;

it.each(['positive','negative'] as const)('controle isolado de Function: %s',scenario=>{
 const result=spawnSync(process.execPath,[
  '--experimental-strip-types','--input-type=module','-e',controlScript,scenario,
 ],{
  cwd:fileURLToPath(new URL('../',import.meta.url)),
  // Explicit allowlist: no inherited credentials, tokens, NODE_OPTIONS or loaders.
  env:{NODE_ENV:'test',TZ:'UTC'},
  encoding:'utf8',timeout:10_000,maxBuffer:16*1024,
 });
 // Never include child stdout/stderr or raw errors in failure feedback.
 expect(result.error===undefined,`controle ${scenario}: falha ao executar`).toBe(true);
 expect(result.signal,`controle ${scenario}: sinal de término`).toBeNull();
 expect(result.status,`controle ${scenario}: código de saída`).toBe(0);
 expect(result.stdout==='zod-control-ok',`controle ${scenario}: confirmação ausente`).toBe(true);
},15_000);

// App-only negative checks: resetting Vitest reloads app modules, not Zod's
// internal cache. No positive probe is allowed in this worker; the controls
// above cannot poison it. Restore the exact config instance and Function spy.
async function appZod(run:(z:typeof import('zod').z,probe:ReturnType<typeof vi.fn>)=>Promise<void>){
 vi.resetModules();
 const probe=vi.fn(()=>{throw new Error('CSP sintética: Function bloqueada');});
 const dynamicCode=vi.spyOn(globalThis,'Function').mockImplementation(probe);
 let restoreConfig:(()=>void)|undefined;
 try{
  const {z}=await import('zod');
  const previous={...z.core.config()};
  restoreConfig=()=>{z.core.config({...previous,jitless:previous.jitless});};
  // Do not clear the probe: import-time attempts must count too.
  await run(z,probe);
 }finally{
  restoreConfig?.();
  dynamicCode.mockRestore();
  vi.resetModules();
 }
}

it('configura jitless antes dos schemas e valida sem sondar Function',async()=>{
 await appZod(async(raw,probe)=>{
  raw.core.config({jitless:false});
  const {measurementSchema,confirmedMeasurementSchema}=await import('../lib/domain');
  const {z}=await import('../lib/zod');
  expect(z).toBe(raw);
  expect(z.core.config().jitless).toBe(true);
  const valid={kind:'glucose',value:100,unit:'mg/dL',context:'jejum',measuredAt:'2020-01-01T10:00:00Z'};
  expect(measurementSchema.safeParse(valid).success).toBe(true);
  expect(confirmedMeasurementSchema.safeParse({...valid,confirmed:true}).success).toBe(true);
  for(const invalid of [
   {...valid,value:NaN}, {...valid,value:Infinity}, {...valid,value:'100'},
   {...valid,value:0}, {...valid,unit:'mmol/L',value:34},
   {...valid,patient_id:'outro'}, {...valid,measuredAt:'inválida'},
   {...valid,measuredAt:'9999-01-01T00:00:00Z'},
   {kind:'pressure',systolic:80,diastolic:120,context:'repouso',measuredAt:valid.measuredAt},
   null, [], {},
  ]){
   expect(measurementSchema.safeParse(invalid).success).toBe(false);
   expect(confirmedMeasurementSchema.safeParse(invalid).success).toBe(false);
  }
  expect(confirmedMeasurementSchema.safeParse({...valid,confirmed:false}).success).toBe(false);
  expect(confirmedMeasurementSchema.safeParse(valid).success).toBe(false);
  expect(probe).not.toHaveBeenCalled();
 });
});

it.each(['client','server'] as const)('cold-import auth %s com SDK Neon real, sem I/O',async side=>{
 // Fail closed even if an SDK catches the thrown network error: assert calls too.
 // No env stubs, credentials, SDK mocks, auth() calls or session requests.
 const blocked=vi.fn(()=>{throw new Error('Import tentou acessar a rede');});
 const guards=[
  vi.spyOn(globalThis,'fetch').mockImplementation(blocked),
  vi.spyOn(http,'request').mockImplementation(blocked),
  vi.spyOn(http,'get').mockImplementation(blocked),
  vi.spyOn(https,'request').mockImplementation(blocked),
  vi.spyOn(https,'get').mockImplementation(blocked),
  vi.spyOn(net.Socket.prototype,'connect').mockImplementation(blocked),
  vi.spyOn(tls,'connect').mockImplementation(blocked),
 ];
 // Only the Next marker is replaced. Its default Node export throws outside
 // React Server conditions. This does NOT prove Next server bootstrap, browser
 // export conditions, hydration or CSP: those require the production Chromium
 // workflow (.github/workflows/f02-browser-ocr.yml), with zero CSP exemptions.
 if(side==='server') vi.doMock('server-only',()=>({}));
 try{
  await appZod(async(raw,probe)=>{
   raw.core.config({jitless:false});
   if(side==='client'){
    const module=await import('../lib/auth-client');
    expect(module.authClient).toBeDefined();
   }else{
    const module=await import('../lib/auth');
    expect(module.auth).toBeTypeOf('function');
   }
   const {z}=await import('../lib/zod');
   expect(z).toBe(raw);
   expect(z.core.config().jitless).toBe(true);
   expect(probe).not.toHaveBeenCalled();
   expect(blocked).not.toHaveBeenCalled();
  });
 }finally{
  if(side==='server') vi.doUnmock('server-only');
  for(const guard of guards.reverse()) guard.mockRestore();
 }
});
