import {actor,boundedJson,failure,sameOrigin,transaction,HttpError,idempotencyKey,writeOnce} from '@/lib/backend';
import {csv,confirmedMeasurementSchema,type Measurement} from '@/lib/domain';
export async function GET(req:Request){
 try{
  const user=await actor();const url=new URL(req.url);const patient=url.searchParams.get('patient')||user;
  const exporting=url.searchParams.get('format')==='csv';
  const records=await transaction(user,patient,async c=>{
   const access=await c.query('SELECT app.can_access($1,false) AS ok',[patient]);
   if(access.rows[0]?.ok!==true)throw new HttpError(403,'Acesso recusado');
   // One statement/snapshot for the entire CSV, with identical authorization and RLS.
   // Timeout/resource failure returns an error; no partial CSV is returned.
   const result=await c.query(`SELECT id,payload FROM app.measurements WHERE patient_id=$1 ORDER BY measured_at DESC,id DESC${exporting?'':' LIMIT 1001'}`,[patient]);
   if(!exporting&&result.rows.length>1000)throw new HttpError(409,'Mais de 1000 registros: solicite format=csv para exportação completa');
   return result.rows.map(r=>({...r.payload,id:r.id})) as Measurement[];
  });
  return exporting?new Response(csv(records),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="vital-sintetico.csv"','Cache-Control':'no-store'}}):Response.json(records,{headers:{'Cache-Control':'no-store'}});
 }catch(e){return failure(e);}
}
export async function POST(req:Request){
 try{
  sameOrigin(req);const user=await actor();const key=idempotencyKey(req);
  const data=confirmedMeasurementSchema.safeParse(await boundedJson(req));if(!data.success)throw new HttpError(400,'Medição inválida');
  const result=await transaction(user,user,async c=>{
   // Replays also require current consent: an old key never bypasses revocation.
   const access=await c.query('SELECT app.can_access($1,true) AS ok',[user]);
   if(access.rows[0]?.ok!==true)throw new HttpError(403,'Consentimento necessário');
   return writeOnce(c,'records',key,data.data,async()=>({id:(await c.query('INSERT INTO app.measurements(patient_id,actor_id,measured_at,payload) VALUES($1,$1,$2,$3) RETURNING id',[user,data.data.measuredAt,data.data])).rows[0].id}));
  });
  return Response.json(result,{status:201,headers:{'Cache-Control':'no-store'}});
 }catch(e){return failure(e);}
}
