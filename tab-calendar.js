function CalendarTab({calEvents,setCalEvents}){
  const TODAY=new Date();
  const todayStr2=localDateStr(TODAY);
  const [viewDate,setViewDate]=React.useState(todayStr2);
  const [addModal,setAddModal]=React.useState(null);
  const [editEvt,setEditEvt]=React.useState(null);
  const [draftText,setDraftText]=React.useState("");
  const [draftHour,setDraftHour]=React.useState(8);
  const [draftDuration,setDraftDuration]=React.useState(1);
  const [draftRecur,setDraftRecur]=React.useState([]);
  const DAYS_IT=["Lun","Mar","Mer","Gio","Ven","Sab","Dom"];
  const DAYS_FULL=["Lunedì","Martedì","Mercoledì","Giovedì","Venerdì","Sabato","Domenica"];
  const MONTHS=["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];

  function parsedViewDate(){return new Date(viewDate+"T12:00:00");}
  function fmt(d){return localDateStr(d);}
  function getDow(dateStr){return(new Date(dateStr+"T12:00:00").getDay()+6)%7;}

  function prevDay(){const d=parsedViewDate();d.setDate(d.getDate()-1);setViewDate(fmt(d));}
  function nextDay(){const d=parsedViewDate();d.setDate(d.getDate()+1);setViewDate(fmt(d));}

  // Un evento è visibile su un dato giorno se:
  //   - è oneshot (recur=[]) e la data coincide
  //   - è ricorrente (recur=[0,2,4]) e il giorno della settimana è incluso
  function isEventOnDate(evt, dateStr){
    const dow=getDow(dateStr);
    if(!evt.recur||evt.recur.length===0){
      return evt.date===dateStr;
    }
    return evt.recur.includes(dow);
  }

  // Converte le partite FIP importate in eventi virtuali (sola lettura, non modificabili)
  function getFipEventsForDate(dateStr){
    const stored=load("fip_matches",null);
    if(!Array.isArray(stored)||!stored.length)return[];
    return stored.filter(p=>p.date===dateStr&&p.ora&&/^\d{1,2}:\d{2}$/.test(p.ora)).map(p=>{
      const[h]=p.ora.split(":").map(Number);
      return{
        id:"fip_auto_"+p.date+"_"+p.ora,
        text:"🏀 Partita vs "+p.avversario+(p.casa?" · 🏠 Casa":" · ✈️ Trasferta"),
        hour:h,
        duration:3, // warmup incluso
        isFipAuto:true,
        ora:p.ora,
        avversario:p.avversario,
        casa:p.casa,
      };
    });
  }

  function getEventsForDate(dateStr){
    const userEvts=calEvents.filter(e=>isEventOnDate(e,dateStr)).sort((a,b)=>a.hour-b.hour);
    const fipEvts=getFipEventsForDate(dateStr);
    // Rimuove i duplicati FIP se l'utente ha già inserito manualmente un evento partita alla stessa ora
    const fipFiltered=fipEvts.filter(fe=>!userEvts.some(ue=>ue.hour===fe.hour&&ue.text&&ue.text.toLowerCase().includes("partita")));
    return [...userEvts,...fipFiltered].sort((a,b)=>a.hour-b.hour);
  }

  // Restituisce gli eventi di un'ora: quelli che iniziano lì + quelli che "attraversano" quell'ora
  function getEventsForHour(dateStr,h){
    return getEventsForDate(dateStr).filter(e=>{
      const dur=e.duration||1;
      return h>=e.hour&&h<e.hour+dur;
    });
  }

  const eventsToday=getEventsForDate(viewDate);

  function openAdd(hour){
    setDraftText("");setDraftHour(hour);setDraftDuration(1);setDraftRecur([]);
    setAddModal({date:viewDate});
    setEditEvt(null);
  }

  function openEdit(evt){
    setDraftText(evt.text);
    setDraftHour(evt.hour);
    setDraftDuration(evt.duration||1);
    setDraftRecur(Array.isArray(evt.recur)?evt.recur:(evt.recur!=null&&evt.recur!==undefined?[evt.recur]:[]));
    setEditEvt(evt);
    setAddModal(null);
  }

  function toggleRecurDay(i){
    setDraftRecur(prev=>prev.includes(i)?prev.filter(x=>x!==i):[...prev,i].sort());
  }

  function saveEvent(){
    if(!draftText.trim())return;
    const isRecurring=draftRecur.length>0;
    const evtBase={text:draftText.trim(),hour:draftHour,duration:draftDuration||1};
    if(editEvt){
      setCalEvents(prev=>prev.map(e=>e.id===editEvt.id?{...e,...evtBase,recur:isRecurring?draftRecur:undefined,date:isRecurring?undefined:addModal?.date||e.date}:e));
      setEditEvt(null);
    } else {
      const newEvt={id:genId(),...evtBase,recur:isRecurring?draftRecur:undefined,date:isRecurring?undefined:addModal.date};
      setCalEvents(prev=>[...prev,newEvt]);
      setAddModal(null);
    }
    setDraftText("");setDraftHour(8);setDraftDuration(1);setDraftRecur([]);
  }

  function deleteEvent(id){setCalEvents(prev=>prev.filter(e=>e.id!==id));}

  const HOURS=Array.from({length:18},(_,i)=>i+6); // 6:00–23:00

  const isToday=viewDate===todayStr2;
  const vd=parsedViewDate();
  const vdow=getDow(viewDate);
  const dateLabel=(isToday?"Oggi — ":"")+DAYS_FULL[vdow]+" "+vd.getDate()+" "+MONTHS[vd.getMonth()];

  return(
    <div>
      {/* Header nav */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:13,padding:"9px 13px"}}>
        <button onClick={prevDay} style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:9,color:"rgba(255,255,255,0.5)",fontSize:16,padding:"5px 13px",cursor:"pointer"}}>‹</button>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,0.88)"}}>{dateLabel}</div>
          {!isToday&&<button onClick={()=>setViewDate(todayStr2)} style={{background:"none",border:"none",color:"#0A84FF",fontSize:10,cursor:"pointer",padding:"2px 0",fontWeight:600}}>Torna ad oggi</button>}
        </div>
        <button onClick={nextDay} style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:9,color:"rgba(255,255,255,0.5)",fontSize:16,padding:"5px 13px",cursor:"pointer"}}>›</button>
      </div>

      {/* Modal aggiunta/modifica */}
      {(addModal||editEvt)&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>{setAddModal(null);setEditEvt(null);}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#0A0A0A",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"18px 18px 0 0",padding:"20px 16px",width:"100%",maxWidth:430,maxHeight:"85vh",overflowY:"auto"}}>
            <div style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,0.8)",marginBottom:12}}>
              {editEvt?"✏️ Modifica evento":"+ Nuovo evento"}
            </div>
            <input autoFocus value={draftText} onChange={e=>setDraftText(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&saveEvent()}
              placeholder="Descrizione..." className="inp" style={{marginBottom:12}}/>

            {/* Ora di inizio + Durata */}
            <div style={{display:"flex",gap:8,marginBottom:12}}>
              <div style={{flex:1}}>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",fontWeight:600,marginBottom:5}}>ORA INIZIO</div>
                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  {[6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22].map(h=>(
                    <button key={h} onClick={()=>setDraftHour(h)} style={{padding:"4px 7px",borderRadius:7,fontSize:11,fontWeight:600,cursor:"pointer",border:"1px solid "+(draftHour===h?"rgba(10,132,255,0.5)":"rgba(255,255,255,0.08)"),background:draftHour===h?"rgba(10,132,255,0.15)":"rgba(255,255,255,0.03)",color:draftHour===h?"#0A84FF":"rgba(255,255,255,0.35)"}}>{h}:00</button>
                  ))}
                </div>
              </div>
              <div style={{flexShrink:0,minWidth:90}}>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",fontWeight:600,marginBottom:5}}>DURATA</div>
                <div style={{display:"flex",gap:3,flexDirection:"column"}}>
                  {[1,2,3,4,5,6].map(d=>(
                    <button key={d} onClick={()=>setDraftDuration(d)} style={{padding:"5px 10px",borderRadius:7,fontSize:11,fontWeight:600,cursor:"pointer",border:"1px solid "+(draftDuration===d?"rgba(0,200,120,0.4)":"rgba(255,255,255,0.08)"),background:draftDuration===d?"rgba(0,200,120,0.12)":"rgba(255,255,255,0.03)",color:draftDuration===d?"#1EC96A":"rgba(255,255,255,0.35)"}}>
                      {d} {d===1?"ora":"ore"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Ripetizione multi-giorno */}
            <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",fontWeight:600,letterSpacing:.5,marginBottom:8}}>RIPETI OGNI SETTIMANA (lascia vuoto per evento singolo)</div>
            <div style={{display:"flex",gap:5,marginBottom:14}}>
              {DAYS_IT.map((d,i)=>(
                <button key={i} onClick={()=>toggleRecurDay(i)} style={{flex:1,padding:"7px 0",borderRadius:8,fontSize:11,fontWeight:700,cursor:"pointer",border:"1px solid "+(draftRecur.includes(i)?"rgba(0,201,126,0.45)":"rgba(255,255,255,0.08)"),background:draftRecur.includes(i)?"rgba(0,201,126,0.15)":"rgba(255,255,255,0.03)",color:draftRecur.includes(i)?"#1EC96A":"rgba(255,255,255,0.3)"}}>{d}</button>
              ))}
            </div>
            {draftRecur.length>0&&(
              <div style={{fontSize:11,color:"#1EC96A",marginBottom:12,fontWeight:500}}>
                🔁 Ogni {draftRecur.map(i=>DAYS_FULL[i]).join(", ")}
              </div>
            )}

            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>{setAddModal(null);setEditEvt(null);}} style={{flex:1,padding:"11px",borderRadius:10,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.04)",color:"rgba(255,255,255,0.4)",fontSize:13,cursor:"pointer"}}>Annulla</button>
              {editEvt&&<button onClick={()=>{deleteEvent(editEvt.id);setEditEvt(null);}} style={{padding:"11px 14px",borderRadius:10,border:"1px solid rgba(10,132,255,0.2)",background:"rgba(10,132,255,0.08)",color:"#0A84FF",fontSize:13,cursor:"pointer"}}>✕</button>}
              <button onClick={saveEvent} style={{flex:2,padding:"11px",borderRadius:10,border:"none",background:"linear-gradient(135deg,#0A84FF,#0A84FF)",color:"#000",fontSize:13,fontWeight:700,cursor:"pointer"}}>SALVA ✓</button>
            </div>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,overflow:"hidden"}}>
        {HOURS.map(h=>{
          const hEvents=getEventsForHour(viewDate,h);
          const isCurrentHour=isToday&&new Date().getHours()===h;
          return(
            <div key={h} style={{display:"flex",minHeight:42,borderBottom:"1px solid rgba(255,255,255,0.035)",background:isCurrentHour?"rgba(10,132,255,0.04)":"transparent",position:"relative"}}>
              <div style={{width:42,flexShrink:0,padding:"0 8px",display:"flex",alignItems:"flex-start",paddingTop:6}}>
                <span style={{fontSize:11,fontWeight:isCurrentHour?700:400,color:isCurrentHour?"#0A84FF":"rgba(255,255,255,0.2)",fontVariantNumeric:"tabular-nums"}}>{h.toString().padStart(2,"0")}:00</span>
              </div>
              <div style={{flex:1,padding:"4px 6px 4px 0",display:"flex",flexDirection:"column",gap:3}}>
                {hEvents.map(evt=>{
                  const isStart=evt.hour===h;
                  const isRecur=Array.isArray(evt.recur)&&evt.recur.length>0;
                  const dur=evt.duration||1;
                  const isFip=evt.isFipAuto===true;
                  return(
                    <button key={evt.id+"_"+h} onClick={()=>isStart&&!isFip&&openEdit(evt)}
                      style={{textAlign:"left",background:!isStart?"rgba(255,255,255,0.02)":isFip?"rgba(10,132,255,0.10)":isRecur?"rgba(0,220,130,0.08)":"rgba(255,255,255,0.06)",border:"1px solid "+(!isStart?"rgba(255,255,255,0.04)":isFip?"rgba(10,132,255,0.35)":isRecur?"rgba(0,220,130,0.22)":"rgba(255,255,255,0.09)"),borderRadius:9,padding:"6px 10px",cursor:isStart&&!isFip?"pointer":"default",display:"flex",alignItems:"center",gap:7,width:"100%",opacity:!isStart?0.5:1}}>
                      {isStart&&isFip&&<span style={{fontSize:9,color:"#0A84FF",fontWeight:700,background:"rgba(10,132,255,0.18)",padding:"2px 6px",borderRadius:4,flexShrink:0}}>⏱ {dur}h</span>}
                      {isStart&&!isFip&&dur>1&&<span style={{fontSize:9,color:"#4db8ff",fontWeight:700,background:"rgba(0,140,255,0.15)",padding:"2px 6px",borderRadius:4,flexShrink:0}}>⏱ {dur}h</span>}
                      {isStart&&!isFip&&isRecur&&<span style={{fontSize:8,color:"#1EC96A",fontWeight:700,background:"rgba(0,220,130,0.15)",padding:"2px 5px",borderRadius:4,flexShrink:0}}>🔁</span>}
                      <div style={{flex:1,textAlign:"left"}}>
                        <div style={{fontSize:12,fontWeight:isStart?600:400,color:isFip?(isStart?"#0A84FF":"rgba(10,132,255,0.5)"):"rgba(255,255,255,0.6)"}}>{!isStart?"↕ "+evt.text:evt.text}</div>
                        {isStart&&isFip&&<div style={{fontSize:9,color:"rgba(10,132,255,0.6)",marginTop:1}}>📅 {evt.ora} · calendario FIP</div>}
                        {isStart&&!isFip&&isRecur&&<div style={{fontSize:9,color:"rgba(0,218,120,0.6)",marginTop:1}}>{evt.recur.map(i=>DAYS_IT[i]).join(" · ")}</div>}
                      </div>
                      {isStart&&!isFip&&<span style={{fontSize:10,color:"rgba(255,255,255,0.18)"}}>✏️</span>}
                    </button>
                  );
                })}
                <button onClick={()=>openAdd(h)}
                  style={{background:"transparent",border:"1px dashed rgba(255,255,255,0.06)",borderRadius:7,padding:"3px 6px",cursor:"pointer",color:"rgba(255,255,255,0.12)",fontSize:11,textAlign:"left",width:"100%"}}>+ aggiungi</button>
              </div>
              {isCurrentHour&&<div style={{position:"absolute",left:42,right:0,top:0,height:1.5,background:"rgba(10,132,255,0.5)",zIndex:1}}/>}
            </div>
          );
        })}
      </div>
      <div style={{height:20}}/>
    </div>
  );
}

