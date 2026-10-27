'use client';
import {useEffect,useRef,useState} from 'react';
import Image from 'next/image';
import {parseDisplay,type PhotoReading} from '@/lib/photo-parser';
import {measurementSchema,type Measurement} from '@/lib/domain';
import {readPhoto} from '@/lib/photo-ocr';
export default function PhotoCapture({onSave}:{onSave:(record:Measurement)=>void}){
 const [synthetic,setSynthetic]=useState(false),[preview,setPreview]=useState(''),[busy,setBusy]=useState(false),[status,setStatus]=useState(''),[manual,setManual]=useState(false),[reading,setReading]=useState<PhotoReading>(),[confirmed,setConfirmed]=useState(false);
 const [kind,setKind]=useState('glucose'),[unit,setUnit]=useState('mg/dL');
 const controller=useRef<AbortController|null>(null),url=useRef('');
 function discard(){controller.current?.abort();controller.current=null;if(url.current)URL.revokeObjectURL(url.current);url.current='';setPreview('');setReading(undefined);setConfirmed(false);setBusy(false);}
 useEffect(()=>()=>{controller.current?.abort();if(url.current)URL.revokeObjectURL(url.current);},[]);
 async function capture(file:File|undefined){
  if(!file||!synthetic)return;discard();setManual(false);setStatus('Preparando leitura local…');setBusy(true);
  const current=new AbortController();controller.current=current;
  const timer=setTimeout(()=>{current.abort();if(controller.current===current){setBusy(false);setStatus('Tempo esgotado. Tente outra foto ou use entrada manual.');}},45000);
  try{
   const data=await readPhoto(file,current.signal,src=>{if(current.signal.aborted){URL.revokeObjectURL(src);return;}url.current=src;setPreview(src);});
   if(current.signal.aborted)return;
   const result=parseDisplay(data.text,data.confidence);
   if(result.ok){setReading(result.reading);setKind(result.reading.kind);if(result.reading.kind==='glucose')setUnit(result.reading.unit);setStatus('Confira cada valor com a imagem. OCR pode errar.');}
   else setStatus(result.reason);
  }catch{if(!current.signal.aborted)setStatus('Não foi possível ler a imagem. Verifique formato, tamanho e nitidez; tente novamente ou use entrada manual.');}
  finally{clearTimeout(timer);if(controller.current===current)setBusy(false);}
 }
 function save(form:FormData){
  if(!synthetic||!confirmed||busy||(!reading&&!manual))return;
  const number=(name:string)=>{const s=String(form.get(name)??'');return /^\d+(?:[.,]\d+)?$/.test(s)?Number(s.replace(',','.')):NaN;};
  const data=measurementSchema.safeParse({kind,measuredAt:new Date().toISOString(),context:form.get('context'),...(kind==='glucose'?{value:number('value'),unit}:{systolic:number('systolic'),diastolic:number('diastolic'),...(form.get('pulse')?{pulse:number('pulse')}:{})})});
  if(!data.success){setConfirmed(false);setStatus('Valores inválidos ou fora dos limites técnicos. Confira os campos; nada foi registrado.');return;}
  discard();onSave({...data.data,id:crypto.randomUUID()});
 }
 return <section className="panel form-panel photo-panel" aria-labelledby="photo-title"><h2 id="photo-title">Foto do aparelho</h2><p>Use somente visor sintético. A imagem fica neste navegador durante a revisão e é descartada ao sair. Não use fotos ou medições reais.</p>
 <label className="check"><input type="checkbox" checked={synthetic} onChange={e=>{discard();setManual(false);setSynthetic(e.target.checked);}}/>Declaro que a imagem e os valores são fictícios. Autorizo a leitura local nesta sessão.</label>
 <div className="photo-actions"><label className="capture-button">Abrir câmera<input aria-label="Fotografar visor sintético" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={!synthetic||busy} onChange={e=>{void capture(e.target.files?.[0]);e.target.value='';}}/></label><label className="capture-button">Escolher da galeria<input aria-label="Escolher foto sintética da galeria" type="file" accept="image/jpeg,image/png,image/webp" disabled={!synthetic||busy} onChange={e=>{void capture(e.target.files?.[0]);e.target.value='';}}/></label></div>
 <p>Enquadre somente o visor, com unidade e rótulos SYS/DIA/PUL visíveis, sem reflexos. JPEG, PNG ou WebP, até 8 MB e 24 megapixels. Se a câmera não abrir, use a galeria.</p>
 <p role="status" aria-live="polite" aria-busy={busy}>{status}</p>
 {preview&&<figure className="photo-preview">{/* Local metadata-free blob, never sent to an image optimizer. */}<Image unoptimized width={1800} height={1800} style={{width:'auto',height:'auto'}} src={preview} alt="Visor sintético selecionado para conferir os valores"/><figcaption>Confira os números e as unidades diretamente nesta imagem.</figcaption></figure>}
 {(busy||preview)&&<button type="button" onClick={()=>{discard();setStatus('Foto descartada.');}}>Cancelar e descartar foto</button>}
 <button className="text-button" disabled={!synthetic||busy} onClick={()=>{setReading(undefined);setConfirmed(false);setManual(true);setStatus('Entrada manual: transcreva apenas os valores visíveis.');}}>Não consegui ler: preencher manualmente</button>
 {(reading||manual)&&!busy&&<form action={save} onChange={e=>{if((e.target as HTMLInputElement).type!=='checkbox')setConfirmed(false);}} key={manual?'manual':JSON.stringify(reading)}><h3>Revisar valores fictícios</h3><p>{manual?'Entrada manual':'Leitura extraída — ainda não registrada'}</p>
 <label>Tipo de aparelho<select value={kind} onChange={e=>{setKind(e.target.value);setConfirmed(false);}} disabled={!manual}><option value="glucose">Glicosímetro</option><option value="pressure">Medidor de pressão</option></select></label>
 {kind==='glucose'?<><label>Glicemia<input name="value" inputMode="decimal" required defaultValue={reading?.kind==='glucose'?reading.value:''}/></label><label>Unidade visível<select value={unit} onChange={e=>{setUnit(e.target.value);setConfirmed(false);}}><option value="mg/dL">mg/dL</option><option value="mmol/L">mmol/L</option></select></label></>:<div className="fields"><label>Sistólica (mmHg)<input name="systolic" inputMode="numeric" required defaultValue={reading?.kind==='pressure'?reading.systolic:''}/></label><label>Diastólica (mmHg)<input name="diastolic" inputMode="numeric" required defaultValue={reading?.kind==='pressure'?reading.diastolic:''}/></label><label>Pulso visível (bpm, opcional)<input name="pulse" inputMode="numeric" defaultValue={reading?.kind==='pressure'?reading.pulse??'':''}/></label></div>}
 <label>Contexto informado<select name="context" defaultValue="outro"><option value="outro">Outro / não informado</option><option value="jejum">Jejum</option><option value="após refeição">Após refeição</option><option value="repouso">Repouso</option></select></label>
 <label className="check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} onClick={e=>e.stopPropagation()}/>Conferi e confirmo os valores, as unidades e o contexto fictícios.</label>
 <button className="primary" disabled={!confirmed||!synthetic}>Registrar exemplo confirmado</button></form>}
 </section>;
}
