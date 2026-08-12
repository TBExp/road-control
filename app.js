const cfg=window.APP_CONFIG||{};
const sb=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
const app=document.querySelector('#app'),modal=document.querySelector('#modal'),toastEl=document.querySelector('#toast');
const state={mode:'team',admin:null,teamSession:sessionStorage.getItem('team_session')||null,team:null,event:null,challenges:[],purchases:[],teams:[],transactions:[],events:[],adminChannel:null,teamTimer:null};
const money=n=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(Number(n||0));
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
function showToast(msg,ok=true){toastEl.textContent=msg;toastEl.className=`toast ${ok?'':'error'}`;setTimeout(()=>toastEl.classList.add('hidden'),3200)}
function showModal(html){modal.innerHTML=`<div class="card modal-box">${html}</div>`;modal.classList.remove('hidden')}
function closeModal(){modal.classList.add('hidden');modal.innerHTML=''} window.closeModal=closeModal;
function brand(){return `<div class="brand"><div class="brand-mark">◈</div><div><h1>${esc(cfg.APP_NAME||'ROAD CONTROL')}</h1><small>OGNI SCELTA HA UN PREZZO</small></div></div>`}
async function start(){
 if(!cfg.SUPABASE_URL||cfg.SUPABASE_URL.includes('INCOLLA')){app.innerHTML=`<div class="auth-wrap"><div class="card auth-card">${brand()}<h2>Configurazione necessaria</h2><p class="muted">Apri <b>config.js</b> e inserisci Project URL e anon key di Supabase.</p></div></div>`;return}
 const {data:{session}}=await sb.auth.getSession();state.admin=session?.user||null;if(state.admin)return loadAdmin();if(state.teamSession){const ok=await loadTeam();if(ok)return}renderLogin()
}
function renderLogin(){clearInterval(state.teamTimer);app.innerHTML=`<div class="auth-wrap"><div class="card auth-card">${brand()}<div class="eyebrow" style="margin-top:28px">Accesso alla missione</div><h2>Entra nella Road</h2><p class="muted">Accedi come squadra oppure apri la Control Room.</p><div class="tabs"><button class="tab ${state.mode==='team'?'active':''}" onclick="switchMode('team')">TEAM</button><button class="tab ${state.mode==='admin'?'active':''}" onclick="switchMode('admin')">ADMIN</button></div><form id="loginForm">${state.mode==='team'?`<label>Codice evento</label><input name="eventCode" required><label>Nome team</label><input name="teamName" required><label>PIN</label><input name="pin" type="password" inputmode="numeric" required>`:`<label>Email amministratore</label><input name="email" type="email" required><label>Password</label><input name="password" type="password" required>`}<button class="btn primary" style="width:100%;margin-top:20px">ENTRA</button><div id="loginMsg" class="muted" style="margin-top:12px"></div></form></div></div>`;document.querySelector('#loginForm').addEventListener('submit',state.mode==='team'?teamLogin:adminLogin)}
window.switchMode=m=>{state.mode=m;renderLogin()};
async function teamLogin(e){e.preventDefault();const f=new FormData(e.target),msg=document.querySelector('#loginMsg');msg.textContent='Accesso in corso…';const {data,error}=await sb.rpc('team_login',{p_event_code:f.get('eventCode').trim().toUpperCase(),p_team_name:f.get('teamName').trim(),p_pin:f.get('pin')});if(error||!data?.ok){msg.innerHTML=`<span class="error">${esc(data?.message||error?.message||'Accesso non riuscito')}</span>`;return}state.teamSession=data.session_token;sessionStorage.setItem('team_session',state.teamSession);await loadTeam()}
async function adminLogin(e){e.preventDefault();const f=new FormData(e.target),msg=document.querySelector('#loginMsg');msg.textContent='Accesso in corso…';const {data,error}=await sb.auth.signInWithPassword({email:f.get('email'),password:f.get('password')});if(error){msg.innerHTML=`<span class="error">${esc(error.message)}</span>`;return}state.admin=data.user;await loadAdmin()}
async function loadTeam(){const {data,error}=await sb.rpc('team_state',{p_session_token:state.teamSession});if(error||!data?.ok){sessionStorage.removeItem('team_session');state.teamSession=null;return false}state.team=data.team;state.event=data.event;state.challenges=data.challenges||[];state.purchases=data.purchases||[];renderTeam();clearInterval(state.teamTimer);state.teamTimer=setInterval(refreshTeam,4000);return true}
async function refreshTeam(){const {data}=await sb.rpc('team_state',{p_session_token:state.teamSession});if(data?.ok){const old=state.team?.budget;state.team=data.team;state.event=data.event;state.challenges=data.challenges||[];state.purchases=data.purchases||[];renderTeam();if(old!==undefined&&Number(old)!==Number(state.team.budget))showToast(`Budget aggiornato: ${money(state.team.budget)}`)}}
function renderTeam(){const pct=Math.max(0,Math.min(100,Number(state.team.budget)/Math.max(1,Number(state.team.initial_budget))*100)),bought=new Set(state.purchases.map(x=>`${x.challenge_id}:${x.purchase_type}`));app.innerHTML=`<div class="shell"><div class="topbar">${brand()}<button class="btn small" onclick="teamLogout()">Esci</button></div><div class="budget-hero"><div class="eyebrow">${esc(state.event.name)} · ${esc(state.team.name)}</div><div class="budget-number">${money(state.team.budget)}</div><div class="progress"><div style="width:${pct}%"></div></div><p class="muted">Capitale residuo. Valutate attentamente ogni scelta.</p></div>${state.event.announcement?`<div class="notice"><b>COMUNICAZIONE:</b> ${esc(state.event.announcement)}</div>`:''}<div class="section-head"><div><div class="eyebrow">Percorso attivo</div><h2>Missioni</h2></div><span class="pill"><span class="dot"></span> LIVE</span></div><div class="grid missions">${state.challenges.map((c,i)=>`<div class="card mission"><div class="index">MISSIONE ${String(i+1).padStart(2,'0')}</div><h3>${esc(c.title)}</h3><p class="muted">${esc(c.description||'Scegliete se investire parte del budget per proseguire.')}</p><div class="action-row"><button class="action ${bought.has(`${c.id}:hint`)?'unlocked':''}" onclick="requestPurchase('${c.id}','hint')"><strong>${bought.has(`${c.id}:hint`)?'Rivedi indizio':'Acquista indizio'}</strong><small>${bought.has(`${c.id}:hint`)?'SBLOCCATO':money(c.hint_cost)}</small></button><button class="action ${bought.has(`${c.id}:solution`)?'unlocked':''}" onclick="requestPurchase('${c.id}','solution')"><strong>${bought.has(`${c.id}:solution`)?'Rivedi soluzione':'Sblocca soluzione'}</strong><small>${bought.has(`${c.id}:solution`)?'SBLOCCATA':money(c.solution_cost)}</small></button></div></div>`).join('')||'<div class="card"><p class="muted">Nessuna missione ancora disponibile.</p></div>'}</div></div>`}
window.requestPurchase=(id,type)=>{const c=state.challenges.find(x=>x.id===id);if(!c)return;const ex=state.purchases.find(x=>x.challenge_id===id&&x.purchase_type===type);if(ex)return showModal(`<div class="eyebrow">${type==='hint'?'INDIZIO':'SOLUZIONE'}</div><h2>${esc(c.title)}</h2><div class="notice">${esc(ex.content_snapshot)}</div><div class="modal-actions"><button class="btn primary" onclick="closeModal()">Chiudi</button></div>`);const cost=type==='hint'?c.hint_cost:c.solution_cost;showModal(`<div class="eyebrow">CONFERMA INVESTIMENTO</div><h2>${type==='hint'?'Acquistare l’indizio?':'Sbloccare la soluzione?'}</h2><p>Missione: <b>${esc(c.title)}</b></p><p>Verranno sottratti <b>${money(cost)}</b> dal budget.</p><div class="modal-actions"><button class="btn" onclick="closeModal()">Annulla</button><button class="btn primary" onclick="confirmPurchase('${id}','${type}')">Conferma</button></div>`)};
window.confirmPurchase=async(id,type)=>{const {data,error}=await sb.rpc('team_purchase',{p_session_token:state.teamSession,p_challenge_id:id,p_purchase_type:type});if(error||!data?.ok){showToast(data?.message||error?.message||'Operazione non riuscita',false);return}closeModal();showModal(`<div class="eyebrow">${type==='hint'?'INDIZIO ACQUISTATO':'SOLUZIONE SBLOCCATA'}</div><h2>${esc(data.challenge_title)}</h2><div class="notice">${esc(data.content)}</div><p class="muted">Nuovo budget: ${money(data.new_budget)}</p><div class="modal-actions"><button class="btn primary" onclick="closeModal()">Continua</button></div>`);await refreshTeam()};
window.teamLogout=()=>{sessionStorage.removeItem('team_session');state.teamSession=null;state.team=null;renderLogin()};
async function loadAdmin(){const {data:p}=await sb.from('profiles').select('*').eq('id',state.admin.id).single();if(!p||p.role!=='admin'){await sb.auth.signOut();state.admin=null;alert('Questo utente non è abilitato come admin.');return renderLogin()}await refreshAdmin();subscribeAdmin()}
async function refreshAdmin(){const [ev,te,tr,ch]=await Promise.all([sb.from('events').select('*').order('created_at',{ascending:false}),sb.from('teams').select('*,events(name,code)').order('created_at',{ascending:false}),sb.from('transactions').select('*,teams(name),challenges(title)').order('created_at',{ascending:false}).limit(80),sb.from('challenges').select('*,events(name)').order('sort_order')]);state.events=ev.data||[];state.teams=te.data||[];state.transactions=tr.data||[];state.challenges=ch.data||[];renderAdmin()}
function subscribeAdmin(){if(state.adminChannel)sb.removeChannel(state.adminChannel);state.adminChannel=sb.channel('admin-live').on('postgres_changes',{event:'*',schema:'public',table:'teams'},refreshAdmin).on('postgres_changes',{event:'*',schema:'public',table:'transactions'},refreshAdmin).on('postgres_changes',{event:'*',schema:'public',table:'events'},refreshAdmin).subscribe()}
function renderAdmin(){const total=state.teams.reduce((s,t)=>s+Number(t.budget||0),0);app.innerHTML=`<div class="shell"><div class="topbar">${brand()}<div><span class="pill"><span class="dot"></span> CONTROL ROOM</span> <button class="btn small" onclick="adminLogout()">Esci</button></div></div><div class="grid cols-3"><div class="card kpi"><span>Team registrati</span><strong>${state.teams.length}</strong></div><div class="card kpi"><span>Capitale complessivo</span><strong>${money(total)}</strong></div><div class="card kpi"><span>Operazioni registrate</span><strong>${state.transactions.length}</strong></div></div><div class="section-head"><div><div class="eyebrow">Configurazione</div><h2>Eventi</h2></div><button class="btn primary" onclick="eventModal()">+ Nuovo evento</button></div><div class="grid cols-2">${state.events.map(e=>`<div class="card"><div class="eyebrow">${esc(e.code)}</div><h3>${esc(e.name)}</h3><p class="muted">${esc(e.announcement||'Nessuna comunicazione live')}</p><button class="btn small" onclick="announcementModal('${e.id}')">Messaggio live</button>
<button class="btn small" onclick="challengeModal('${e.id}')">+ Missione</button>
<button class="btn small" onclick="teamModal('${e.id}')">+ Team</button>
<button class="btn small" onclick="duplicateEventModal('${e.id}')">Duplica</button>
<button class="btn small" onclick="deleteEventModal('${e.id}')">Elimina</button></div>`).join('')||'<div class="card muted">Crea il primo evento.</div>'}</div><div class="section-head"><div><div class="eyebrow">Monitoraggio live</div><h2>Team e budget</h2></div></div><div class="table-wrap"><table><thead><tr><th>Team</th><th>Evento</th><th>Budget</th><th>Ultimo accesso</th><th>Azioni</th></tr></thead><tbody>${state.teams.map(t=>`<tr><td><b>${esc(t.name)}</b></td><td>${esc(t.events?.name||'')}</td><td>${money(t.budget)}</td><td>${t.last_login_at?new Date(t.last_login_at).toLocaleString('it-IT'):'—'}</td><td><button class="btn small" onclick="budgetModal('${t.id}')">Modifica</button></td></tr>`).join('')}</tbody></table></div><div class="section-head"><div><div class="eyebrow">Tracciamento</div><h2>Ultimi movimenti</h2></div></div><div class="table-wrap"><table><thead><tr><th>Ora</th><th>Team</th><th>Operazione</th><th>Importo</th><th>Budget dopo</th></tr></thead><tbody>${state.transactions.map(x=>`<tr><td>${new Date(x.created_at).toLocaleString('it-IT')}</td><td>${esc(x.teams?.name||'')}</td><td>${esc(x.description)}</td><td>${money(x.amount)}</td><td>${money(x.balance_after)}</td></tr>`).join('')}</tbody></table></div></div>`}
window.eventModal=()=>showModal(`<div class="eyebrow">NUOVO EVENTO</div><h2>Crea una Road</h2><form id="eventForm" onsubmit="return false;"><label>Nome evento</label><input name="name" required><label>Codice evento</label><input name="code" maxlength="12" required placeholder="ES. FERRARI26"><div class="modal-actions"><button type="button" class="btn" onclick="closeModal()">Annulla</button><button type="button" class="btn primary" onclick="window.createEvent(document.getElementById('eventForm'))">Crea</button></div></form>`);
window.createEvent=async form=>{const f=new FormData(form),{data,error}=await sb.rpc('admin_create_event',{p_name:f.get('name'),p_code:f.get('code').trim().toUpperCase()});if(error||!data?.ok)return showToast(data?.message||error?.message||'Impossibile creare l’evento',false);closeModal();showToast('Evento creato');await refreshAdmin()};
window.deleteEventModal=eventId=>{
  const ev=state.events.find(x=>x.id===eventId);
  if(!ev)return;

  showModal(`
    <div class="eyebrow">ELIMINA EVENTO</div>
    <h2>Eliminare ${esc(ev.name)}?</h2>
    <p class="muted">
      Verranno eliminati definitivamente l'evento e tutti i dati collegati:
      team, missioni, sessioni, acquisti e movimenti.
    </p>

    <label>Digita il codice <b>${esc(ev.code)}</b> per confermare</label>
    <input id="deleteEventCode" autocomplete="off">

    <div class="modal-actions">
      <button type="button" class="btn" onclick="closeModal()">Annulla</button>
      <button type="button" class="btn primary" onclick="deleteEvent('${eventId}')">
        Elimina definitivamente
      </button>
    </div>
  `);
};

window.deleteEvent=async eventId=>{
  const ev=state.events.find(x=>x.id===eventId);
  if(!ev)return;

  const typed=document.getElementById('deleteEventCode')?.value.trim().toUpperCase();

  if(typed!==String(ev.code).trim().toUpperCase()){
    return showToast('Codice evento non corretto',false);
  }

  const {data,error}=await sb.rpc('admin_delete_event',{
    p_event_id:eventId
  });

  if(error||!data?.ok){
    return showToast(
      data?.message||error?.message||'Impossibile eliminare l’evento',
      false
    );
  }

  closeModal();
  showToast('Evento eliminato');
  await refreshAdmin();
};
window.teamModal=eventId=>showModal(`<div class="eyebrow">NUOVO TEAM</div><h2>Registra una squadra</h2><form onsubmit="createTeam(event,'${eventId}')"><label>Nome team</label><input name="name" required><label>PIN numerico</label><input name="pin" inputmode="numeric" required><label>Budget iniziale</label><input name="budget" type="number" min="0" required value="1000"><div class="modal-actions"><button type="button" class="btn" onclick="closeModal()">Annulla</button><button class="btn primary">Crea</button></div></form>`);
window.createTeam=async(e,eventId)=>{e.preventDefault();const f=new FormData(e.target),{data,error}=await sb.rpc('admin_create_team',{p_event_id:eventId,p_name:f.get('name'),p_pin:f.get('pin'),p_budget:Number(f.get('budget'))});if(error||!data?.ok)return showToast(data?.message||error?.message,false);closeModal();showToast('Team creato');await refreshAdmin()};
window.challengeModal=eventId=>showModal(`<div class="eyebrow">NUOVA MISSIONE</div><h2>Configura la prova</h2><form onsubmit="createChallenge(event,'${eventId}')"><label>Titolo</label><input name="title" required><label>Descrizione breve</label><textarea name="description"></textarea><div class="grid cols-2"><div><label>Testo indizio</label><textarea name="hint" required></textarea><label>Costo indizio</label><input name="hintCost" type="number" min="0" required></div><div><label>Testo soluzione</label><textarea name="solution" required></textarea><label>Costo soluzione</label><input name="solutionCost" type="number" min="0" required></div></div><div class="modal-actions"><button type="button" class="btn" onclick="closeModal()">Annulla</button><button class="btn primary">Salva</button></div></form>`);
window.createChallenge=async(e,eventId)=>{e.preventDefault();const f=new FormData(e.target),{error}=await sb.from('challenges').insert({event_id:eventId,title:f.get('title'),description:f.get('description'),hint_text:f.get('hint'),hint_cost:Number(f.get('hintCost')),solution_text:f.get('solution'),solution_cost:Number(f.get('solutionCost')),sort_order:state.challenges.filter(x=>x.event_id===eventId).length+1});if(error)return showToast(error.message,false);closeModal();showToast('Missione creata');await refreshAdmin()};
window.budgetModal=teamId=>{const t=state.teams.find(x=>x.id===teamId);showModal(`<div class="eyebrow">BUDGET LIVE</div><h2>${esc(t.name)}</h2><p>Budget attuale: <b>${money(t.budget)}</b></p><form onsubmit="adjustBudget(event,'${teamId}')"><label>Variazione</label><input name="amount" type="number" required placeholder="+100 oppure -50"><label>Motivazione</label><input name="reason" required value="Modifica admin"><div class="modal-actions"><button type="button" class="btn" onclick="closeModal()">Annulla</button><button class="btn primary">Applica</button></div></form>`)};
window.adjustBudget=async(e,teamId)=>{e.preventDefault();const f=new FormData(e.target),{data,error}=await sb.rpc('admin_adjust_budget',{p_team_id:teamId,p_amount:Number(f.get('amount')),p_reason:f.get('reason')});if(error||!data?.ok)return showToast(data?.message||error?.message,false);closeModal();showToast('Budget aggiornato');await refreshAdmin()};
window.announcementModal=eventId=>{const ev=state.events.find(x=>x.id===eventId);showModal(`<div class="eyebrow">MESSAGGIO LIVE</div><h2>${esc(ev.name)}</h2><form onsubmit="saveAnnouncement(event,'${eventId}')"><label>Comunicazione</label><textarea name="announcement" placeholder="Lascia vuoto per rimuovere">${esc(ev.announcement||'')}</textarea><div class="modal-actions"><button type="button" class="btn" onclick="closeModal()">Annulla</button><button class="btn primary">Pubblica</button></div></form>`)};
window.saveAnnouncement=async(e,eventId)=>{e.preventDefault();const f=new FormData(e.target),{error}=await sb.from('events').update({announcement:f.get('announcement')}).eq('id',eventId);if(error)return showToast(error.message,false);closeModal();showToast('Comunicazione pubblicata');await refreshAdmin()};
window.adminLogout=async()=>{await sb.auth.signOut();state.admin=null;renderLogin()};
start();
