function HistoryEditor({dailyLogs,setDailyLogs,completedDays,setCompletedDays,setStreak}){
  const today=new Date();
  const [selDate,setSelDate]=useState(null);
  const [draft,setDraft]=useState(null);

  // Ultimi 30 giorni (escluso oggi)
  const days=Array.from({length:30},(_,i)=>{
    const d=new Date(today);d.setDate(d.getDate()-(i+1));
    return localDateStr(d);
  });

  const MEALS_LIST=["Colazione","Spuntino","Pranzo","Merenda","Cena"];
  const MEAL_ICONS_LIST=["☀️","🍎","🍽️","🥤","🌙"];

  // Apre un giorno per editing: carica TUTTI i dettagli dal localStorage
  function openDay(date){
    const log=dailyLogs[date]||{};
    // Pasti: carica le stelle per singolo pasto
    let mstars={};
    try{const raw=localStorage.getItem("enea_mstars_"+date);if(raw)mstars=JSON.parse(raw)||{};}catch{}
    // Schedule del giorno
    const dow=(new Date(date+"T12:00:00").getDay()+6)%7;
    let cs=null;try{const d=localStorage.getItem("enea_custom_schedule");if(d)cs=JSON.parse(d);}catch{}
    const sched=(cs&&cs[dow])||SCHEDULE[dow]||{exercises:[],skills:[]};
    // Esercizi completati (chiavi enea_ex_<data>) e skills (enea_sk_<data>)
    let exDone={};let skDone={};
    try{const raw=localStorage.getItem("enea_ex_"+date);if(raw)exDone=JSON.parse(raw)||{};}catch{}
    try{const raw=localStorage.getItem("enea_sk_"+date);if(raw)skDone=JSON.parse(raw)||{};}catch{}
    // Task quotidiane (tasks_v2 e taskDone tdone2_<data>)
    let allTasks=[];let tDone={};
    try{const raw=localStorage.getItem("enea_tasks_v2");if(raw)allTasks=JSON.parse(raw)||[];}catch{}
    try{const raw=localStorage.getItem("enea_tdone2_"+date);if(raw)tDone=JSON.parse(raw)||{};}catch{}
    const dayTasks=allTasks.filter(t=>{
      if(!t.days)return true;
      if(t.days.length===1&&t.days[0]===7)return false;
      return t.days.includes(dow);
    });
    // Skip set
    const skippedEx=Array.isArray(log.skippedEx)?[...log.skippedEx]:[];
    const skippedMeals=Array.isArray(log.skippedMeals)?[...log.skippedMeals]:[];
    const skippedTasks=Array.isArray(log.skippedTasks)?[...log.skippedTasks]:[];

    setDraft({
      mstars,
      sched,
      exDone:{...exDone},
      skDone:{...skDone},
      dayTasks,
      tDone:{...tDone},
      skippedEx:new Set(skippedEx),
      skippedMeals:new Set(skippedMeals),
      skippedTasks:new Set(skippedTasks),
      trainingDone:!!log.trainingDone,
    });
    setSelDate(date);
  }

  function saveDay(){
    // 1. Salva stelle per pasto
    try{localStorage.setItem("enea_mstars_"+selDate,JSON.stringify(draft.mstars||{}));}catch{}
    // 2. Salva esercizi / skills completati
    try{localStorage.setItem("enea_ex_"+selDate,JSON.stringify(draft.exDone||{}));}catch{}
    try{localStorage.setItem("enea_sk_"+selDate,JSON.stringify(draft.skDone||{}));}catch{}
    // 3. Salva task done
    try{localStorage.setItem("enea_tdone2_"+selDate,JSON.stringify(draft.tDone||{}));}catch{}

    // 4. Calcola trainingDone: vero se tutti i non-skippati sono completati (o ha skippato tutto)
    const histBlocksItems=flatBlockItems(schedDayToBlocks(draft.sched));
    const allItems=histBlocksItems.map(it=>({k:it.name,done:!!(draft.exDone[it.name]||draft.skDone[it.name])}));
    const nonSkipped=allItems.filter(it=>!draft.skippedEx.has(it.k));
    let trainingDone=draft.trainingDone;
    if(allItems.length>0){
      if(nonSkipped.length===0){
        // Tutto skippato: conta come fatto
        trainingDone=true;
      } else {
        trainingDone=nonSkipped.every(it=>it.done);
      }
    }
    try{localStorage.setItem("enea_tdone_"+selDate,JSON.stringify(trainingDone));}catch{}

    // 5. Calcola taskPct
    const validTasks=draft.dayTasks.filter(t=>!draft.skippedTasks.has(String(t.id)));
    const doneTasks=validTasks.filter(t=>draft.tDone[t.id]).length;
    const taskPct=validTasks.length>0?Math.round((doneTasks/validTasks.length)*100):0;

    // 6. Calcola foodStars (media stelle non skippate)
    const validMealStars=MEALS_LIST.filter(m=>!draft.skippedMeals.has(m)).map(m=>draft.mstars[m]).filter(v=>v>0);
    const foodStars=validMealStars.length>0?Math.round(validMealStars.reduce((a,b)=>a+b,0)/validMealStars.length):0;

    // 7. Determina se il giorno è "completato" (per grafico 14 giorni)
    const dayDone=trainingDone||taskPct>=50||foodStars>=3;
    const newCD={...completedDays};
    if(dayDone)newCD[selDate]=true;else delete newCD[selDate];
    setCompletedDays(newCD);
    try{localStorage.setItem("enea_cdays",JSON.stringify(newCD));}catch{}

    // 8. Ricalcola streak partendo da ieri
    let s=0;
    const todayKey=localDateStr();
    const cur=new Date();cur.setDate(cur.getDate()-1);
    while(true){
      const dk=localDateStr(cur);
      if(newCD[dk]){s++;cur.setDate(cur.getDate()-1);}
      else break;
    }
    if(newCD[todayKey])s++;
    setStreak(s);
    try{localStorage.setItem("enea_streak",JSON.stringify(s));}catch{}

    // 9. Salva il dailyLog aggregato
    setDailyLogs(prev=>{
      const next={...prev,[selDate]:{
        ...prev[selDate],
        foodStars,trainingDone,taskPct,
        skippedEx:[...draft.skippedEx].sort(),
        skippedMeals:[...draft.skippedMeals].sort(),
        skippedTasks:[...draft.skippedTasks].sort(),
      }};
      try{localStorage.setItem("enea_dlogs",JSON.stringify(next));}catch{}
      return next;
    });

    setSelDate(null);setDraft(null);
    haptic.success();
  }

  function fmtDate(dateStr){
    const d=new Date(dateStr+"T12:00:00");
    return d.toLocaleDateString("it-IT",{weekday:"long",day:"numeric",month:"long"});
  }
  function fmtDateShort(dateStr){
    const d=new Date(dateStr+"T12:00:00");
    return d.toLocaleDateString("it-IT",{weekday:"short",day:"numeric",month:"short"});
  }

  function scoreColor(v){if(v===null||v===undefined)return"rgba(255,255,255,0.2)";if(v>=80)return"#1EC96A";if(v>=50)return"#E09818";return"#3360EE";}

  // ── VISTA DETTAGLIO ──
  if(selDate&&draft){
    const histBlocks=schedDayToBlocks(draft.sched);
    const isRest=draft.sched.type==="rest";
    const isPaused=window.__trackingHelpers?window.__trackingHelpers.isPaused(selDate):false;

    function setMealStar(meal,val){
      setDraft(p=>({...p,mstars:{...p.mstars,[meal]:val}}));
    }
    function toggleMealSkip(meal){
      setDraft(p=>{const n=new Set(p.skippedMeals);n.has(meal)?n.delete(meal):n.add(meal);return{...p,skippedMeals:n};});
    }
    function toggleExItem(name){
      setDraft(p=>({...p,exDone:{...p.exDone,[name]:!p.exDone[name]},skDone:{...p.skDone,[name]:!p.skDone[name]}}));
    }
    function toggleExSkip(name){
      setDraft(p=>{const n=new Set(p.skippedEx);n.has(name)?n.delete(name):n.add(name);return{...p,skippedEx:n};});
    }
    function toggleTaskDone(id){
      setDraft(p=>({...p,tDone:{...p.tDone,[id]:!p.tDone[id]}}));
    }
    function toggleTaskSkip(id){
      setDraft(p=>{const n=new Set(p.skippedTasks);n.has(String(id))?n.delete(String(id)):n.add(String(id));return{...p,skippedTasks:n};});
    }

    return(
      <div>
        <button onClick={()=>{setSelDate(null);setDraft(null);}} style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:9,color:"rgba(255,255,255,0.5)",fontSize:12,padding:"6px 12px",cursor:"pointer",marginBottom:14}}>← Indietro</button>
        <div style={{fontSize:14,fontWeight:700,color:"rgba(255,255,255,0.92)",marginBottom:4,textTransform:"capitalize"}}>{fmtDate(selDate)}</div>
        <div style={{fontSize:11,color:"rgba(10,132,255,0.7)",fontWeight:600,marginBottom:14}}>{draft.sched.icon||"💪"} {draft.sched.label||""}</div>

        {isPaused&&(
          <div style={{padding:"10px 12px",borderRadius:11,background:"rgba(120,120,140,0.1)",border:"1px solid rgba(120,120,140,0.3)",color:"rgba(255,255,255,0.65)",fontSize:12,marginBottom:14,textAlign:"center"}}>
            ⏸ Giorno in pausa — le modifiche non influenzano le statistiche
          </div>
        )}

        {/* ── CIBO per pasto ────────────────────── */}
        <div style={{marginBottom:18}}>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",fontWeight:700,letterSpacing:.5,marginBottom:9}}>🍽️ CIBO (stelle per ogni pasto)</div>
          {MEALS_LIST.map((meal,mi)=>{
            const isSkip=draft.skippedMeals.has(meal);
            const star=draft.mstars[meal]||0;
            return(
              <div key={meal} style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:"9px 11px",marginBottom:6,opacity:isSkip?0.5:1}}>
                <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:isSkip?0:7}}>
                  <span style={{fontSize:16}}>{MEAL_ICONS_LIST[mi]}</span>
                  <span style={{flex:1,fontSize:13,fontWeight:600,color:"rgba(255,255,255,0.82)",textDecoration:isSkip?"line-through":"none"}}>{meal}</span>
                  <button onClick={()=>toggleMealSkip(meal)} style={{background:isSkip?"rgba(255,204,0,0.15)":"rgba(255,255,255,0.04)",border:"1px solid "+(isSkip?"rgba(255,204,0,0.35)":"rgba(255,255,255,0.07)"),borderRadius:7,color:isSkip?"#E09818":"rgba(255,255,255,0.3)",fontSize:10,fontWeight:700,padding:"4px 8px",cursor:"pointer"}}>{isSkip?"⚡ SKIP":"⚡"}</button>
                </div>
                {!isSkip&&(
                  <div style={{display:"flex",gap:4}}>
                    {[1,2,3,4,5].map(s=>(
                      <button key={s} onClick={()=>setMealStar(meal,star===s?0:s)} style={{flex:1,padding:"7px 0",borderRadius:7,border:"1px solid "+(s<=star?"rgba(255,204,0,0.4)":"rgba(255,255,255,0.06)"),background:s<=star?"rgba(255,204,0,0.13)":"rgba(255,255,255,0.02)",fontSize:14,color:s<=star?"#E09818":"rgba(255,255,255,0.2)",cursor:"pointer"}}>★</button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── ALLENAMENTO per blocco ────────────────────── */}
        <div style={{marginBottom:18}}>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",fontWeight:700,letterSpacing:.5,marginBottom:9}}>💪 ALLENAMENTO</div>
          {isRest&&<div style={{padding:"10px 14px",borderRadius:10,border:"1px solid rgba(255,255,255,0.06)",background:"rgba(255,255,255,0.02)",color:"rgba(255,255,255,0.3)",fontSize:12,textAlign:"center"}}>😴 Riposo — non conta nella media</div>}
          {!isRest&&histBlocks.length===0&&(
            <div style={{padding:"10px 12px",borderRadius:10,background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.05)",color:"rgba(255,255,255,0.35)",fontSize:12,textAlign:"center"}}>Nessun esercizio per questo giorno</div>
          )}
          {!isRest&&histBlocks.map((block,bi)=>(
            <div key={block.id||bi} style={{marginBottom:8}}>
              <div style={{fontSize:9,color:"rgba(10,132,255,0.7)",fontWeight:600,marginBottom:5,letterSpacing:.4}}>{block.icon||"💪"} {(block.title||"BLOCCO "+(bi+1)).toUpperCase()}</div>
              {(block.items||[]).map((it,ii)=>{
                const isSkip=draft.skippedEx.has(it.name);
                const done=!!(draft.exDone[it.name]||draft.skDone[it.name]);
                return(
                  <div key={ii} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:9,marginBottom:4,opacity:isSkip?0.5:1}}>
                    {!isSkip&&<button onClick={()=>toggleExItem(it.name)} className={"ck "+(done?"done":"")} style={{width:22,height:22,fontSize:11}}>{done?"✓":""}</button>}
                    {isSkip&&<div style={{width:22,height:22,borderRadius:6,background:"rgba(255,204,0,0.1)",border:"1px solid rgba(255,204,0,0.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10}}>⚡</div>}
                    <span style={{fontSize:14}}>{it.icon||block.icon||"💪"}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:600,color:isSkip?"rgba(255,204,0,0.5)":done?"#0A84FF":"rgba(255,255,255,0.78)",textDecoration:done||isSkip?"line-through":"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{it.name||"(senza nome)"}</div>
                      {it.sets&&<div style={{fontSize:10,color:"rgba(255,255,255,0.3)"}}>{it.sets}</div>}
                    </div>
                    <button onClick={()=>toggleExSkip(it.name)} style={{background:isSkip?"rgba(255,204,0,0.12)":"rgba(255,255,255,0.04)",border:"1px solid "+(isSkip?"rgba(255,204,0,0.3)":"rgba(255,255,255,0.07)"),borderRadius:6,color:isSkip?"#E09818":"rgba(255,255,255,0.25)",fontSize:10,fontWeight:700,padding:"3px 6px",cursor:"pointer"}}>⚡</button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* ── TASK per task ────────────────────── */}
        <div style={{marginBottom:18}}>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",fontWeight:700,letterSpacing:.5,marginBottom:9}}>✓ TASK</div>
          {draft.dayTasks.length===0&&(
            <div style={{padding:"10px 12px",borderRadius:10,background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.05)",color:"rgba(255,255,255,0.35)",fontSize:12,textAlign:"center"}}>Nessuna task per questo giorno</div>
          )}
          {draft.dayTasks.map(t=>{
            const isSkip=draft.skippedTasks.has(String(t.id));
            const done=!!draft.tDone[t.id];
            return(
              <div key={t.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:9,marginBottom:4,opacity:isSkip?0.5:1}}>
                {!isSkip&&<button onClick={()=>toggleTaskDone(t.id)} className={"ck dg "+(done?"done":"")} style={{width:22,height:22,fontSize:11}}>{done?"✓":""}</button>}
                {isSkip&&<div style={{width:22,height:22,borderRadius:6,background:"rgba(255,204,0,0.1)",border:"1px solid rgba(255,204,0,0.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10}}>⚡</div>}
                <span style={{flex:1,fontSize:12,fontWeight:500,color:isSkip?"rgba(255,204,0,0.5)":done?"rgba(255,255,255,0.3)":"rgba(255,255,255,0.78)",textDecoration:done||isSkip?"line-through":"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.text}</span>
                <button onClick={()=>toggleTaskSkip(t.id)} style={{background:isSkip?"rgba(255,204,0,0.12)":"rgba(255,255,255,0.04)",border:"1px solid "+(isSkip?"rgba(255,204,0,0.3)":"rgba(255,255,255,0.07)"),borderRadius:6,color:isSkip?"#E09818":"rgba(255,255,255,0.25)",fontSize:10,fontWeight:700,padding:"3px 6px",cursor:"pointer"}}>⚡</button>
              </div>
            );
          })}
        </div>

        <button onClick={saveDay} className="btn-p" style={{width:"100%",padding:"13px",fontSize:14,fontWeight:700}}>SALVA GIORNO ✓</button>
      </div>
    );
  }

  // ── LISTA GIORNI ──
  return(
    <div>
      <div style={{fontSize:11,color:"rgba(255,255,255,0.45)",marginBottom:12,lineHeight:1.55}}>Tocca un giorno per modificare nel dettaglio: stelle per ogni pasto, ogni esercizio completato/skippato, ogni task.</div>
      {days.map(date=>{
        const log=dailyLogs[date];
        const hasData=log&&(log.foodStars>0||log.trainingDone||log.taskPct>0);
        const paused=window.__trackingHelpers?window.__trackingHelpers.isPaused(date):false;
        const foodPct=log?Math.round(((log.foodStars||0)/5)*100):null;
        const trainOk=log?.trainingDone;
        const taskP=log?.taskPct||null;
        const _dow=(new Date(date+"T12:00:00").getDay()+6)%7;
        const _cs2=(()=>{try{const d=localStorage.getItem('enea_custom_schedule');return d?JSON.parse(d):null;}catch{return null;}})();
        const _sd=(_cs2&&_cs2[_dow])||SCHEDULE[_dow]||{};
        return(
          <button key={date} onClick={()=>openDay(date)} style={{width:"100%",background:paused?"rgba(120,120,140,0.04)":"rgba(255,255,255,0.03)",border:"1px solid "+(paused?"rgba(120,120,140,0.18)":"rgba(255,255,255,0.07)"),borderRadius:11,padding:"11px 13px",display:"flex",alignItems:"center",gap:10,cursor:"pointer",marginBottom:6,textAlign:"left",opacity:paused?0.7:1}}>
            <div style={{width:36,height:36,borderRadius:9,background:paused?"rgba(120,120,140,0.08)":"rgba(10,132,255,0.08)",border:"1px solid "+(paused?"rgba(120,120,140,0.18)":"rgba(10,132,255,0.15)"),display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{paused?"⏸":(_sd.icon||"💪")}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:600,color:"rgba(255,255,255,0.8)",textTransform:"capitalize"}}>{fmtDateShort(date)}</div>
              {paused?<div style={{fontSize:10,color:"rgba(160,160,180,0.7)",marginTop:1,fontWeight:600}}>In pausa</div>:_sd.label?<div style={{fontSize:10,color:"rgba(10,132,255,0.7)",marginTop:1,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{_sd.label}</div>:null}
              {!paused&&!hasData&&<div style={{fontSize:11,color:"rgba(255,255,255,0.2)",marginTop:1}}>Nessun dato</div>}
            </div>
            {!paused&&hasData&&<div style={{display:"flex",gap:6,alignItems:"center"}}>
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.25)"}}>🍽️</div>
                <div style={{fontSize:11,fontWeight:700,color:scoreColor(foodPct)}}>{foodPct}%</div>
              </div>
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.25)"}}>💪</div>
                <div style={{fontSize:11,fontWeight:700,color:trainOk?"#1EC96A":"#3360EE"}}>{trainOk?"✓":"✕"}</div>
              </div>
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.25)"}}>✓</div>
                <div style={{fontSize:11,fontWeight:700,color:scoreColor(taskP)}}>{taskP}%</div>
              </div>
            </div>}
            <span style={{color:"rgba(255,255,255,0.2)",fontSize:13}}>›</span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Emoji picker per icone (fix v22 #4) ────────────────────────── */
