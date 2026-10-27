import {z} from 'zod';
export const consentVersion = '2026-10-27.v1';
const base = { measuredAt:z.iso.datetime({offset:true}).refine(v=>new Date(v).getTime()<=Date.now(), 'Data futura inválida'), context:z.enum(['jejum','após refeição','repouso','outro']) };
export const measurementSchema = z.discriminatedUnion('kind',[
 z.object({...base,kind:z.literal('glucose'),value:z.number().int().min(20).max(600)}).strict(),
 z.object({...base,kind:z.literal('pressure'),systolic:z.number().int().min(50).max(260),diastolic:z.number().int().min(30).max(160)}).strict().refine(v=>v.systolic>v.diastolic,'Sistólica deve superar diastólica')
]);
// Persisted OCR/manual readings require an explicit reviewed submission; images are never accepted.
export const confirmedMeasurementSchema = z.discriminatedUnion('kind',[
 z.object({...base,kind:z.literal('glucose'),value:z.number().min(1).max(600),unit:z.enum(['mg/dL','mmol/L']),confirmed:z.literal(true)}).strict().refine(v=>v.unit==='mg/dL'?Number.isInteger(v.value)&&v.value>=20:v.value>=1.1&&v.value<=33.3),
 z.object({...base,kind:z.literal('pressure'),systolic:z.number().int().min(50).max(260),diastolic:z.number().int().min(30).max(160),pulse:z.number().int().min(20).max(250),confirmed:z.literal(true)}).strict().refine(v=>v.systolic>v.diastolic)
]);
export type Measurement = z.infer<typeof measurementSchema> & {id:string;unit?:'mg/dL'|'mmol/L';pulse?:number};
export function syntheticRecords():Measurement[]{return Array.from({length:14},(_,i)=>{const measuredAt=new Date(Date.UTC(2026,9,13+i,11)).toISOString();return i%2===0?{id:`demo-${i}`,kind:'glucose',value:90+(i*7)%42,context:'jejum',measuredAt}:{id:`demo-${i}`,kind:'pressure',systolic:112+(i*3)%22,diastolic:72+i%12,context:'repouso',measuredAt};});}
export function csv(records:Measurement[]){return '\uFEFF'+['id,data,tipo,glicemia_mg_dL,glicemia_mmol_L,sistolica_mmHg,diastolica_mmHg,pulso_bpm,contexto',...records.map(r=>[r.id,r.measuredAt,r.kind,r.kind==='glucose'&&r.unit!=='mmol/L'?r.value:'',r.kind==='glucose'&&r.unit==='mmol/L'?r.value:'',r.kind==='pressure'?r.systolic:'',r.kind==='pressure'?r.diastolic:'',r.kind==='pressure'?r.pulse??'':'',r.context].map(v=>'"'+String(v).replace(/^[=+@\-]/,"'$&").replaceAll('"','""')+'"').join(','))].join('\r\n');}
