import {auth} from '@/lib/auth';
import {enabled,sameOrigin,boundedJson,failure,HttpError} from '@/lib/backend';
async function handler(request:Request,context:{params:Promise<{path:string[]}>}){
 try{
  if(!enabled())throw new HttpError(503,'Auth bloqueado até validação governada');
  const {path}=await context.params;
  const endpoint=path.join('/');
  const allowed=request.method==='GET'?['get-session','callback/google']:['sign-in/social','sign-out'];
  if(!allowed.includes(endpoint))throw new HttpError(403,'Método de autenticação recusado');
  if(request.method==='POST'){
   sameOrigin(request);
   if(endpoint==='sign-in/social'){
    const body=await boundedJson(request.clone());
    if(body.provider!=='google'||Object.keys(body).some(k=>!['provider','callbackURL','errorCallbackURL'].includes(k)))throw new HttpError(400,'Provider inválido');
    for(const key of ['callbackURL','errorCallbackURL'])if(body[key] && new URL(body[key],process.env.APP_ORIGIN).origin!==process.env.APP_ORIGIN)throw new HttpError(403,'Callback recusado');
   }
  }
  const response=await auth().handler()[request.method==='POST'?'POST':'GET'](request,context);
  response.headers.set('Cache-Control','no-store');return response;
 }catch(e){return failure(e);}
}
export {handler as GET,handler as POST};
