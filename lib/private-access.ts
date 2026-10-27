import 'server-only';
import {actor,enabled} from './backend';
export async function privateAccess():Promise<'ready'|'login'|'blocked'>{
 if(!enabled())return 'blocked';
 try{await actor();return 'ready';}catch(error){return error instanceof Error&&'status' in error&&error.status===401?'login':'blocked';}
}
