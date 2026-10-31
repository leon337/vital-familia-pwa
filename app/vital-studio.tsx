'use client';

import {useEffect, useMemo, useState, type FormEvent, type ReactNode} from 'react';
import {csv, measurementSchema, syntheticRecords, type Measurement} from '@/lib/domain';
import {VITAL_SCREENS, VITAL_DEMO_NOTICE, type VitalScreen} from '@/lib/vital-ui';

type Reminder = {id: string; label: string; time: string; enabled: boolean};
const initialReminders: Reminder[] = [
  {id:'morning',label:'Registrar glicemia (exemplo)',time:'08:00',enabled:true},
  {id:'evening',label:'Conferir meu diário (exemplo)',time:'19:00',enabled:false}
];
const contextLabels: Record<Measurement['context'],string> = {
  jejum:'Jejum', 'após refeição':'Após refeição', repouso:'Repouso', outro:'Outro'
};
const fmt = (iso:string) => new Date(iso).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
const formatValue = (item:Measurement) =>
  item.kind==='glucose' ? `${item.value} mg/dL` : `${item.systolic}/${item.diastolic} mmHg`;

function Card({title,children,extra}:{title:string;children:ReactNode;extra?:ReactNode}){
  return <section className="vf-card"><div className="vf-card-title"><h2>{title}</h2>{extra}</div>{children}</section>;
}
function Heading({eyebrow,title,children}:{eyebrow:string;title:string;children?:ReactNode}){
  return <div className="vf-heading"><span className="vf-eyebrow">{eyebrow}</span><h1>{title}</h1>{children&&<p>{children}</p>}</div>;
}

export default function VitalStudio(){
  const [screen,setScreen]=useState<VitalScreen>('home');
  const [records,setRecords]=useState<Measurement[]>(()=>syntheticRecords());
  const [dark,setDark]=useState(false);
  const [largeText,setLargeText]=useState(false);
  const [highContrast,setHighContrast]=useState(false);
  const [historyKind,setHistoryKind]=useState<'all'|'glucose'|'pressure'>('all');
  const [demoConsent,setDemoConsent]=useState(false);
  const [caregiverView,setCaregiverView]=useState(false);
  const [reminders,setReminders]=useState(initialReminders);
  const [message,setMessage]=useState('');
  useEffect(()=>{if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});},[]);
  const glucose=useMemo(()=>records.filter(r=>r.kind==='glucose').at(-1),[records]);
  const pressure=useMemo(()=>records.filter(r=>r.kind==='pressure').at(-1),[records]);
  const history=useMemo(()=>records.filter(r=>historyKind==='all'||r.kind===historyKind).toSorted((a,b)=>b.measuredAt.localeCompare(a.measuredAt)),[records,historyKind]);
  const activeDark=dark||screen==='dark';
  function navigate(target:VitalScreen){setScreen(target);setMessage('');}
  function addRecord(kind:'glucose'|'pressure',event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!demoConsent){setMessage('Confirme que está utilizando apenas valores fictícios.');return;}
    const form = new FormData(event.currentTarget);
    const raw = kind==='glucose'
      ? {kind,context:form.get('context'),measuredAt:new Date().toISOString(),value:Number(form.get('value'))}
      : {kind,context:form.get('context'),measuredAt:new Date().toISOString(),systolic:Number(form.get('systolic')),diastolic:Number(form.get('diastolic'))};
    const result=measurementSchema.safeParse(raw);
    if(!result.success){setMessage('Revise os campos e utilize valores fictícios válidos.');return;}
    setRecords(previous=>[...previous,{...result.data,id:crypto.randomUUID()}]);
    setMessage('Exemplo fictício adicionado somente à memória desta aba.');
    setScreen('history');
  }
  function downloadCsv(){
    const url=URL.createObjectURL(new Blob([csv(history)],{type:'text/csv;charset=utf-8'}));
    const link=document.createElement('a');
    link.href=url;link.download='vital-familia-dados-SINTETICOS.csv';link.click();
    URL.revokeObjectURL(url);
    setMessage('Exportação de exemplos sintéticos concluída.');
  }
  const mostRecent=records.slice(-4).reverse();
  const graph=records.filter(r=>r.kind==='glucose').slice(-7);
  function dashboard(){
    return <><Heading eyebrow="SEU ESPAÇO DE CUIDADO" title="Cuidar fica melhor em família.">Seu diário demonstrativo, simples e acessível, para organizar exemplos de glicemia e pressão.</Heading>
      <div className="vf-grid vf-two">
        <Card title="Glicemia"><div className="vf-metric"><span className="vf-metric-symbol">◉</span><strong>{glucose?.kind==='glucose'?glucose.value:'—'}</strong><small>mg/dL</small></div><p>Último registro fictício • sem classificação clínica</p><button className="vf-primary" onClick={()=>navigate('glucose')}>+ Registrar glicemia</button></Card>
        <Card title="Pressão arterial"><div className="vf-metric"><span className="vf-metric-symbol">♡</span><strong>{pressure?.kind==='pressure'?`${pressure.systolic}/${pressure.diastolic}`:'—'}</strong><small>mmHg</small></div><p>Último registro fictício • sem classificação clínica</p><button className="vf-primary" onClick={()=>navigate('pressure')}>+ Registrar pressão</button></Card>
      </div>
      <div className="vf-grid vf-two">
        <Card title="Últimos registros" extra={<button className="vf-link" onClick={()=>navigate('history')}>Ver todos →</button>}>
          <ul className="vf-records">{mostRecent.map(r=><li key={r.id}><span>{r.kind==='glucose'?'◉':'♡'} {r.kind==='glucose'?'Glicemia':'Pressão'}</span><strong>{formatValue(r)}</strong><small>{fmt(r.measuredAt)}</small></li>)}</ul>
        </Card>
        <Card title="Acesso rápido"><div className="vf-quick">
          <button onClick={()=>navigate('trends')}>↗ Gráficos</button>
          <button onClick={()=>navigate('reports')}>▧ Relatórios</button>
          <button onClick={()=>navigate('reminders')}>◷ Lembretes</button>
          <button onClick={()=>navigate('family')}>♧ Família</button>
        </div><p className="vf-muted">Ações locais de demonstração, sem compartilhamento ou notificações reais.</p></Card>
      </div></>;
  }
  function recordForm(kind:'glucose'|'pressure'){
    const isGlucose=kind==='glucose';
    return <><Heading eyebrow="REGISTRO DEMONSTRATIVO" title={isGlucose?'Registrar glicemia':'Registrar pressão arterial'}>Preencha apenas valores inventados. Nenhum dado é enviado ou guardado após recarregar a página.</Heading>
      <Card title={isGlucose?'Novo registro de glicemia':'Novo registro de pressão e pulso'}>
        <form className="vf-form" onSubmit={event=>addRecord(kind,event)}>
          {isGlucose?<label>Valor de glicemia (mg/dL)<input name="value" type="number" min="20" max="600" required defaultValue="104"/></label>:
          <div className="vf-grid vf-two"><label>Sistólica (mmHg)<input name="systolic" type="number" min="50" max="260" required defaultValue="120"/></label><label>Diastólica (mmHg)<input name="diastolic" type="number" min="30" max="160" required defaultValue="80"/></label></div>}
          <label>Contexto<select name="context" defaultValue={isGlucose?'jejum':'repouso'}><option value="jejum">Jejum</option><option value="após refeição">Após refeição</option><option value="repouso">Repouso</option><option value="outro">Outro</option></select></label>
          <label className="vf-check"><input type="checkbox" checked={demoConsent} onChange={e=>setDemoConsent(e.target.checked)}/><span>Confirmo que estou usando apenas números fictícios para testar o protótipo.</span></label>
          <div className="vf-actions"><button className="vf-primary" disabled={!demoConsent} type="submit">Salvar exemplo fictício</button><button type="button" onClick={()=>navigate('home')}>Cancelar</button></div>
        </form>
      </Card></>;
  }
  function historyView(){
    return <><Heading eyebrow="SEU DIÁRIO" title="Histórico de medições">Registros sintéticos organizados por data, sem avaliação ou classificação de saúde.</Heading>
      <Card title="Meus registros" extra={<button onClick={downloadCsv}>↓ Exportar CSV fictício</button>}>
        <label className="vf-filter">Filtrar tipo <select value={historyKind} onChange={e=>setHistoryKind(e.target.value as typeof historyKind)}><option value="all">Todos</option><option value="glucose">Glicemia</option><option value="pressure">Pressão</option></select></label>
        <ul className="vf-records">{history.length?history.map(r=><li key={r.id}><span>{r.kind==='glucose'?'◉ Glicemia':'♡ Pressão arterial'}</span><strong>{formatValue(r)}</strong><small>{fmt(r.measuredAt)} · {contextLabels[r.context]}</small></li>):<li>Nenhum exemplo disponível para este filtro.</li>}</ul>
      </Card></>;
  }
  function trendsView(){
    return <><Heading eyebrow="LEITURAS DE EXEMPLO" title="Gráficos e tendências">Visualização de valores fictícios. O gráfico não produz metas, alertas ou diagnósticos.</Heading>
      <Card title="Sequência de glicemia (mg/dL)"><div className="vf-chart" role="img" aria-label={`Últimos valores sintéticos de glicemia em mg/dL: ${graph.map(r=>r.kind==='glucose'?r.value:0).join(', ')}`}>
        {graph.map(r=><div className="vf-bar-item" key={r.id}><span>{r.kind==='glucose'?r.value:''}</span><div className="vf-bar-track"><div style={{height:`${r.kind==='glucose'?Math.max(8,r.value/200*100):8}%`}}/></div><small>{new Date(r.measuredAt).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})}</small></div>)}
      </div><p>Escala visual ilustrativa. Não usar para decisões médicas.</p></Card>
    </>;
  }
  function assistantView(){
    return <><Heading eyebrow="CONTEÚDO EDUCATIVO" title="Assistente Vital IA">Protótipo de interface, sem conexão com Gemini ou qualquer modelo de IA.</Heading>
      <Card title="Conversa demonstrativa"><div className="vf-chat"><div className="vf-bubble vf-user">Como organizo meu diário?</div><div className="vf-bubble">Você pode registrar exemplos fictícios de glicemia e pressão e consultá-los no histórico. Para dúvidas de saúde, procure um profissional habilitado.</div></div>
        <label>Pergunta ao assistente (indisponível neste demo)<input disabled placeholder="IA desligada nesta demonstração"/></label>
        <p className="vf-muted">Nenhum dado ou mensagem é enviado a serviços de IA. Não oferece diagnósticos nem recomendações de tratamento.</p></Card></>;
  }
  function reportsView(){
    return <><Heading eyebrow="ORGANIZE SEUS EXEMPLOS" title="Relatórios">Selecione um conjunto de demonstração. Esta versão exporta CSV fictício; não gera PDF nem envia por WhatsApp.</Heading>
      <Card title="Resumo para demonstração"><p><strong>{records.length}</strong> registros sintéticos nesta sessão.</p><p>Inclui tipo, valores, contexto e data. Nenhum paciente ou familiar real está associado a estes registros.</p><button className="vf-primary" onClick={downloadCsv}>↓ Baixar CSV de exemplos</button>
      <p className="vf-muted">Compartilhamento e geração de documentos clínicos: não implementados.</p></Card></>;
  }
  function familyView(){
    return <><Heading eyebrow="CONTROLE DE ACESSO" title="Familiares e cuidadores">Visualização demonstrativa de permissões. Não existem convites, autenticação ou compartilhamento reais.</Heading>
      <Card title="Círculo de cuidado fictício"><div className="vf-person"><span className="vf-avatar">F</span><div><strong>Familiar demonstrativo</strong><p>Somente leitura • sem acesso real</p></div></div><label className="vf-check"><input type="checkbox" checked={caregiverView} onChange={e=>setCaregiverView(e.target.checked)}/><span>{caregiverView?'Permissão simulada: ativa':'Habilitar permissão apenas nesta tela'}</span></label><p className="vf-muted">Esta opção não cria conta, não envia convite e não compartilha dados com ninguém.</p></Card></>;
  }
  function remindersView(){
    return <><Heading eyebrow="ROTINA FICTÍCIA" title="Lembretes">Experimente uma lista de horários. Não haverá notificações, alarmes ou avisos de medicamentos reais.</Heading>
      <Card title="Minha rotina demonstrativa"><ul className="vf-reminders">{reminders.map(r=><li key={r.id}><span className="vf-clock">{r.time}</span><span>{r.label}</span><label className="vf-check"><input aria-label={`Ativar ${r.label}`} type="checkbox" checked={r.enabled} onChange={e=>setReminders(list=>list.map(x=>x.id===r.id?{...x,enabled:e.target.checked}:x))}/></label></li>)}</ul><p className="vf-muted">Preferências temporárias; não há integração com notificações do dispositivo.</p></Card></>;
  }
  function profileView(){
    return <><Heading eyebrow="PERSONALIZAÇÃO" title="Perfil e acessibilidade">Ajuste a leitura e o contraste deste protótipo sem salvar dados pessoais.</Heading>
      <Card title="Preferências visuais"><div className="vf-settings"><label className="vf-check"><input type="checkbox" checked={largeText} onChange={e=>setLargeText(e.target.checked)}/>Aumentar tamanho das letras</label><label className="vf-check"><input type="checkbox" checked={highContrast} onChange={e=>setHighContrast(e.target.checked)}/>Alto contraste</label><label className="vf-check"><input type="checkbox" checked={dark} onChange={e=>setDark(e.target.checked)}/>Usar modo escuro</label></div><p className="vf-muted">Perfil fictício · Nenhuma identidade real cadastrada.</p></Card></>;
  }
  function welcomeView(){
    return <div className="vf-welcome"><span className="vf-welcome-icon">♡</span><span className="vf-eyebrow">VITAL FAMÍLIA</span><h1>Cuidado que aproxima.</h1><p>Uma experiência simples para acompanhar e organizar exemplos de saúde com carinho e clareza.</p><button className="vf-primary" onClick={()=>navigate('home')}>Explorar demonstração</button><button disabled title="Autenticação Google real indisponível">Entrar com Google — ainda indisponível</button><small>Somente protótipo com dados sintéticos.</small></div>;
  }
  const title=VITAL_SCREENS.find(s=>s.id===screen)?.label||'Início';
  function currentView(){
    switch(screen){
      case 'welcome':return welcomeView();
      case 'home':case 'dark':return dashboard();
      case 'glucose':case 'pressure':return recordForm(screen);
      case 'history':return historyView();
      case 'trends':return trendsView();
      case 'assistant':return assistantView();
      case 'reports':return reportsView();
      case 'family':return familyView();
      case 'reminders':return remindersView();
      case 'profile':return profileView();
    }
  }
  return <div className={['vf',activeDark?'vf-dark':'',largeText?'vf-large':'',highContrast?'vf-contrast':''].filter(Boolean).join(' ')}>
    <div className="vf-demo" role="note">{VITAL_DEMO_NOTICE} <a href="/demo">Abrir interface anterior</a></div>
    <div className="vf-layout">
      <aside className="vf-sidebar" aria-label="Navegação das doze telas">
        <button className="vf-brand" onClick={()=>navigate('home')}><span>♡</span><strong>vital<em>família</em></strong></button>
        <p className="vf-nav-label">TELAS DO PROTÓTIPO</p>
        <nav aria-label="Telas disponíveis">{VITAL_SCREENS.map(item=><button key={item.id} className={screen===item.id?'vf-active':''} aria-current={screen===item.id?'page':undefined} onClick={()=>navigate(item.id)}><span aria-hidden="true">{item.icon}</span>{item.label}</button>)}</nav>
        <div className="vf-side-note"><strong>Um cuidado de cada vez.</strong><p>Interface de exemplo, sem acesso a dados de pacientes.</p></div>
      </aside>
      <div className="vf-main-wrap"><header className="vf-topbar"><div><span className="vf-eyebrow">VITAL FAMÍLIA</span><strong>{title}</strong></div><div className="vf-top-actions"><select className="vf-screen-picker" aria-label="Selecionar uma das 12 telas" value={screen} onChange={e=>navigate(e.target.value as VitalScreen)}>{VITAL_SCREENS.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select><button onClick={()=>navigate('profile')} aria-label="Abrir acessibilidade">⚙ Acessibilidade</button><span className="vf-avatar" aria-label="Perfil fictício">D</span></div></header>
        <main className="vf-content" id="conteudo-principal">{currentView()}{message&&<p className="vf-status" role="status">{message}</p>}</main>
        <footer className="vf-footer"><span>Vital Família · Demonstração sintética</span><span>Sem uso clínico · Sem integração externa</span></footer>
      </div>
    </div>
    <nav className="vf-bottom" aria-label="Navegação principal móvel">{(['home','history','assistant','profile'] as const).map(id=>{const item=VITAL_SCREENS.find(x=>x.id===id)!;return <button key={id} onClick={()=>navigate(id)} aria-current={screen===id?'page':undefined} className={screen===id?'vf-active':''}><span aria-hidden="true">{item.icon}</span>{id==='home'?'Início':id==='history'?'Registros':id==='assistant'?'Assistente':'Mais'}</button>})}</nav>
  </div>;
}
