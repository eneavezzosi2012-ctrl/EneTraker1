function HomeTab({profile,setProfile,
  dailyLogs,td,wd,dow,sched,completedDays,trainingDone,compTasks,todayTasks,taskDone,
  water,weekComp,streak,bmi,foodStars,taskPct,compEx,compSk,total,skippedEx,skippedMeals,skippedTasks2,exercises,skills,calEvents,notes,setNotes,customSchedule}){
  const [editP,setEditP]=useState(false);
  const [draft,setDraft]=useState(profile);
  const [homeView,setHomeView]=useState("general"); // "general" | "stats"
  const quote=QUOTES[new Date().getDate()%QUOTES.length];

  function saveProfile(){setProfile(draft);setEditP(false);}

  const [periodType,setPeriodType]=useState(0);
  const [periodOffset,setPeriodOffset]=useState(0);

  function getPeriodDates(){
    const now=new Date();
    // yd = ieri: settimana/mese/sempre contano solo giorni già trascorsi (non oggi)
    const yd=localDateStr(new Date(now.getFullYear(),now.getMonth(),now.getDate()-1));
    // Filtro tracking: esclude giorni prima di startDate e giorni in pausa
    const trackFilter=d=>(window.__trackingHelpers?window.__trackingHelpers.dayCountsForStats(d):true);
    if(periodType===0){
      const d=new Date(now);d.setDate(d.getDate()-periodOffset);
      return{dates:[localDateStr(d)],label:periodOffset===0?"Oggi":periodOffset===1?"Ieri":d.toLocaleDateString("it-IT",{day:"numeric",month:"short"})};
    }
    if(periodType===1){
      const mon=new Date(now);mon.setDate(now.getDate()-((now.getDay()+6)%7)-periodOffset*7);
      // Settimana corrente: solo giorni <= ieri; settimane passate: tutti e 7
      const cutoff=periodOffset===0?yd:null;
      const dates=Array.from({length:7},(_,i)=>{const x=new Date(mon);x.setDate(mon.getDate()+i);return localDateStr(x);}).filter(d=>(cutoff===null||d<=cutoff)&&trackFilter(d));
      const label=periodOffset===0?("Questa settimana · "+dates.length+"/7 giorni"):periodOffset===1?"Settimana scorsa":periodOffset+" settimane fa";
      return{dates,label};
    }
    if(periodType===2){
      const y=now.getFullYear();const m=now.getMonth()-periodOffset;const date=new Date(y,m,1);const yr=date.getFullYear();const mo=date.getMonth();const days=new Date(yr,mo+1,0).getDate();
      // Mese corrente: taglia a ieri; mesi passati: tutto il mese
      const cutoff=periodOffset===0?yd:localDateStr(new Date(yr,mo+1,0));
      const dates=Array.from({length:days},(_,i)=>`${yr}-${String(mo+1).padStart(2,"0")}-${String(i+1).padStart(2,"0")}`).filter(d=>d<=cutoff&&trackFilter(d));
      const label=date.toLocaleDateString("it-IT",{month:"long",year:"numeric"});return{dates,label:label.charAt(0).toUpperCase()+label.slice(1)};
    }
    return{dates:Object.keys(dailyLogs).filter(k=>k<=yd&&trackFilter(k)),label:"Da sempre"};
  }

  const {dates:periodDates,label:periodLabel}=getPeriodDates();
  const isToday=periodType===0&&periodOffset===0;
  const canGoBack=periodType!==3;
  const canGoForward=periodOffset>0&&periodType!==3;

  // Memoizzato: evita di rifare filter/reduce + load() ad ogni render
  const stats=React.useMemo(()=>{
    const valid=periodDates.filter(d=>dailyLogs[d]);
    if(!valid.length)return{food:null,training:null,task:null,count:0};
    const foodDays=valid.filter(d=>{const sm=(dailyLogs[d].skippedMeals||[]);return sm.length<5;});
    // Usa il piano personalizzato se disponibile, altrimenti fallback a SCHEDULE
    const activeSched=(customSchedule&&typeof customSchedule==="object")?customSchedule:SCHEDULE;
    const trainDays=valid.filter(d=>{
      const dow2=(new Date(d+"T12:00:00").getDay()+6)%7;
      const s2=activeSched[dow2]||SCHEDULE[dow2]||{exercises:[],skills:[],type:""};
      if(s2.type==="rest")return false;
      const se=(dailyLogs[d].skippedEx||[]);
      const tot=flatBlockItems(schedDayToBlocks(s2)).length;
      if(tot===0)return true;
      return se.length<tot;
    });
    const fs=foodDays.reduce((a,d)=>{
      const sm=new Set(dailyLogs[d].skippedMeals||[]);
      const vm=["Colazione","Spuntino","Pranzo","Merenda","Cena"].filter(m=>!sm.has(m));
      const ms=load("mstars_"+d,{});const r=vm.filter(m=>ms[m]>0);
      if(!r.length)return a;
      return[a[0]+((r.reduce((s,m)=>s+(ms[m]||0),0)/r.length-1)/4),a[1]+1];
    },[0,0]);
    const tr=trainDays.filter(d=>dailyLogs[d].trainingDone).length;
    const ta=valid.reduce((a,d)=>a+(dailyLogs[d].taskPct||0),0);
    return{food:fs[1]>0?fs[0]/fs[1]:null,training:trainDays.length>0?tr/trainDays.length:null,task:valid.length>0?(ta/valid.length)/100:null,count:valid.length};
  },[periodDates,dailyLogs]);
  const allMealsSkipped=isToday&&skippedMeals.size>=5;
  const foodPct=(()=>{
    if(allMealsSkipped)return null;
    if(isToday){const r=Object.values(load("mstars_"+td,{})).filter(v=>v>0);if(!r.length)return null;return(r.reduce((a,b)=>a+b,0)/r.length/5)*100;}
    return stats.food!==null?stats.food*100:null;
  })();
  const allItemsH=flatBlockItems(schedDayToBlocks(sched));
  const exTotal=allItemsH.length;
  const nonSkippedExTotal=allItemsH.filter(it=>!skippedEx.has(it.name)).length;
  const nonSkippedDone=allItemsH.filter(it=>(exercises[it.name]||skills[it.name])&&!skippedEx.has(it.name)).length;
  const trainPct=isToday?(nonSkippedExTotal>0?(nonSkippedDone/nonSkippedExTotal)*100:(trainingDone?100:null)):stats.training!==null?stats.training*100:null;
  const nonSkippedTasksDone=todayTasks.filter(t=>taskDone[t.id]&&!skippedTasks2.has(String(t.id))).length;
  const nonSkippedTasksTotal=todayTasks.filter(t=>!skippedTasks2.has(String(t.id))).length;
  const taskStatPct=isToday?(nonSkippedTasksTotal>0?(nonSkippedTasksDone/nonSkippedTasksTotal)*100:null):stats.task!==null?stats.task*100:null;
  const oParts=[foodPct,trainPct,taskStatPct].filter(x=>x!==null);
  const overallPct=oParts.length>0?oParts.reduce((a,b)=>a+b,0)/oParts.length:null;
  const PTYPES=["Giorno","Settimana","Mese","Sempre"];
  // Grafico 14 giorni: gestisce pausa (giorno paused), skip parziali (= fatto), skip totale (= fatto), e fallback su completedDays
  const last14=Array.from({length:14},(_,i)=>{
    const d=new Date();d.setDate(d.getDate()-(13-i));
    const ds=localDateStr(d);
    const paused=window.__trackingHelpers?window.__trackingHelpers.isPaused(ds):false;
    if(paused)return{date:ds,done:false,paused:true};
    // Considera "fatto" se trainingDone, oppure se ha skippato esercizi (skip parziale + non-skip fatti, o skip totale = OK)
    let done=!!completedDays[ds];
    if(!done&&dailyLogs[ds]){
      const log=dailyLogs[ds];
      if(log.trainingDone)done=true;
      else if(Array.isArray(log.skippedEx)&&log.skippedEx.length>0){
        // Ha skippato qualcosa: se ha completato tutti i non-skippati conta come fatto.
        // Versione semplice: se ci sono skip, il giorno conta come fatto (motivo specifico).
        done=true;
      }
    }
    return{date:ds,done,paused:false};
  });

  return(<>
    {/* ── SWITCHER GENERALE / STATISTICHE ──────────────────── */}
    <div style={{display:"flex",gap:6,marginBottom:11,padding:3,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:13}}>
      <button onClick={()=>{if(homeView!=="general"){haptic.light();setHomeView("general");}}}
        style={{flex:1,padding:"8px 10px",borderRadius:10,border:"none",background:homeView==="general"?"#0A84FF":"transparent",color:homeView==="general"?"#000":"rgba(255,255,255,0.55)",fontSize:12,fontWeight:700,cursor:"pointer",letterSpacing:.3,transition:"all .2s var(--ios)"}}>
        Generale
      </button>
      <button onClick={()=>{if(homeView!=="stats"){haptic.light();setHomeView("stats");}}}
        style={{flex:1,padding:"8px 10px",borderRadius:10,border:"none",background:homeView==="stats"?"#0A84FF":"transparent",color:homeView==="stats"?"#000":"rgba(255,255,255,0.55)",fontSize:12,fontWeight:700,cursor:"pointer",letterSpacing:.3,transition:"all .2s var(--ios)"}}>
        Statistiche
      </button>
    </div>

    {homeView==="stats"?(
      <>
        <StatsAndamento dailyLogs={dailyLogs} td={td}/>
        <StatsWeekCompare dailyLogs={dailyLogs} td={td}/>
        <StatsRecords/>
        <StatsPartite/>
      </>
    ):(<>

    {/* ── PROFILO ─────────────────────────────────────────── */}
    <div className="card co" style={{background:"linear-gradient(135deg,rgba(10,132,255,0.07),rgba(8,9,16,0.95))"}}>
      {!editP?(
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:50,height:50,borderRadius:13,background:"linear-gradient(135deg,rgba(10,132,255,0.2),rgba(10,132,255,0.05))",border:"1.5px solid rgba(10,132,255,0.25)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>
            {profile.name?profile.name[0].toUpperCase():"?"}
          </div>
          <div style={{flex:1}}>
            <div className="H" style={{fontSize:20,letterSpacing:.5}}>{profile.name||"—"}</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.38)",marginTop:2}}>
              {profile.weight>0?profile.weight+"kg":""}{profile.weight>0&&profile.height>0?" · ":""}{profile.height>0?profile.height+"cm":""}
              {bmi!=="—"?<span style={{marginLeft:6,background:"rgba(10,132,255,0.12)",border:"1px solid rgba(10,132,255,0.2)",borderRadius:6,padding:"1px 6px",fontSize:11,color:"#0A84FF",fontWeight:600}}>BMI {bmi}</span>:null}
            </div>
            <div style={{marginTop:6}}>
              <span className="pill pb" style={{fontFamily:"'JetBrains Mono'",letterSpacing:.2}}>🔥 {streak}d streak</span>
            </div>
          </div>
          <button className="btn-s" onClick={()=>{setDraft({...profile});setEditP(true);}} style={{fontSize:12,padding:"5px 10px",flexShrink:0}}>✏️</button>
        </div>
      ):(
        <div>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.28)",fontWeight:600,letterSpacing:.8,marginBottom:11}}>AGGIORNA PROFILO</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9,marginBottom:12}}>
            {[{l:"Nome",k:"name",t:"text"},{l:"Peso (kg)",k:"weight",t:"number"},{l:"Altezza (cm)",k:"height",t:"number"}].map(f=>(
              <div key={f.k} style={f.k==="name"?{gridColumn:"1/-1"}:{}}>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.28)",marginBottom:4}}>{f.l}</div>
                <input type={f.t} className="inp" value={draft[f.k]} onChange={e=>setDraft(p=>({...p,[f.k]:f.t==="number"?parseFloat(e.target.value)||0:e.target.value}))}/>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:8}}>
            <button className="btn-p" onClick={saveProfile} style={{flex:1}}>SALVA</button>
            <button className="btn-s" onClick={()=>setEditP(false)} style={{flex:1}}>Annulla</button>
          </div>
        </div>
      )}
    </div>

    {/* ── STATS DONUTS ────────────────────────────────────── */}
    <div className="card">
      <div style={{marginBottom:14}}>
        <div style={{display:"flex",gap:5,marginBottom:10}}>
          {PTYPES.map((lbl,i)=>(
            <button key={i} onClick={()=>{setPeriodType(i);setPeriodOffset(0);}}
              style={{flex:1,padding:"7px 0",borderRadius:9,border:"1px solid "+(periodType===i?"rgba(10,132,255,0.35)":"rgba(255,255,255,0.08)"),background:periodType===i?"rgba(10,132,255,0.13)":"rgba(255,255,255,0.04)",color:periodType===i?"#0A84FF":"rgba(255,255,255,0.35)",fontSize:11,fontWeight:700,cursor:"pointer",letterSpacing:.2}}>
              {lbl}
            </button>
          ))}
        </div>
        {periodType!==3&&(
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <button className="arr" onClick={()=>setPeriodOffset(o=>o+1)} disabled={!canGoBack}>&#8249;</button>
            <div style={{textAlign:"center",flex:1}}>
              <div style={{fontSize:12,fontWeight:600,color:periodOffset===0?"#0A84FF":"rgba(255,255,255,0.55)",letterSpacing:.2}}>{periodLabel}</div>
            </div>
            <button className="arr" onClick={()=>setPeriodOffset(o=>Math.max(0,o-1))} disabled={!canGoForward}>&#8250;</button>
          </div>
        )}
      </div>
      <div style={{display:"flex",justifyContent:"space-around",alignItems:"flex-start",marginBottom:16}}>
        <Donut pct={foodPct||0} color={scoreToColor(foodPct!==null?foodPct/100:null)} size={84} stroke={7} label="Cibo" sublabel={isToday?(foodStars>0?"★".repeat(Math.min(Math.round(foodStars),5)):"-"):foodScoreLabel(stats.food)}>
          {foodPct===null?<span style={{fontSize:17,color:"rgba(255,255,255,0.1)"}}>-</span>:<span style={{fontFamily:"'DM Sans'",fontSize:12,fontWeight:700,color:scoreToColor(foodPct/100),lineHeight:1}}>{foodPct.toFixed(1)}%</span>}
        </Donut>
        <Donut pct={trainPct||0} color={scoreToColor(trainPct!==null?trainPct/100:null)} size={84} stroke={7} label="Training" sublabel={isToday?(compEx+compSk)+"/"+exTotal:stats.training!==null?Math.round(stats.training*100)+"%":"-"}>
          {trainPct===null?<span style={{fontSize:17,color:"rgba(255,255,255,0.1)"}}>-</span>:<span style={{fontFamily:"'DM Sans'",fontSize:12,fontWeight:700,color:scoreToColor(trainPct/100),lineHeight:1}}>{trainPct.toFixed(1)}%</span>}
        </Donut>
        <Donut pct={taskStatPct||0} color={scoreToColor(taskStatPct!==null?taskStatPct/100:null)} size={84} stroke={7} label="Task" sublabel={isToday?compTasks+"/"+todayTasks.length:stats.task!==null?Math.round(stats.task*100)+"%":"-"}>
          {taskStatPct===null?<span style={{fontSize:17,color:"rgba(255,255,255,0.1)"}}>-</span>:<span style={{fontFamily:"'DM Sans'",fontSize:12,fontWeight:700,color:scoreToColor(taskStatPct/100),lineHeight:1}}>{taskStatPct.toFixed(1)}%</span>}
        </Donut>
      </div>
      <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:13,padding:"13px 15px",display:"flex",alignItems:"center",gap:14}}>
        <div style={{textAlign:"center",flexShrink:0}}>
          <div className="H bignum" style={{fontSize:56,lineHeight:1,color:overallPct!==null?scoreToColor(overallPct/100):"rgba(255,255,255,0.1)"}}>{overallPct!==null?(overallPct/10).toFixed(1):"—"}</div>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.2)",marginTop:1}}>/10</div>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:12,fontWeight:600,color:"rgba(255,255,255,0.58)",marginBottom:5}}>{isToday?"Voto di oggi":"Media · "+periodLabel}</div>
          {overallPct!==null&&<>
            <div className="pbar" style={{height:5}}><div className="pf" style={{width:overallPct+"%",background:scoreToColor(overallPct/100)}}/></div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.22)",marginTop:4}}>{overallPct>=80?"Ottimo 🔥":overallPct>=60?"Bene 💪":"Puoi fare di più ⚡"}</div>
          </>}
        </div>
      </div>
    </div>

    {/* ── ULTIMI 14 GIORNI ─────────────────────────────────── */}
    <div className="card">
      <div style={{fontSize:10,color:"rgba(255,255,255,0.22)",fontWeight:600,letterSpacing:.5,marginBottom:7}}>ULTIMI 14 GIORNI</div>
      <div style={{display:"flex",gap:3}}>
        {last14.map((d,i)=>{
          const bg=d.paused?"rgba(120,120,140,0.18)":d.done?"rgba(10,132,255,0.75)":"rgba(255,255,255,0.05)";
          const bd=d.paused?"rgba(120,120,140,0.32)":d.done?"rgba(10,132,255,0.35)":"rgba(255,255,255,0.04)";
          return<div key={i} title={d.paused?"In pausa":d.done?"Completato":"Non completato"} style={{flex:1,height:26,borderRadius:5,background:bg,border:"1px solid "+bd,transition:"background .3s",backgroundImage:d.paused?"repeating-linear-gradient(45deg,transparent,transparent 3px,rgba(255,255,255,0.04) 3px,rgba(255,255,255,0.04) 6px)":"none"}}/>;
        })}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",marginTop:5}}>
        <span style={{fontSize:9,color:"rgba(255,255,255,0.15)"}}>14gg fa</span>
        <span style={{fontSize:9,color:"rgba(255,255,255,0.15)"}}>oggi</span>
      </div>
    </div>

    <NoteCard notes={notes} setNotes={setNotes}/>

    {(()=>{
      // Priorità: partite importate da PDF FIP; fallback al default storico
      const importedMatches=load("fip_matches",null);
      let allMatches;
      if(Array.isArray(importedMatches)&&importedMatches.length>0){
        allMatches=importedMatches.map(p=>({
          date:p.date,
          time:p.ora||"",
          opponent:p.avversario||"?",
          location:p.luogo?(p.luogo+(p.indirizzo?", "+p.indirizzo:"")):(p.indirizzo||""),
          home:!!p.casa,
        }));
      } else {
        allMatches=[];
      }
      // Modalità FIP nuova (import PDF): mostra tutte le partite future
      // Modalità legacy: filtra in base agli eventi fip_ in calEvents
      let visibleMatches;
      if(Array.isArray(importedMatches)&&importedMatches.length>0){
        visibleMatches=allMatches;
      } else {
        const calEventDates=new Set((calEvents||[]).filter(e=>typeof e.id==="string"&&e.id.startsWith("fip_")).map(e=>e.date));
        visibleMatches=allMatches.filter(m=>calEventDates.has(m.date));
      }
      const todayMatch=visibleMatches.some(m=>m.date===td);
      const upcomingMatches=visibleMatches.filter(m=>m.date>=td).slice(0,todayMatch?1:2);
      if(!upcomingMatches.length)return null;
      return(
        <div className="card" style={{background:"linear-gradient(135deg,rgba(10,132,255,0.08),rgba(0,0,0,0.98))",border:"1px solid rgba(10,132,255,0.25)",marginBottom:11}}>
          <div style={{fontSize:10,color:"#0A84FF",fontWeight:700,letterSpacing:.7,marginBottom:10}}>🏀 PROSSIME PARTITE</div>
          {upcomingMatches.map(m=>{
            const isToday2=m.date===td;
            const daysUntil=Math.ceil((new Date(m.date+"T12:00:00")-new Date())/864e5);
            const when=isToday2?"OGGI":daysUntil===1?"Domani":new Date(m.date+"T12:00:00").toLocaleDateString("it-IT",{weekday:"short",day:"numeric",month:"short"});
            return(
              <div key={m.date} style={{display:"flex",alignItems:"center",gap:11,marginBottom:upcomingMatches.indexOf(m)<upcomingMatches.length-1?10:0}}>
                <div style={{width:42,height:42,borderRadius:11,background:isToday2?"rgba(10,132,255,0.2)":"rgba(10,132,255,0.1)",border:"1px solid rgba(10,132,255,0.3)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <div style={{fontSize:isToday2?9:8,fontWeight:700,color:"#0A84FF",letterSpacing:.2}}>{isToday2?"OGGI":when.split(" ")[0].toUpperCase()}</div>
                  {!isToday2&&<div style={{fontSize:13,fontWeight:700,color:"#fff",lineHeight:1}}>{when.split(" ")[1]}</div>}
                  {isToday2&&<div style={{fontSize:16}}>🏆</div>}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,0.88)",marginBottom:2}}>{m.home?"🏠":"✈️"} vs {m.opponent}</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.35)"}}>{m.time} · {m.location}</div>
                </div>
              </div>
            );
          })}
        </div>
      );
    })()}
    <div className="card" style={{background:"rgba(255,255,255,0.02)",borderColor:"rgba(255,255,255,0.045)"}}>
      <div style={{fontSize:10,color:"rgba(255,255,255,0.2)",fontWeight:600,letterSpacing:.8,marginBottom:7}}>CITAZIONE DEL GIORNO</div>
      <div style={{fontSize:13,color:"rgba(255,255,255,0.58)",lineHeight:1.6,fontStyle:"italic",marginBottom:5}}>"{quote.text}"</div>
      <div style={{fontSize:11,color:"rgba(255,255,255,0.25)",fontWeight:500}}>— {quote.author}</div>
    </div>
    </>)}
  </>);
}

// ── Componenti Note ───────────────────────────────────────────────────────

// Rimuove tag HTML e decodifica entità (usato per le anteprime testo)
