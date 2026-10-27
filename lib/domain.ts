import {z} from 'zod';
export const consentVersion = '2026-10-27.v1';
const base = { measuredAt:z.iso.datetime({offset:true}).refine(v=>new Date(v).getTime()<=Date.now(), 'Data futura inválida'), context:z.enum(['jejum','após refeição','repouso','outro']) };
export const measurementSchema = z.discriminatedUnion('kind',[
 z.object({...base,kind:z.literal('glucose'),value:z.number().min(1.1).max(600),unit:z.enum(['mg/dL','mmol/L']).optional()}).strict().refine(v=>(v.unit??'mg/dL')==='mg/dL'?Number.isInteger(v.value)&&v.value>=20:v.value<=33.3,'Valor incompatível com unidade'),
 z.object({...base,kind:z.literal('pressure'),systolic:z.number().int().min(50).max(260),diastolic:z.number().int().min(30).max(160),pulse:z.number().int().min(30).max(220).optional()}).strict().refine(v=>v.systolic>v.diastolic,'Sistólica deve superar diastólica')
]);
export type Measurement = z.infer<typeof measurementSchema> & {id:string};
export function syntheticRecords():Measurement[]{return Array.from({length:14},(_,i)=>{const measuredAt=new Date(Date.UTC(2026,9,13+i,11)).toISOString();return i%2===0?{id:`demo-${i}`,kind:'glucose',value:90+(i*7)%42,context:'jejum',measuredAt}:{id:`demo-${i}`,kind:'pressure',systolic:112+(i*3)%22,diastolic:72+i%12,context:'repouso',measuredAt};});}
export function csv(records:Measurement[]){return '\uFEFF'+['id,data,tipo,glicemia_mg_dL,sistolica_mmHg,diastolica_mmHg,contexto,unidade_glicemia,pulso_bpm,glicemia_valor',...records.map(r=>[r.id,r.measuredAt,r.kind,r.kind==='glucose'&&(r.unit??'mg/dL')==='mg/dL'?r.value:'',r.kind==='pressure'?r.systolic:'',r.kind==='pressure'?r.diastolic:'',r.context,r.kind==='glucose'?(r.unit??'mg/dL'):'',r.kind==='pressure'?(r.pulse??''):'',r.kind==='glucose'?r.value:''].map(v=>'"'+String(v).replace(/^[=+@\-]/,"'$&").replaceAll('"','""')+'"').join(','))].join('\r\n');}
