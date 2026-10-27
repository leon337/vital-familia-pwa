import {confirmedMeasurementSchema,type Measurement} from './domain';
export class PrivateAPIError extends Error{constructor(public status:number){super('Operação privada recusada');}}
export async function privateRequest(path:string,body?:unknown,key?:string){
 const response=await fetch(path,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',headers:body===undefined?undefined:{'Content-Type':'application/json','Idempotency-Key':key??crypto.randomUUID()},body:body===undefined?undefined:JSON.stringify(body)});
 if(!response.ok)throw new PrivateAPIError(response.status);
 return response;
}
export function recordsPath(patient:string,csv=false){const query=new URLSearchParams();if(patient)query.set('patient',patient);if(csv)query.set('format','csv');return '/api/records'+(query.size?'?'+query:'');}
export function confirmedPayload(record:Measurement){const {id,...values}=record;void id;return confirmedMeasurementSchema.parse({...values,confirmed:true});}
