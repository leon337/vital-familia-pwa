type Worker = {recognize:(image:HTMLCanvasElement)=>Promise<{data:{text:string;confidence:number}}>;terminate:()=>Promise<unknown>};
type LocalOCR = {createWorker:(language:string,mode:number,options:Record<string,unknown>)=>Promise<Worker>};
import {validatePhoto} from './photo-file';
/** Only same-origin static engine assets; no remote OCR, telemetry or image persistence. */
export async function readPhoto(file:File,signal:AbortSignal,onPreview:(url:string)=>void){
 await validatePhoto(file);
 let worker:Worker|undefined;let canvas:HTMLCanvasElement|undefined;
 const check=()=>{if(signal.aborted)throw new Error('Leitura cancelada.');};
 let termination:Promise<unknown>|undefined;
 const stop=()=>{if(worker&&!termination)termination=worker.terminate().catch(()=>{});};signal.addEventListener('abort',stop,{once:true});
 try{
  check();const bitmap=await createImageBitmap(file);
  try {
   check();if(bitmap.width*bitmap.height>24000000||bitmap.width<80||bitmap.height<80)throw new Error('Dimensões recusadas. Use foto nítida de até 24 megapixels.');
   canvas=document.createElement('canvas');const scale=Math.min(1,1800/Math.max(bitmap.width,bitmap.height));
   canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
   const context=canvas.getContext('2d');if(!context)throw new Error('Imagem indisponível.');
   context.drawImage(bitmap,0,0,canvas.width,canvas.height);
  }finally{bitmap.close();}
  // Canvas strips metadata; the original file is never passed to OCR or preview.
  const blob=await new Promise<Blob>((resolve,reject)=>canvas!.toBlob(b=>b?resolve(b):reject(new Error('Imagem indisponível.')),'image/png'));
  check();onPreview(URL.createObjectURL(blob));
  const modulePath='/ocr/tesseract.esm.min.js';
  const ocrModule=await import(/* webpackIgnore: true */ modulePath) as {default?:LocalOCR}&Partial<LocalOCR>;
  const createWorker=ocrModule.default?.createWorker??ocrModule.createWorker;
  if(!createWorker)throw new Error('OCR indisponível.');check();
  worker=await createWorker('eng',1,{workerPath:'/ocr/worker.min.js',corePath:'/ocr/core',langPath:'/ocr/lang',workerBlobURL:false,cacheMethod:'none',gzip:true,logger:()=>{},errorHandler:()=>{}});
  check();const result=await worker.recognize(canvas);check();
  return {text:result.data.text,confidence:result.data.confidence};
 }finally{signal.removeEventListener('abort',stop);stop();await termination;if(canvas){canvas.width=0;canvas.height=0;}}
}
