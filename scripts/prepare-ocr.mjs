// Build-time only. The browser must never contact the distribution CDN.
// Exact versions; fail the build if any required static asset is unavailable.
import {mkdir,writeFile,rm} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
const root=resolve('public/ocr');
const assets=[
 ['tesseract.esm.min.js','tesseract.js@6.0.1/dist/tesseract.esm.min.js'],
 ['worker.min.js','tesseract.js@6.0.1/dist/worker.min.js'],
 ['LICENSE-tesseract.txt','tesseract.js@6.0.1/LICENSE.md'],
 ['LICENSE-core.txt','tesseract.js-core@6.0.0/LICENSE'],
 ['lang/eng.traineddata.gz','@tesseract.js-data/eng@1.0.0/4.0.0_best_int/eng.traineddata.gz'],
];
for(const variant of ['', '-simd','-lstm','-simd-lstm']){
 for(const suffix of ['.wasm.js','.wasm']){
  const name=`tesseract-core${variant}${suffix}`;assets.push([`core/${name}`,`tesseract.js-core@6.0.0/${name}`]);
 }
}
await rm(root,{recursive:true,force:true});
try{
 for(const [name,path] of assets){
  const response=await fetch(`https://cdn.jsdelivr.net/npm/${path}`,{signal:AbortSignal.timeout(60000),redirect:'error'});
  if(!response.ok)throw new Error(`OCR static asset unavailable: ${name} (${response.status})`);
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(!bytes.length||bytes.length>20000000)throw new Error(`Invalid asset size: ${name}`);
  const destination=resolve(root,name);await mkdir(dirname(destination),{recursive:true});await writeFile(destination,bytes);
 }
}catch(error){await rm(root,{recursive:true,force:true});throw error;}
