import {auth} from '@/lib/auth';
import {enabled} from '@/lib/backend';
async function handler(request:Request,context:{params:Promise<{path:string[]}>}){if(!enabled())return Response.json({error:'Auth desabilitado no demo'},{status:503});return auth().handler()[request.method==='POST'?'POST':'GET'](request,context);}
export {handler as GET,handler as POST};
