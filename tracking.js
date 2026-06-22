function TrackingSection(){
  // Forza rerender quando lo stato cambia
  const [tick,setTick]=React.useState(0);
  const state=window.__trackingHelpers.getTrackingState();
  const {startDate,pausePeriods}=state;
  const paused=window.__trackingHelpers.isCurrentlyPaused();
  const [confirmReset,setConfirmReset]=React.useState(false);

  function refresh(){setTick(t=>t+1);}

  function fmtDate(d){
    if(!d)return "";
    return new Date(d+"T12:00:00").toLocaleDateString("it-IT",{day:"numeric",month:"long",year:"numeric"});
  }

  function doStart(){
    const td=todayStr();
    window.__trackingHelpers.setTrackingState({startDate:td,pausePeriods:[]});
    haptic.success();
    refresh();
  }

  function doPause(){
    const td=todayStr();
    const next={
      startDate:startDate||td,
      pausePeriods:[...pausePeriods.filter(p=>p.to!==null&&p.to!==undefined),{from:td,to:null}],
    };
    window.__trackingHelpers.setTrackingState(next);
    haptic.medium();
    refresh();
  }

  function doResume(){
    const td=todayStr();
    // Chiude tutti i periodi aperti con la data di ieri (oggi riprende a contare)
    const y=new Date();y.setDate(y.getDate()-1);
    const yd=localDateStr(y);
    const next={
      startDate,
      pausePeriods:pausePeriods.map(p=>(p.to===null||p.to===undefined)?{...p,to:yd}:p),
    };
    window.__trackingHelpers.setTrackingState(next);
    haptic.success();
    refresh();
  }

  async function doFullReset(){
    // Cancella SOLO i dati STATISTICI — preserva profilo, schede, piani pasto, task, goal, calendario, ecc.
    const keepPrefixes=new Set([
      "enea_current_user","enea_local_accounts","enea_data_version","enea_fip_seeded_v22",
      "enea_profile","enea_custom_schedule","enea_custom_meal_plan",
      "enea_tasks_v2","enea_stasks",
      "enea_cal_events",
      "enea_fip_team_name",
      "enea_records","enea_records_banner_dismissed",
    ]);
    const toRemove=[];
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i);
      if(k&&k.startsWith("enea_")&&!keepPrefixes.has(k))toRemove.push(k);
    }
    toRemove.forEach(k=>{try{localStorage.removeItem(k);}catch{}});

    // Reset tracking state a null (non avviato) → fa riapparire "Inizia Tracking"
    const newState={startDate:null,pausePeriods:[]};
    try{localStorage.setItem("enea_tracking_state",JSON.stringify(newState));}catch{}

    // Cancella le chiavi statistiche anche su Firestore
    const statFirestoreKeys=new Set([
      "dlogs","cdays","streak","tracking_state","game_stats","fip_matches","seasons_archive","current_season",
    ]);
    // Prefissi date-keyed da cancellare su Firestore
    const statPrefixes=["meals_","water_","ex_","sk_","tdone_","tdone2_","fstars_","skip_ex_","skip_meals_","skip_tasks_","mstars_"];

    try{
      const cu=localStorage.getItem("enea_current_user");
      if(cu&&window.__firestore&&window.__fbHelpers){
        const {doc,deleteDoc,collection,getDocs,setDoc}=window.__fbHelpers;
        const col=collection(window.__firestore,"users",cu,"data");
        const snap=await getDocs(col);
        const toDelete=snap.docs.filter(d=>{
          const id=d.id;
          if(statFirestoreKeys.has(id))return true;
          return statPrefixes.some(p=>id.startsWith(p));
        });
        await Promise.allSettled(toDelete.map(d=>deleteDoc(d.ref)));
        // Scrivi il nuovo tracking_state (null) su Firestore
        try{
          const ref=doc(window.__firestore,"users",cu,"data","tracking_state");
          await setDoc(ref,{value:newState,updatedAt:Date.now()});
        }catch{}
      }
    }catch{}

    haptic.success();
    setTimeout(()=>window.location.reload(),200);
  }

  const activePause=pausePeriods.find(p=>p.to===null||p.to===undefined);

  return(
    <div>
      <div style={{fontSize:11,color:"rgba(255,255,255,0.45)",marginBottom:14,lineHeight:1.55}}>
        Controlla quando l'app inizia a tracciare le statistiche, mettila in pausa quando non puoi allenarti, o resetta tutto da zero.
      </div>

      {/* Stato attuale */}
      <div style={{background:paused?"rgba(140,140,140,0.08)":startDate?"rgba(228,228,231,0.06)":"rgba(255,255,255,0.06)",border:"1px solid "+(paused?"rgba(140,140,140,0.25)":startDate?"rgba(228,228,231,0.22)":"rgba(255,255,255,0.22)"),borderRadius:12,padding:"12px 14px",marginBottom:14}}>
        <div style={{fontSize:10,fontWeight:700,letterSpacing:.6,color:paused?"#A1A1AA":startDate?"#E4E4E7":"#FFFFFF",marginBottom:5}}>STATO ATTUALE</div>
        {!startDate&&(
          <div style={{fontSize:13,color:"rgba(255,255,255,0.7)",fontWeight:500}}>○ Tracking non avviato — i dati vengono salvati ma non contano nelle medie e nei grafici</div>
        )}
        {startDate&&!paused&&(<>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.85)",fontWeight:600}}>✓ Tracking attivo</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.45)",marginTop:3}}>Iniziato il {fmtDate(startDate)}</div>
        </>)}
        {startDate&&paused&&activePause&&(<>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.85)",fontWeight:600}}>⏸ In pausa</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.45)",marginTop:3}}>Dal {fmtDate(activePause.from)}</div>
        </>)}
      </div>

      {/* Azioni */}
      {!startDate&&(
        <button onClick={doStart} className="btn-p" style={{width:"100%",padding:"14px",fontSize:14,fontWeight:700,marginBottom:8}}>▶ INIZIA TRACKING</button>
      )}

      {startDate&&!paused&&(
        <button onClick={doPause} style={{width:"100%",padding:"13px",borderRadius:11,border:"1px solid rgba(161,161,170,0.35)",background:"rgba(161,161,170,0.08)",color:"#A1A1AA",fontSize:13,fontWeight:700,cursor:"pointer",marginBottom:8,letterSpacing:.3}}>
          ⏸ METTI IN PAUSA
        </button>
      )}

      {startDate&&paused&&(
        <button onClick={doResume} className="btn-p" style={{width:"100%",padding:"14px",fontSize:14,fontWeight:700,marginBottom:8}}>
          ▶ RIPRENDI TRACKING
        </button>
      )}

      {/* Storico pause */}
      {pausePeriods.length>0&&(
        <div style={{marginTop:14,padding:"10px 12px",background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:11}}>
          <div style={{fontSize:10,fontWeight:600,letterSpacing:.5,color:"rgba(255,255,255,0.4)",marginBottom:7}}>STORICO PAUSE ({pausePeriods.length})</div>
          {pausePeriods.map((p,i)=>(
            <div key={i} style={{fontSize:11,color:"rgba(255,255,255,0.55)",marginBottom:3,fontWeight:500}}>
              • {fmtDate(p.from)} → {p.to?fmtDate(p.to):<span style={{color:"#A1A1AA",fontWeight:600}}>in corso</span>}
            </div>
          ))}
        </div>
      )}

      {/* Reset totale */}
      <div style={{marginTop:22,paddingTop:16,borderTop:"1px solid rgba(255,255,255,0.06)"}}>
        <div style={{fontSize:10,fontWeight:700,letterSpacing:.6,color:"#F5F5F5",marginBottom:6}}>⚠︎ ZONA PERICOLOSA</div>
        {!confirmReset?(
          <button onClick={()=>setConfirmReset(true)} style={{width:"100%",padding:"11px",borderRadius:10,border:"1px solid rgba(255,255,255,0.3)",background:"rgba(255,255,255,0.06)",color:"#F5F5F5",fontSize:12,fontWeight:700,cursor:"pointer",letterSpacing:.3,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
            <span className="icon-trash"></span>RESET TOTALE
          </button>
        ):(
          <div style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.35)",borderRadius:11,padding:12}}>
            <div style={{fontSize:13,color:"#F5F5F5",marginBottom:6,fontWeight:700}}>Sei sicuro?</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.55)",marginBottom:11,lineHeight:1.5}}>Cancella tutti i dati statistici: log giornalieri, medie, grafici, streak, partite e stagioni. Profilo, schede, piano pasti, task, note e calendario restano intatti. Non recuperabile.</div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setConfirmReset(false)} style={{flex:1,padding:"10px",borderRadius:9,border:"1px solid rgba(255,255,255,0.1)",background:"rgba(255,255,255,0.04)",color:"rgba(255,255,255,0.65)",fontSize:12,cursor:"pointer",fontWeight:600}}>Annulla</button>
              <button onClick={doFullReset} style={{flex:1,padding:"10px",borderRadius:9,border:"none",background:"#F5F5F5",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>Reset</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

