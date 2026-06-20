const { useState, useEffect, useRef } = React;

const DAYS_SHORT = ["Lun","Mar","Mer","Gio","Ven","Sab","Dom"];
const DAYS_LETTER = ["L","M","M","G","V","S","D"];

const SCHEDULE = {
  0:{label:"Lunedì",   type:"custom",icon:"💪",exercises:[],skills:[],note:""},
  1:{label:"Martedì",  type:"custom",icon:"💪",exercises:[],skills:[],note:""},
  2:{label:"Mercoledì",type:"custom",icon:"💪",exercises:[],skills:[],note:""},
  3:{label:"Giovedì",  type:"custom",icon:"💪",exercises:[],skills:[],note:""},
  4:{label:"Venerdì",  type:"custom",icon:"💪",exercises:[],skills:[],note:""},
  5:{label:"Sabato",   type:"custom",icon:"💪",exercises:[],skills:[],note:""},
  6:{label:"Domenica", type:"custom",icon:"💪",exercises:[],skills:[],note:""},
};

const MEALS = ["Colazione","Spuntino","Pranzo","Merenda","Cena"];
const MEAL_ICONS = ["☀️","🍎","🍽️","🥤","🌙"];

const MEAL_PLAN = {
  "Colazione":{target:"",examples:[],warning:null},
  "Spuntino": {target:"",examples:[],warning:null},
  "Pranzo":   {target:"",examples:[],warning:null},
  "Merenda":  {target:"",examples:[],warning:null},
  "Cena":     {target:"",examples:[],warning:null},
};

const QUOTES = [
  {text:"I campioni si costruiscono nei giorni in cui nessuno guarda.",author:"Kobe Bryant"},
  {text:"Il dolore che senti oggi e la forza che sentirai domani.",author:"Anonimo"},
  {text:"Non e la pratica che rende perfetti. E la pratica perfetta.",author:"Vince Lombardi"},
  {text:"Ogni mattina hai due scelte: dormire o inseguire i tuoi sogni.",author:"Michael Jordan"},
  {text:"La grandezza non e un dono. E sudore.",author:"LeBron James"},
  {text:"La disciplina e il ponte tra gli obiettivi e i risultati.",author:"Jim Rohn"},
  {text:"Un campione si rialza anche quando non puo.",author:"Jack Dempsey"},
  {text:"Non fermarti quando sei stanco. Fermati quando hai finito.",author:"David Goggins"},
  {text:"Il successo e la somma di piccoli sforzi ripetuti ogni giorno.",author:"Robert Collier"},
  {text:"Allenati come se non avessi mai vinto. Gioca come se non avessi mai perso.",author:"Anonimo"},
];

function load(k,fb){try{const v=localStorage.getItem("enea_"+k);return v?JSON.parse(v):fb;}catch{return fb;}}

// Generatore ID univoco. Date.now() da solo può collidere su batch sincroni.
function genId(){return String(Date.now())+"_"+Math.random().toString(36).slice(2,10);}
window.__genId=genId;

// Coda di scritture Firestore con debounce: coalesce le scritture ravvicinate
// (es. toggle rapido di 5 esercizi → 1 scrittura invece di 5).
const __writeQueue=new Map();
let __flushTimer=null;
function __flushWrites(){
  if(window.__deletingAccount)return __writeQueue.clear();
  const cu=localStorage.getItem("enea_current_user");
  if(!cu||!window.__firestore||!window.__fbHelpers){__writeQueue.clear();return;}
  const {doc,setDoc}=window.__fbHelpers;
  for(const [k,v] of __writeQueue){
    let safe;
    try{safe=JSON.parse(JSON.stringify(v));}catch{continue;} // salta valori non serializzabili
    if(safe===undefined)continue;
    try{
      const ref=doc(window.__firestore,"users",cu,"data",k);
      setDoc(ref,{value:safe,updatedAt:Date.now()}).catch(()=>{});
    }catch{}
  }
  __writeQueue.clear();
}
window.__flushWrites=__flushWrites;
// Flush all'unload per non perdere l'ultima scrittura pendente
window.addEventListener("beforeunload",__flushWrites);
window.addEventListener("pagehide",__flushWrites);
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")__flushWrites();});

function save(k,v){
  try{localStorage.setItem("enea_"+k,JSON.stringify(v));}catch{}
  if(window.__deletingAccount)return;
  __writeQueue.set(k,v);
  if(__flushTimer)clearTimeout(__flushTimer);
  __flushTimer=setTimeout(__flushWrites,800);
}

// Helpers Firebase: login, migrazione iniziale, cancellazione account
async function fbAwaitReady(timeoutMs=5000){
  if(window.__fbReady)return;
  await new Promise((res,rej)=>{
    if(window.__fbReady)return res();
    const t=setTimeout(()=>rej(new Error("Firebase init timeout")),timeoutMs);
    window.addEventListener("fb-ready",()=>{clearTimeout(t);res();},{once:true});
  });
}
async function fbUserExists(username){
  await fbAwaitReady();
  if(!window.__firestore)return false;
  const {doc,getDoc}=window.__fbHelpers;
  const ref=doc(window.__firestore,"users",username);
  const snap=await getDoc(ref);
  return snap.exists();
}
async function fbCreateUser(username){
  await fbAwaitReady();
  if(!window.__firestore)throw new Error("Firebase non disponibile");
  const {doc,setDoc}=window.__fbHelpers;
  const ref=doc(window.__firestore,"users",username);
  // merge:true per preservare createdAt su account esistenti
  await setDoc(ref,{username,createdAt:Date.now()},{merge:true});
}
async function fbLoadAllUserData(username){
  await fbAwaitReady();
  if(!window.__firestore)return {};
  const {collection,getDocs}=window.__fbHelpers;
  const col=collection(window.__firestore,"users",username,"data");
  const snap=await getDocs(col);
  const out={};
  snap.forEach(d=>{out[d.id]=d.data().value;});
  return out;
}
// Cancellazione account: idempotente, raccoglie errori parziali senza fallire
async function fbDeleteUser(username){
  await fbAwaitReady();
  if(!window.__firestore)throw new Error("Firebase non disponibile");
  const {doc,deleteDoc,collection,getDocs}=window.__fbHelpers;
  const errors=[];
  try{
    const col=collection(window.__firestore,"users",username,"data");
    const snap=await getDocs(col);
    const results=await Promise.allSettled(snap.docs.map(d=>deleteDoc(d.ref)));
    results.forEach(r=>{if(r.status==="rejected")errors.push(r.reason);});
  }catch(e){errors.push(e);}
  try{
    const ref=doc(window.__firestore,"users",username);
    await deleteDoc(ref);
  }catch(e){errors.push(e);}
  if(errors.length){
    console.warn("[fbDeleteUser] errori parziali:",errors);
  }
}

// Idrata localStorage con i dati dell'utente da Firebase (chiamato al login)
async function fbHydrateLocalStorage(username){
  const allData=await fbLoadAllUserData(username);
  // Preserva le chiavi di sessione/dispositivo durante la pulizia
  const keep=new Set(["enea_current_user","enea_local_accounts","enea_data_version","enea_fip_seeded_v22"]);
  const toRemove=[];
  for(let i=0;i<localStorage.length;i++){
    const k=localStorage.key(i);
    if(k&&k.startsWith("enea_")&&!keep.has(k))toRemove.push(k);
  }
  toRemove.forEach(k=>{try{localStorage.removeItem(k);}catch{}});
  Object.entries(allData).forEach(([k,v])=>{
    try{localStorage.setItem("enea_"+k,JSON.stringify(v));}catch{}
  });
}

// Feedback aptico (vibrazione iOS-style)
const haptic={
  light(){try{if(navigator.vibrate)navigator.vibrate(8);}catch{}},
  medium(){try{if(navigator.vibrate)navigator.vibrate(15);}catch{}},
  success(){try{if(navigator.vibrate)navigator.vibrate([10,40,20]);}catch{}},
  warn(){try{if(navigator.vibrate)navigator.vibrate([20,40,20,40]);}catch{}},
};

// Date in fuso orario locale (evita bug di off-by-one con TZ ≠ UTC)
function localDateStr(d){const x=d||new Date();const y=x.getFullYear();const m=String(x.getMonth()+1).padStart(2,"0");const dd=String(x.getDate()).padStart(2,"0");return y+"-"+m+"-"+dd;}
function todayStr(){return localDateStr();}
function getWD(){const d=new Date(),m=new Date(d);m.setDate(d.getDate()-((d.getDay()+6)%7));return Array.from({length:7},(_,i)=>{const x=new Date(m);x.setDate(m.getDate()+i);return localDateStr(x);});}

function daysUntil(dateStr){
  if(!dateStr)return null;
  const target=new Date(dateStr+"T12:00:00");
  if(isNaN(target.getTime()))return null;
  const today=new Date();today.setHours(12,0,0,0);
  return Math.round((target-today)/864e5);
}
window.__daysUntil=daysUntil;
function fileToB64(f){return new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(fr.result.split(",")[1]);fr.readAsDataURL(f);});}
function starsToScore(s){return s>0?(s-1)/4:null;}
function scoreToColor(s){if(s===null||s===undefined)return"rgba(255,255,255,0.12)";if(s>=0.8)return"#E4E4E7";if(s>=0.5)return"#A1A1AA";return"#71717A";}
function foodScoreLabel(s){if(s===null)return"-";if(s>=0.85)return"Ottimo";if(s>=0.7)return"Bene";if(s>=0.5)return"Normale";if(s>=0.3)return"Male";return"Pessimo";}

// ── TRACKING STATE: data inizio + periodi di pausa ────────────────────────
// startDate: prima data che conta nelle medie (YYYY-MM-DD) o null se mai impostata
// pausePeriods: array di {from:"YYYY-MM-DD", to:"YYYY-MM-DD"|null} (to=null => pausa ancora attiva)
function getTrackingState(){
  try{
    const raw=localStorage.getItem("enea_tracking_state");
    if(!raw)return{startDate:null,pausePeriods:[]};
    const s=JSON.parse(raw);
    return{
      startDate:typeof s.startDate==="string"?s.startDate:null,
      pausePeriods:Array.isArray(s.pausePeriods)?s.pausePeriods:[],
    };
  }catch{return{startDate:null,pausePeriods:[]};}
}
function setTrackingState(next){
  try{localStorage.setItem("enea_tracking_state",JSON.stringify(next));}catch{}
  // Push su Firestore in background
  try{
    const cu=localStorage.getItem("enea_current_user");
    if(cu&&window.__firestore&&window.__fbHelpers){
      const {doc,setDoc}=window.__fbHelpers;
      const ref=doc(window.__firestore,"users",cu,"data","tracking_state");
      setDoc(ref,{value:next,updatedAt:Date.now()}).catch(()=>{});
    }
  }catch{}
}
function isPaused(dateStr){
  const {pausePeriods}=getTrackingState();
  if(!pausePeriods.length)return false;
  return pausePeriods.some(p=>{
    if(!p.from)return false;
    if(p.to===null||p.to===undefined)return dateStr>=p.from;
    return dateStr>=p.from&&dateStr<=p.to;
  });
}
function isCurrentlyPaused(){
  const {pausePeriods}=getTrackingState();
  return pausePeriods.some(p=>p.to===null||p.to===undefined);
}
// Un giorno "conta" se: ha startDate impostato (e date >= startDate), e non è in pausa
function dayCountsForStats(dateStr){
  const {startDate}=getTrackingState();
  if(!startDate)return false; // tracking non avviato → nessun giorno conta
  if(dateStr<startDate)return false;
  if(isPaused(dateStr))return false;
  return true;
}
window.__trackingHelpers={getTrackingState,setTrackingState,isPaused,isCurrentlyPaused,dayCountsForStats};

// ── BLOCCHI ALLENAMENTO: conversione exercises+skills → blocks ────────
// Se un giorno ha il vecchio formato (exercises+skills), lo converte in blocks[]
function schedDayToBlocks(day){
  if(!day)return [];
  // Se ha già blocks, usali
  if(Array.isArray(day.blocks)&&day.blocks.length>0)return day.blocks;
  // Altrimenti converti dal vecchio formato
  const blocks=[];
  const exList=day.exercises||[];
  if(exList.length>0){
    blocks.push({id:"_forza",title:"Forza",icon:"💪",items:exList.map(e=>({name:e.name||"",sets:e.sets||"",icon:e.icon||"💪"}))});
  }
  const skList=day.skills||[];
  if(skList.length>0){
    blocks.push({id:"_basket",title:"Basket",icon:"🏀",items:skList.map(s=>({name:typeof s==="string"?s:s.name||"",sets:typeof s==="string"?"":s.sets||"",icon:typeof s==="string"?"🏀":s.icon||"🏀"}))});
  }
  return blocks;
}
// Converte blocks[] di ritorno in exercises+skills (per backward compat dei log/stats)
function blocksToLegacy(blocks){
  const exercises=[];const skills=[];
  (blocks||[]).forEach(b=>{
    (b.items||[]).forEach(it=>{
      exercises.push({name:it.name||"",sets:it.sets||"",icon:it.icon||b.icon||"💪",_block:b.title||""});
    });
  });
  return{exercises,skills};
}
// Genera una lista piatta di tutti gli item (per conteggio completamenti e replica)
function flatBlockItems(blocks){
  const out=[];
  (blocks||[]).forEach(b=>{
    (b.items||[]).forEach(it=>{
      out.push({name:it.name||"",sets:it.sets||"",icon:it.icon||b.icon||"💪",_block:b.title||"",blockTitle:b.title||""});
    });
  });
  return out;
}



// ── CONFIRM MODAL (sostituisce window.confirm, bloccato su iOS PWA) ─────────
// Uso: const confirm = useConfirm();  await confirm("Messaggio?") → true/false
let __confirmResolve=null;
let __setConfirmState=null;
function ConfirmModal(){
  const [state,setState]=React.useState(null); // {msg,confirmLabel,cancelLabel}|null
  React.useEffect(()=>{__setConfirmState=setState;return()=>{__setConfirmState=null;};},[]);
  if(!state)return null;
  const resolve=(v)=>{setState(null);if(__confirmResolve){__confirmResolve(v);__confirmResolve=null;}};
  return ReactDOM.createPortal(
    <div onClick={()=>resolve(false)} style={{position:"fixed",inset:0,zIndex:99999,background:"rgba(0,0,0,.65)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",display:"flex",alignItems:"flex-end",justifyContent:"center",padding:"0 0 max(24px,env(safe-area-inset-bottom,24px)) 0"}}>
      <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:430,background:"#1C1C1E",border:"1px solid rgba(255,255,255,0.07)",borderRadius:"20px 20px 16px 16px",padding:"20px 18px 14px",boxShadow:"0 -4px 30px rgba(0,0,0,0.5)"}}>
        <div style={{fontSize:15,fontWeight:600,color:"#fff",lineHeight:1.45,marginBottom:18,textAlign:"center"}}>{state.msg}</div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={()=>resolve(false)} style={{flex:1,padding:"12px",borderRadius:12,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(118,118,128,0.18)",color:"rgba(235,235,245,0.75)",fontSize:15,fontWeight:500,cursor:"pointer"}}>{state.cancelLabel||"Annulla"}</button>
          <button onClick={()=>resolve(true)} style={{flex:1,padding:"12px",borderRadius:12,border:"none",background:"#FFFFFF",color:"#fff",fontSize:15,fontWeight:600,cursor:"pointer"}}>{state.confirmLabel||"Elimina"}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
function useConfirm(){
  return function(msg,opts={}){
    return new Promise(resolve=>{
      __confirmResolve=resolve;
      if(__setConfirmState)__setConfirmState({msg,confirmLabel:opts.confirm||"Elimina",cancelLabel:opts.cancel||"Annulla"});
      else resolve(false);
    });
  };
}
