import {z} from 'zod';
import {actor,boundedJson,failure,sameOrigin,transaction,HttpError} from '@/lib/backend';
import {consentVersion} from '@/lib/domain';
export async function POST(req:Request){try{sameOrigin(req);const user=await actor();const data=z.object({accepted:z.boolean(),version:z.literal(consentVersion)}).strict().safeParse(await boundedJson(req));if(!data.success)throw new HttpError(400,'Consentimento inválido');await transaction(user,user,c=>c.query('INSERT INTO app.consent_events(patient_id,accepted,version) VALUES($1,$2,$3)',[user,data.data.accepted,data.data.version]));return Response.json({ok:true});}catch(e){return failure(e);}}
