// ── STATISTICHE: helper condivisi ─────────────────────────────────────────
const STAT_KEYS=["Punti","Assist","Rimbalzi","Palle rubate","Falli"];
const STAT_COLORS={
  "Punti":"#FFFFFF",
  "Assist":"#D4D4D8",
  "Rimbalzi":"#E4E4E7",
  "Palle rubate":"#A1A1AA",
  "Falli":"#9F9FA8",
};
const MONTHS_IT=["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];

/**
 * Calcola il punteggio aggregato di un giorno (cibo + training + task).
 * @returns {number|null} valore in [0..1] o null se non ci sono dati
 */
function computeDayScore(dateStr,dailyLogs){
  if(!dailyLogs||!dailyLogs[dateStr])return null;
  const log=dailyLogs[dateStr];
  const parts=[];
  // Cibo: media delle stelle dei pasti non saltati (consistent con HomeTab)
  try{
    const ms=load("mstars_"+dateStr,{});
    const sm=new Set(log.skippedMeals||[]);
    const vm=["Colazione","Spuntino","Pranzo","Merenda","Cena"].filter(m=>!sm.has(m));
    const valid=vm.filter(m=>ms[m]>0);
    if(valid.length>0){
      const avg=valid.reduce((a,m)=>a+ms[m],0)/valid.length;
      parts.push((avg-1)/4); // 1..5 stelle → 0..1
    }
  }catch{}
  if(typeof log.trainingDone!=="undefined"){
    parts.push(log.trainingDone?1:0);
  }
  if(typeof log.taskPct==="number"){
    parts.push(log.taskPct/100);
  }
  if(parts.length===0)return null;
  return parts.reduce((a,b)=>a+b,0)/parts.length;
}

// ── Grafico: andamento ultimi 30 giorni ───────────────────────────────────
function StatsAndamento({dailyLogs,td}){
  const days=[];
  for(let i=29;i>=0;i--){
    const d=new Date();d.setDate(d.getDate()-i);
    const ds=localDateStr(d);
    const paused=window.__trackingHelpers?window.__trackingHelpers.isPaused(ds):false;
    days.push({date:ds,dom:d.getDate(),score:paused?null:computeDayScore(ds,dailyLogs),paused});
  }
  const W=Math.max(330,days.length*11+20);
  const H=140;
  const padL=4,padR=4,padT=10,padB=22;
  const innerW=W-padL-padR;
  const innerH=H-padT-padB;
  const colW=innerW/days.length;
  const barW=Math.max(4,colW-3);
  return(
    <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:14,padding:14,marginBottom:11}}>
      <div style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,0.85)",marginBottom:11}}>📈 Andamento 30 giorni</div>
      <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
        <svg width={W} height={H} style={{display:"block",minWidth:"100%"}}>
          {/* baseline */}
          <line x1={padL} y1={padT+innerH} x2={W-padR} y2={padT+innerH} stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>
          {days.map((d,i)=>{
            const x=padL+i*colW+(colW-barW)/2;
            const hasData=d.score!==null;
            const h=hasData?Math.max(2,d.score*innerH):3;
            const y=padT+innerH-h;
            const fill=d.paused?"rgba(140,140,140,0.4)":hasData?scoreToColor(d.score):"rgba(255,255,255,0.08)";
            const isToday=d.date===td;
            return(
              <g key={d.date}>
                <rect x={x} y={y} width={barW} height={h} rx="2" fill={fill} opacity={d.paused?0.55:hasData?(isToday?1:0.92):0.5}/>
                {(i%5===0||i===days.length-1)&&(
                  <text x={x+barW/2} y={H-6} textAnchor="middle" fontSize="9" fill={isToday?"#FFFFFF":"rgba(255,255,255,0.4)"} fontWeight={isToday?700:500}>
                    {isToday?"oggi":d.dom}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ── Grafico: confronto settimana corrente vs precedente ───────────────────
function StatsWeekCompare({dailyLogs,td}){
  // Lunedì delle due settimane di riferimento
  const now=new Date();
  const monThis=new Date(now);monThis.setDate(now.getDate()-((now.getDay()+6)%7));
  const monLast=new Date(monThis);monLast.setDate(monThis.getDate()-7);
  const dowToday=(now.getDay()+6)%7;
  const items=Array.from({length:7},(_,i)=>{
    const a=new Date(monThis);a.setDate(monThis.getDate()+i);
    const b=new Date(monLast);b.setDate(monLast.getDate()+i);
    const aStr=localDateStr(a),bStr=localDateStr(b);
    const aPaused=window.__trackingHelpers?window.__trackingHelpers.isPaused(aStr):false;
    const bPaused=window.__trackingHelpers?window.__trackingHelpers.isPaused(bStr):false;
    return{
      i,letter:DAYS_LETTER[i],
      aFuture:a>now,
      thisScore:aPaused?null:computeDayScore(aStr,dailyLogs),
      lastScore:bPaused?null:computeDayScore(bStr,dailyLogs),
    };
  });
  const W=340,H=140;
  const padL=8,padR=8,padT=10,padB=24;
  const innerW=W-padL-padR;
  const innerH=H-padT-padB;
  const groupW=innerW/7;
  const barW=Math.min(13,(groupW-6)/2);
  return(
    <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:14,padding:14,marginBottom:11}}>
      <div style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,0.85)",marginBottom:8}}>📊 Questa settimana vs scorsa</div>
      <div style={{display:"flex",alignItems:"center",gap:11,marginBottom:10,fontSize:10,color:"rgba(255,255,255,0.55)"}}>
        <span><span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:"#FFFFFF",marginRight:5,verticalAlign:"middle"}}/>Questa settimana</span>
        <span><span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:"rgba(255,255,255,0.35)",marginRight:5,verticalAlign:"middle"}}/>Scorsa</span>
      </div>
      <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
        <svg width={W} height={H} style={{display:"block",minWidth:"100%"}}>
          <line x1={padL} y1={padT+innerH} x2={W-padR} y2={padT+innerH} stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>
          {items.map(it=>{
            const cx=padL+it.i*groupW+groupW/2;
            const hThis=it.thisScore!==null?Math.max(2,it.thisScore*innerH):0;
            const hLast=it.lastScore!==null?Math.max(2,it.lastScore*innerH):0;
            const xThis=cx-barW-1.5;
            const xLast=cx+1.5;
            return(
              <g key={it.i}>
                {hThis>0&&<rect x={xThis} y={padT+innerH-hThis} width={barW} height={hThis} rx="2" fill="#FFFFFF"/>}
                {hLast>0&&<rect x={xLast} y={padT+innerH-hLast} width={barW} height={hLast} rx="2" fill="rgba(255,255,255,0.22)"/>}
                <text x={cx} y={H-7} textAnchor="middle" fontSize="11" fill={it.i===dowToday?"#fff":"rgba(255,255,255,0.4)"} fontWeight={it.i===dowToday?700:500}>{it.letter}</text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ── Record mensili ────────────────────────────────────────────────────────
function StatsRecords(){
  // Refresh "today" ogni minuto: serve per accuratezza dei banner di fine/inizio mese
  const [today,setToday]=useState(()=>new Date());
  useEffect(()=>{
    const tick=()=>setToday(new Date());
    const t=setInterval(tick,60000);
    return()=>clearInterval(t);
  },[]);
  function monthKey(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");}
  const currentMK=monthKey(today);
  const [viewYM,setViewYM]=useState(currentMK);
  const [records,setRecords]=useState(()=>load("records",{}));
  const [adding,setAdding]=useState(false);
  const [newLabel,setNewLabel]=useState("");

  // Pre-popolamento del mese corrente con i record attivi del mese precedente
  useEffect(()=>{
    setRecords(prev=>{
      if(prev[currentMK])return prev;
      const prevDate=new Date(today.getFullYear(),today.getMonth()-1,1);
      const prevMK=monthKey(prevDate);
      const prevRecs=prev[prevMK];
      const seeded=Array.isArray(prevRecs)
        ?prevRecs.filter(r=>r.active).map((r,idx)=>({id:String(Date.now())+"_"+idx+"_"+Math.random().toString(36).slice(2,10),label:r.label,value:0,active:true}))
        :[];
      const next={...prev,[currentMK]:seeded};
      save("records",next);
      return next;
    });
  // eslint-disable-next-line
  },[currentMK]);

  useEffect(()=>{save("records",records);},[records]);

  function changeMonth(delta){
    const [y,m]=viewYM.split("-").map(Number);
    const d=new Date(y,m-1+delta,1);
    setViewYM(monthKey(d));
    setAdding(false);setNewLabel("");
  }

  const isCurrent=viewYM===currentMK;
  const list=records[viewYM]||[];
  const [yy,mm]=viewYM.split("-").map(Number);
  const monthLabel=MONTHS_IT[mm-1]+" "+yy;

  // Banner promemoria fine/inizio mese, con dismissione persistente per non riapparire
  const [bannerDismissed,setBannerDismissed]=useState(()=>load("records_banner_dismissed",{}));
  useEffect(()=>{save("records_banner_dismissed",bannerDismissed);},[bannerDismissed]);

  function getBanner(){
    if(!isCurrent)return null;
    const day=today.getDate();
    const lastDayOfMonth=new Date(today.getFullYear(),today.getMonth()+1,0).getDate();
    const daysToEnd=lastDayOfMonth-day;

    // Ultimi 3 giorni del mese: invita ad aggiornare i record correnti
    if(daysToEnd<=2){
      const key="end_"+currentMK;
      if(bannerDismissed[key])return null;
      const cur=records[currentMK]||[];
      const hasActive=cur.some(r=>r.active);
      if(!hasActive)return null;
      return{
        key,
        type:"end",
        title:daysToEnd===0?"⏰ Ultimo giorno del mese!":"⏰ Il mese sta per finire",
        text:daysToEnd===0
          ?"Aggiorna i tuoi record di "+MONTHS_IT[today.getMonth()].toLowerCase()+" prima di stanotte."
          :"Mancano "+(daysToEnd+1)+" giorni alla fine di "+MONTHS_IT[today.getMonth()].toLowerCase()+". Ricontrolla i tuoi record!",
      };
    }

    // Primi 5 giorni del nuovo mese: invita a compilare quelli appena pre-popolati (tutti a 0)
    if(day<=5){
      const key="start_"+currentMK;
      if(bannerDismissed[key])return null;
      const cur=records[currentMK]||[];
      const hasActive=cur.some(r=>r.active);
      if(!hasActive)return null;
      const allZero=cur.filter(r=>r.active).every(r=>!r.value||r.value===0);
      if(!allZero)return null;
      const prevDate=new Date(today.getFullYear(),today.getMonth()-1,1);
      const prevMonthName=MONTHS_IT[prevDate.getMonth()];
      return{
        key,
        type:"start",
        title:"🆕 Nuovo mese!",
        text:"I record sono stati copiati da "+prevMonthName.toLowerCase()+". Aggiorna i tuoi nuovi obiettivi per "+MONTHS_IT[today.getMonth()].toLowerCase()+".",
      };
    }
    return null;
  }
  const banner=getBanner();

  function updateValue(id,val){
    const v=val===""?0:Number(val);
    setRecords(prev=>({...prev,[viewYM]:(prev[viewYM]||[]).map(r=>r.id===id?{...r,value:isNaN(v)?0:v}:r)}));
  }
  function toggleActive(id){
    setRecords(prev=>({...prev,[viewYM]:(prev[viewYM]||[]).map(r=>r.id===id?{...r,active:!r.active}:r)}));
  }
  function removeRecord(id){
    setRecords(prev=>({...prev,[viewYM]:(prev[viewYM]||[]).filter(r=>r.id!==id)}));
  }
  function addRecord(){
    const label=newLabel.trim();
    if(!label)return;
    const newR={id:genId(),label,value:0,active:true};
    setRecords(prev=>({...prev,[viewYM]:[...(prev[viewYM]||[]),newR]}));
    setNewLabel("");setAdding(false);
  }

  return(
    <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:14,padding:14,marginBottom:11}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:11}}>
        <div style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,0.85)"}}>🏆 Record mensili</div>
      </div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:11,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:11,padding:"6px 10px"}}>
        <button onClick={()=>changeMonth(-1)} style={{background:"transparent",border:"none",color:"rgba(255,255,255,0.55)",fontSize:18,cursor:"pointer",padding:"2px 8px"}}>‹</button>
        <div style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,0.85)"}}>{monthLabel}{!isCurrent&&<span style={{fontSize:9,color:"rgba(255,255,255,0.35)",marginLeft:6,fontWeight:500}}>(archivio)</span>}</div>
        <button onClick={()=>changeMonth(1)} disabled={viewYM>=currentMK} style={{background:"transparent",border:"none",color:viewYM>=currentMK?"rgba(255,255,255,0.15)":"rgba(255,255,255,0.55)",fontSize:18,cursor:viewYM>=currentMK?"not-allowed":"pointer",padding:"2px 8px"}}>›</button>
      </div>
      {banner&&(
        <div style={{
          background:banner.type==="end"?"linear-gradient(135deg,rgba(255,255,255,0.13),rgba(255,255,255,0.06))":"linear-gradient(135deg,rgba(228,228,231,0.13),rgba(77,184,255,0.05))",
          border:"1px solid "+(banner.type==="end"?"rgba(255,255,255,0.32)":"rgba(228,228,231,0.28)"),
          borderRadius:12,padding:"11px 12px",marginBottom:11,
          display:"flex",alignItems:"flex-start",gap:9
        }}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:12,fontWeight:700,color:banner.type==="end"?"#FFFFFF":"#E4E4E7",marginBottom:3}}>{banner.title}</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.7)",lineHeight:1.4}}>{banner.text}</div>
          </div>
          <button onClick={()=>setBannerDismissed(p=>({...p,[banner.key]:true}))}
            title="Chiudi"
            style={{background:"transparent",border:"none",color:"rgba(255,255,255,0.35)",fontSize:15,cursor:"pointer",padding:"0 4px",flexShrink:0,lineHeight:1}}>✕</button>
        </div>
      )}
      {list.length===0&&!adding&&(
        <div style={{fontSize:12,color:"rgba(255,255,255,0.32)",textAlign:"center",padding:"14px 0"}}>{isCurrent?"Nessun record. Aggiungine uno!":"Nessun record per questo mese."}</div>
      )}
      {list.map(r=>(
        <div key={r.id} style={{display:"flex",alignItems:"center",gap:9,padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.04)",opacity:r.active?1:0.45}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:12,fontWeight:600,color:"rgba(255,255,255,0.85)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.label}</div>
            {!r.active&&<div style={{fontSize:9,color:"rgba(255,255,255,0.35)",marginTop:1}}>disattivato</div>}
          </div>
          {isCurrent?(
            <input type="number" value={r.value||""} onChange={e=>updateValue(r.id,e.target.value)} placeholder="0"
              style={{width:70,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,color:"#FFFFFF",padding:"6px 8px",fontSize:13,fontWeight:700,outline:"none",textAlign:"right",fontFamily:"var(--font-mono)"}}/>
          ):(
            <div style={{fontSize:14,fontWeight:700,color:r.active?"#FFFFFF":"rgba(255,255,255,0.4)",fontFamily:"var(--font-mono)",minWidth:50,textAlign:"right"}}>{r.value||0}</div>
          )}
          {isCurrent&&(
            <>
              <button onClick={()=>toggleActive(r.id)} title={r.active?"Disattiva":"Attiva"}
                style={{background:r.active?"rgba(228,228,231,0.1)":"rgba(255,255,255,0.04)",border:"1px solid "+(r.active?"rgba(228,228,231,0.25)":"rgba(255,255,255,0.07)"),borderRadius:7,color:r.active?"#E4E4E7":"rgba(255,255,255,0.3)",fontSize:12,padding:"4px 7px",cursor:"pointer"}}>
                {r.active?"👁":"🚫"}
              </button>
              <button onClick={()=>removeRecord(r.id)} title="Elimina"
                style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:7,color:"rgba(255,255,255,0.6)",fontSize:11,padding:"4px 7px",cursor:"pointer"}}>✕</button>
            </>
          )}
        </div>
      ))}
      {isCurrent&&(adding?(
        <div style={{marginTop:10,display:"flex",gap:6}}>
          <input autoFocus value={newLabel} onChange={e=>setNewLabel(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&addRecord()}
            placeholder="es. Max push-ups"
            style={{flex:1,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:9,color:"#fff",padding:"8px 11px",fontSize:13,outline:"none"}}/>
          <button onClick={addRecord} style={{background:"linear-gradient(135deg,#E4E4E7,#FFFFFF)",border:"none",borderRadius:9,color:"#fff",fontSize:12,fontWeight:700,padding:"8px 14px",cursor:"pointer"}}>OK</button>
          <button onClick={()=>{setAdding(false);setNewLabel("");}} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:9,color:"rgba(255,255,255,0.45)",fontSize:12,padding:"8px 11px",cursor:"pointer"}}>✕</button>
        </div>
      ):(
        <button onClick={()=>setAdding(true)} style={{marginTop:10,width:"100%",background:"rgba(255,255,255,0.05)",border:"1px dashed rgba(255,255,255,0.25)",borderRadius:9,color:"#FFFFFF",fontSize:12,fontWeight:600,padding:"8px",cursor:"pointer"}}>+ Aggiungi record</button>
      ))}
    </div>
  );
}

// ── Statistiche partite ───────────────────────────────────────────────────
function StatsPartite(){
  const [games,setGames]=useState(()=>load("game_stats",[]));
  const [currentSeason,setCurrentSeason]=useState(()=>load("current_season",1));
  const [navIdx,setNavIdx]=useState(0); // 0 = ultima
  const [chartMode,setChartMode]=useState("Ultima vs Penultima");
  const [seasonConfirm,setSeasonConfirm]=useState(false);

  useEffect(()=>{save("game_stats",games);},[games]);
  useEffect(()=>{save("current_season",currentSeason);},[currentSeason]);

  // Sortate dalla più recente alla più vecchia (TUTTE, non solo stagione corrente, per nav)
  const sorted=[...games].sort((a,b)=>b.date.localeCompare(a.date));
  const seasonGames=sorted.filter(g=>(g.season??1)===currentSeason);
  // Per il chart: solo stagione corrente, non skipped, ordinate cronologicamente
  const chartGames=seasonGames.filter(g=>!g.skipped).sort((a,b)=>a.date.localeCompare(b.date));

  // Reset nav se l'indice diventa invalido (es. dopo eliminazione partita)
  useEffect(()=>{
    if(navIdx>=sorted.length&&sorted.length>0)setNavIdx(0);
  },[sorted.length,navIdx]);

  const cur=sorted[navIdx];
  // numero progressivo della partita IN tutta la storia (non per stagione)
  const matchNumber=cur?(games.filter(g=>g.date<cur.date||(g.date===cur.date&&g.id<cur.id)).length+1):0;

  function formatDate(ds){
    if(!ds)return "";
    const [y,m,d]=ds.split("-").map(Number);
    return d+" "+MONTHS_IT[m-1]+" "+y;
  }

  function newSeason(){
    const curSeason=currentSeason;
    // Archivia la stagione corrente con le sue partite FIP
    try{
      const arch=load("seasons_archive",[]);
      const existing=arch.find(s=>s.id===curSeason);
      if(!existing){
        const curPartite=load("fip_matches",[]);
        arch.push({
          id:curSeason,
          label:"Stagione "+curSeason,
          archivedAt:Date.now(),
          matches:Array.isArray(curPartite)?curPartite:[],
        });
        save("seasons_archive",arch);
      }
      // Marca con la stagione vecchia tutti i game_stats che ancora non hanno season
      const games2=load("game_stats",[]);
      const updated=games2.map(g=>g.season?g:{...g,season:curSeason});
      save("game_stats",updated);
      setGames(updated);
      // Svuota il calendario partite della stagione: la nuova stagione partirà da un calendario pulito
      // (l'utente potrà importare il nuovo PDF FIP dalle Impostazioni)
      save("fip_matches",[]);
    }catch{}
    setCurrentSeason(s=>s+1);
    setSeasonConfirm(false);
  }
  function buildChartData(){
    if(chartGames.length===0)return{games:[],averages:{}};
    if(chartMode==="Ultima vs Penultima"){
      const last=chartGames[chartGames.length-1];
      const prev=chartGames[chartGames.length-2];
      const arr=prev?[prev,last]:[last];
      return{games:arr,averages:{}};
    }
    if(chartMode==="Ultima vs Prima"){
      const first=chartGames[0];
      const last=chartGames[chartGames.length-1];
      if(chartGames.length===1)return{games:[last],averages:{}};
      return{games:[first,last],averages:{}};
    }
    // Media
    const averages={};
    STAT_KEYS.forEach(k=>{
      const vals=chartGames.map(g=>g.stats?.[k]).filter(v=>typeof v==="number");
      if(vals.length>0)averages[k]=vals.reduce((a,b)=>a+b,0)/vals.length;
    });
    return{games:chartGames,averages};
  }
  const chartData=buildChartData();

  // calcola scala Y
  const allValues=[];
  chartData.games.forEach(g=>{
    STAT_KEYS.forEach(k=>{
      const v=g.stats?.[k];
      if(typeof v==="number")allValues.push(v);
    });
  });
  Object.values(chartData.averages).forEach(v=>allValues.push(v));
  const maxV=allValues.length>0?Math.max(...allValues,1):10;
  const minV=0;
  const yMax=Math.max(maxV,1);

  const W=Math.max(310,chartData.games.length*45+60);
  const H=180;
  const padL=30,padR=12,padT=10,padB=22;
  const innerW=W-padL-padR;
  const innerH=H-padT-padB;
  function xFor(i){
    const n=chartData.games.length;
    if(n<=1)return padL+innerW/2;
    return padL+(i/(n-1))*innerW;
  }
  function yFor(v){
    if(typeof v!=="number")return null;
    return padT+innerH-(v/yMax)*innerH;
  }
  const yTicks=[0,Math.round(yMax/3),Math.round(yMax*2/3),Math.round(yMax)].filter((v,i,a)=>a.indexOf(v)===i);

  return(
    <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:14,padding:14,marginBottom:11}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:11}}>
        <div style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,0.85)"}}>🏀 Statistiche partite</div>
        <span style={{fontSize:9,color:"rgba(255,255,255,0.35)",fontWeight:600,letterSpacing:.4}}>STAGIONE {currentSeason}</span>
      </div>

      {sorted.length===0?(
        <div style={{fontSize:12,color:"rgba(255,255,255,0.32)",textAlign:"center",padding:"18px 0"}}>Nessuna partita registrata.<br/><span style={{fontSize:11,color:"rgba(255,255,255,0.22)"}}>Vai in Train, segna "ho giocato" e inserisci i dati.</span></div>
      ):(<>
        {/* nav partite */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:11,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:11,padding:"6px 10px"}}>
          <button onClick={()=>setNavIdx(i=>Math.min(sorted.length-1,i+1))} disabled={navIdx>=sorted.length-1} style={{background:"transparent",border:"none",color:navIdx>=sorted.length-1?"rgba(255,255,255,0.15)":"rgba(255,255,255,0.55)",fontSize:18,cursor:navIdx>=sorted.length-1?"not-allowed":"pointer",padding:"2px 8px"}}>‹</button>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.85)"}}>Partita N° {matchNumber}</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginTop:1}}>{formatDate(cur?.date)}{cur&&(cur.season??1)!==currentSeason?" · St."+(cur.season??1):""}</div>
          </div>
          <button onClick={()=>setNavIdx(i=>Math.max(0,i-1))} disabled={navIdx<=0} style={{background:"transparent",border:"none",color:navIdx<=0?"rgba(255,255,255,0.15)":"rgba(255,255,255,0.55)",fontSize:18,cursor:navIdx<=0?"not-allowed":"pointer",padding:"2px 8px"}}>›</button>
        </div>

        {/* tabella o banner skipped */}
        {cur&&cur.skipped?(
          <div style={{background:"rgba(161,161,170,0.06)",border:"1px solid rgba(161,161,170,0.22)",borderRadius:10,padding:"14px 12px",textAlign:"center",fontSize:13,color:"#A1A1AA",fontWeight:600,marginBottom:14}}>⏭ Partita saltata</div>
        ):cur?(
          <div style={{marginBottom:14}}>
            {cur.score&&typeof cur.score.mia==="number"&&typeof cur.score.avv==="number"&&(()=>{
              const win=cur.score.mia>cur.score.avv;
              const draw=cur.score.mia===cur.score.avv;
              const color=draw?"#A1A1AA":(win?"#E4E4E7":"#FFFFFF");
              const bg=draw?"rgba(161,161,170,0.07)":(win?"rgba(228,228,231,0.08)":"rgba(255,255,255,0.07)");
              const border=draw?"rgba(161,161,170,0.22)":(win?"rgba(228,228,231,0.25)":"rgba(255,255,255,0.22)");
              return(
                <div style={{background:bg,border:"1px solid "+border,borderRadius:10,padding:"10px 12px",marginBottom:10,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <span style={{fontSize:11,color:color,fontWeight:700,letterSpacing:.3}}>{draw?"= PAREGGIO":(win?"✓ VITTORIA":"✗ SCONFITTA")}</span>
                  <span style={{fontSize:16,fontWeight:800,color:color,fontFamily:"var(--font-mono)"}}>{cur.score.mia} - {cur.score.avv}</span>
                </div>
              );
            })()}
            {STAT_KEYS.map(k=>{
              const v=cur.stats?.[k];
              return(
                <div key={k} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                  <div style={{display:"flex",alignItems:"center",gap:9}}>
                    <span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:STAT_COLORS[k]}}/>
                    <span style={{fontSize:12,color:"rgba(255,255,255,0.78)",fontWeight:500}}>{k}</span>
                  </div>
                  <span style={{fontSize:14,fontWeight:700,color:v==null?"rgba(255,255,255,0.25)":STAT_COLORS[k],fontFamily:"var(--font-mono)"}}>{v==null?"—":v}</span>
                </div>
              );
            })}
          </div>
        ):null}

        {/* line chart confronto */}
        <div style={{borderTop:"1px solid rgba(255,255,255,0.05)",paddingTop:11,marginTop:6}}>
          <div style={{display:"flex",gap:5,marginBottom:10,flexWrap:"wrap"}}>
            {["Ultima vs Penultima","Ultima vs Prima","Media"].map(m=>(
              <button key={m} onClick={()=>setChartMode(m)}
                style={{flex:1,minWidth:80,padding:"6px 6px",borderRadius:9,fontSize:10,fontWeight:600,cursor:"pointer",border:"1px solid "+(chartMode===m?"rgba(255,255,255,0.45)":"rgba(255,255,255,0.07)"),background:chartMode===m?"rgba(255,255,255,0.12)":"rgba(255,255,255,0.03)",color:chartMode===m?"#FFFFFF":"rgba(255,255,255,0.4)"}}>{m}</button>
            ))}
          </div>
          {/* Legenda */}
          <div style={{display:"flex",flexWrap:"wrap",gap:9,marginBottom:9,fontSize:9,color:"rgba(255,255,255,0.55)"}}>
            {STAT_KEYS.map(k=>(
              <span key={k} style={{display:"inline-flex",alignItems:"center",gap:4}}>
                <span style={{display:"inline-block",width:7,height:7,borderRadius:"50%",background:STAT_COLORS[k]}}/>
                {k}
              </span>
            ))}
          </div>

          {chartData.games.length===0?(
            <div style={{fontSize:11,color:"rgba(255,255,255,0.3)",textAlign:"center",padding:"20px 0"}}>Servono almeno 1 partita giocata in questa stagione</div>
          ):(
            <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
              <svg width={W} height={H} style={{display:"block",minWidth:"100%"}}>
                {/* griglia orizzontale */}
                {yTicks.map((t,i)=>{
                  const y=yFor(t);
                  return(<g key={i}>
                    <line x1={padL} y1={y} x2={W-padR} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1"/>
                    <text x={padL-5} y={y+3} textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.32)">{t}</text>
                  </g>);
                })}
                {/* medie (linee tratteggiate) */}
                {chartMode==="Media"&&Object.entries(chartData.averages).map(([k,v])=>{
                  const y=yFor(v);
                  if(y==null)return null;
                  return<line key={k} x1={padL} y1={y} x2={W-padR} y2={y} stroke={STAT_COLORS[k]} strokeWidth="1" strokeDasharray="4,4" opacity="0.4"/>;
                })}
                {/* linee per ogni stat */}
                {STAT_KEYS.map(k=>{
                  // costruisce segmenti continui ignorando i null
                  const segs=[];
                  let cur=[];
                  chartData.games.forEach((g,i)=>{
                    const v=g.stats?.[k];
                    if(typeof v==="number"){cur.push({x:xFor(i),y:yFor(v),v});}
                    else if(cur.length>0){segs.push(cur);cur=[];}
                  });
                  if(cur.length>0)segs.push(cur);
                  return(<g key={k}>
                    {segs.map((seg,si)=>(
                      seg.length>=2?(
                        <polyline key={si} points={seg.map(p=>p.x+","+p.y).join(" ")} fill="none" stroke={STAT_COLORS[k]} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      ):null
                    ))}
                    {segs.flat().map((p,i)=>(
                      <circle key={k+"_"+i} cx={p.x} cy={p.y} r="3.5" fill={STAT_COLORS[k]}/>
                    ))}
                  </g>);
                })}
                {/* asse X labels */}
                {chartData.games.map((g,i)=>{
                  const idx=chartGames.indexOf(g);
                  const label=idx>=0?("P"+(idx+1)):"—";
                  return<text key={i} x={xFor(i)} y={H-6} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.4)">{label}</text>;
                })}
              </svg>
            </div>
          )}
        </div>
      </>)}

      {/* Nuova stagione */}
      <div style={{borderTop:"1px solid rgba(255,255,255,0.05)",marginTop:12,paddingTop:11}}>
        {!seasonConfirm?(
          <button onClick={()=>setSeasonConfirm(true)}
            style={{width:"100%",padding:"9px",borderRadius:10,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.03)",color:"rgba(255,255,255,0.5)",fontSize:11,fontWeight:600,cursor:"pointer"}}>
            🏁 Nuova stagione
          </button>
        ):(
          <div style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.22)",borderRadius:10,padding:11}}>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.85)",marginBottom:8,fontWeight:600}}>Sei sicuro? La stagione attuale verrà archiviata.</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginBottom:10,lineHeight:1.5}}>Le partite vecchie restano navigabili, ma le medie e il grafico si resettano sulla nuova stagione.</div>
            <div style={{display:"flex",gap:7}}>
              <button onClick={()=>setSeasonConfirm(false)} style={{flex:1,padding:"8px",borderRadius:8,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.04)",color:"rgba(255,255,255,0.55)",fontSize:11,cursor:"pointer",fontWeight:600}}>Annulla</button>
              <button onClick={newSeason} style={{flex:1,padding:"8px",borderRadius:8,border:"none",background:"linear-gradient(135deg,#E4E4E7,#FFFFFF)",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer"}}>Conferma</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

