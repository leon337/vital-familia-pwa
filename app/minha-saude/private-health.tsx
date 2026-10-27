'use client';
import {useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import PhotoCapture from '../photo-capture';
import {authClient} from '@/lib/auth-client';
import {consentVersion,type Measurement} from '@/lib/domain';
import {confirmedPayload,privateRequest,recordsPath,PrivateAPIError} from '@/lib/private-api';
export default function PrivateHealth({access}:{access:'ready'|'login'|'blocked'}){
 const router=useRouter();
 const [session,setSession]=useState(false),[records,setRecords]=useState<Measurement[]>([]),[authorized,setAuthorized]=useState(false),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[accepted,setAccepted]=useState(false),[patient,setPatient]=useState(''),[caregiver,setCaregiver]=useState(false);
 const generation=useRef(0),lock=useRef(false);
 const pending=useRef<{body:ReturnType<typeof confirmedPayload>;key:string}|null>(null);
 function clear(){generation.current++;setRecords([]);setAuthorized(false);pending.current=null;}
 useEffect(()=>{
  let active=true;
  if(access==='ready')void authClient.getSession().then(result=>{if(active){setSession(Boolean(result.data?.user)&&!result.error);if(result.error||!result.data?.user)setMessage('Sessão indisponível. Entre novamente.');}}).catch(()=>{if(active)setMessage('Não foi possível verificar a sessão.');});
  const hide=(event:Event)=>{if(event.type==='pagehide'||document.visibilityState==='hidden'){generation.current++;setRecords([]);setAuthorized(false);pending.current=null;}};
  window.addEventListener('pagehide',hide);document.addEventListener('visibilitychange',hide);
  return()=>{active=false;generation.current++;window.removeEventListener('pagehide',hide);document.removeEventListener('visibilitychange',hide);};
 },[access]);
 async function action(work:()=>Promise<void>){if(lock.current)return;lock.current=true;setBusy(true);setMessage('');try{await work();}catch(error){clear();setMessage(error instanceof PrivateAPIError&&error.status===409?'Histórico excede o limite de exibição ou há conflito. Use o CSV completo para o histórico.':error instanceof PrivateAPIError&&error.status===403?'Acesso recusado. Verifique admissão, consentimento e autorização do cuidador.':'Operação não concluída. Verifique sua sessão e tente novamente.');}finally{lock.current=false;setBusy(false);}}
 async function load(){clear();const current=generation.current;const response=await privateRequest(recordsPath(caregiver?patient:''));const data=await response.json() as Measurement[];if(current===generation.current){setRecords(data);setAuthorized(true);setMessage(data.length?'Histórico autorizado carregado.':'Nenhum registro encontrado.');}}
 async function save(record:Measurement){if(lock.current)return;const body=confirmedPayload(record);pending.current={body,key:crypto.randomUUID()};await retry();}
 async function retry(){await action(async()=>{const item=pending.current;if(!item)return;const current=generation.current;try{await privateRequest('/api/records',item.body,item.key);}catch(error){if(error instanceof PrivateAPIError&&error.status<500)throw error;setMessage('Envio sem confirmação. Tente reenviar os mesmos números com a mesma chave.');return;}if(current!==generation.current)return;pending.current=null;await load();setMessage('Números confirmados registrados. Foto descartada.');});}
 async function login(){await action(async()=>{const result=await authClient.signIn.social({provider:'google',callbackURL:'/minha-saude',errorCallbackURL:'/minha-saude'});if(result.error)throw new Error();router.refresh();});}
 async function logout(){clear();setSession(false);await action(async()=>{const result=await authClient.signOut();if(result.error)throw new Error();router.refresh();setMessage('Sessão encerrada.');});}
 return <main className="private-health"><Link href="/">Voltar à demonstração pública</Link><h1>Minha saúde</h1><p>Área privada · Login Google não concede admissão nem substitui consentimento.</p>
 <p role="status" aria-live="polite" aria-atomic="true">{message}</p>
 {access==='blocked'?<section className="panel"><h2>Acesso privado bloqueado</h2><p>Serviço indisponível ou admissão não autorizada. Os gates Neon, OAuth e RLS precisam ser validados. Não insira dados reais.</p></section>:!session?<section className="panel"><h2>Entrar na área privada</h2><button disabled={busy} onClick={()=>void login()}>Continuar com Google</button>{access==='ready'&&<p>Verificando sessão; se necessário, entre novamente.</p>}</section>:<>
 <button disabled={busy} onClick={()=>void logout()}>Sair da conta Google</button>
 <section className="panel form-panel"><h2>Consentimento do paciente</h2><p>Versão {consentVersion}. Finalidade: organizar seu diário de glicemia e pressão e permitir consulta e exportação por cuidadores que você autorizar separadamente. A foto é processada localmente e não é enviada. O servidor recebe números, unidade, data e contexto somente após sua confirmação.</p><p>Revogar impede novos acessos e registros. Não apaga o histórico nem recolhe arquivos já exportados. Retenção e atendimento a direitos dependem dos gates de privacidade antes do uso real.</p>
 <label className="check"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)}/>Aceito explicitamente o tratamento descrito para meu diário.</label>
 <button disabled={busy||!accepted} onClick={()=>void action(async()=>{clear();await privateRequest('/api/consent',{accepted:true,version:consentVersion});setAccepted(false);setMessage('Consentimento registrado. Solicite o histórico para verificar acesso.');})}>Registrar consentimento</button>
 <button disabled={busy} onClick={()=>{clear();setAccepted(false);void action(async()=>{await privateRequest('/api/consent',{accepted:false,version:consentVersion});setMessage('Consentimento revogado. Novos acessos serão recusados.');});}}>Revogar meu consentimento</button></section>
 <section className="panel form-panel"><h2>Histórico autorizado</h2><label>Área de consulta<select disabled={busy} value={caregiver?'caregiver':'patient'} onChange={e=>{clear();setPatient('');setCaregiver(e.target.value==='caregiver');}}><option value="patient">Paciente — meu diário</option><option value="caregiver">Cuidador — somente leitura autorizada</option></select></label>
 {caregiver&&<label>Identificador do paciente autorizado<input value={patient} disabled={busy} onChange={e=>{clear();setPatient(e.target.value);}} autoComplete="off"/></label>}
 <button disabled={busy||(caregiver&&!patient.trim())} onClick={()=>void action(load)}>Consultar histórico</button>
 <button disabled={busy||(caregiver&&!patient.trim())} onClick={()=>void action(async()=>{clear();const current=generation.current;const response=await privateRequest(recordsPath(caregiver?patient:'',true));const blob=await response.blob();if(current!==generation.current)return;const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='vital-familia-privado.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage('CSV completo exportado. Guarde o arquivo com segurança.');})}>Exportar CSV completo</button>
 {authorized&&<div className="table-wrap"><table><caption>{caregiver?'Diário compartilhado — somente leitura':'Meu diário'}</caption><thead><tr><th>Data / hora</th><th>Valor</th><th>Contexto</th></tr></thead><tbody>{records.map(r=><tr key={r.id}><td>{new Date(r.measuredAt).toLocaleString('pt-BR')}</td><td>{r.kind==='glucose'?`${r.value} ${r.unit??'mg/dL'}`:`${r.systolic}/${r.diastolic} mmHg${r.pulse!=null?` · ${r.pulse} bpm`:''}`}</td><td>{r.context}</td></tr>)}</tbody></table></div>}</section>
 {!caregiver&&authorized&&!busy&&<PhotoCapture privateMode onSave={record=>void save(record)}/>}
 {pending.current&&!caregiver&&<button disabled={busy} onClick={()=>void retry()}>Reenviar números confirmados</button>}
 {!caregiver&&<section className="panel form-panel"><h2>Autorizar ou revogar cuidador</h2><form action={form=>{const id=String(form.get('caregiver')??'');const active=form.get('operation')==='grant';void action(async()=>{await privateRequest('/api/sharing',{caregiverId:id,active});setMessage(active?'Cuidador autorizado a consultar e exportar.':'Acesso do cuidador revogado.');});}}><label>Identificador do cuidador admitido<input name="caregiver" required autoComplete="off" pattern="[A-Za-z0-9][A-Za-z0-9_-]{0,199}"/></label><label>Permissão<select name="operation"><option value="revoke">Revogar acesso</option><option value="grant">Autorizar leitura e exportação</option></select></label><button disabled={busy}>Confirmar permissão</button></form><p>Conceder acesso é uma decisão separada do consentimento e do login.</p></section>}
 </> }</main>;
}
