function TasksTab({tasks,setTasks,todayTasks,taskDone,toggleTask,addTask,newTask,setNewTask,specialTasks,setSpecialTasks,dow,skippedTasks2,setSkippedTasks2}){
  const [newSpec,setNewSpec]=useState("");
  const [editId,setEditId]=useState(null);
  const [expId,setExpId]=useState(null);
  const compDaily=todayTasks.filter(t=>taskDone[t.id]).length;

  /* ── Funzioni task ─────────────────────────────────────── */
  function addSpec(){if(!newSpec.trim())return;haptic.medium();setSpecialTasks(prev=>[...prev,{id:genId(),text:newSpec,done:false,subtitle:""}]);setNewSpec("");}
  function toggleSpec(id){setSpecialTasks(prev=>prev.map(t=>{if(t.id!==id)return t;const nd={...t,done:!t.done};if(nd.done)haptic.success();else haptic.light();return nd;}));}
  function removeSpec(id){setSpecialTasks(prev=>prev.filter(t=>t.id!==id));}
  function updSpec(id,ch){setSpecialTasks(prev=>prev.map(t=>t.id===id?{...t,...ch}:t));}
  function removeTask(id){setTasks(prev=>prev.filter(t=>t.id!==id));}
  function updTask(id,ch){setTasks(prev=>prev.map(t=>t.id===id?{...t,...ch}:t));}
  function toggleDay(id,day){setTasks(prev=>prev.map(t=>{if(t.id!==id)return t;const days=t.days||[0,1,2,3,4,5,6];return{...t,days:days.includes(day)?days.filter(d=>d!==day):[...days,day].sort()};}));}
  const activeSpec=specialTasks.filter(t=>!t.done);
  const doneSpec=specialTasks.filter(t=>t.done);

  /* ── TaskRow ─────────────────────────────────────────────── */
  function TaskRow({t,isQ}){
    const isDone=isQ?!!taskDone[t.id]:t.done;
    const isExp=expId===t.id;const isEd=editId===t.id;
    const days=t.days||[0,1,2,3,4,5,6];
    const [draftText,setDraftText]=React.useState(t.text);
    const [draftSub,setDraftSub]=React.useState(t.subtitle||"");

    React.useEffect(()=>{setDraftText(t.text);setDraftSub(t.subtitle||"");},[t.text,t.subtitle]);

    return(<div style={{marginBottom:6}}>
      <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid "+(isDone?"rgba(0,201,126,0.1)":"rgba(255,255,255,0.065)"),borderRadius:13,overflow:"hidden"}}>
        <div style={{display:"flex",alignItems:"center",gap:9,padding:"10px 11px"}}>
          <button className={"ck "+(isQ?"dg ":"")+(isDone?"done":"")} onClick={()=>isQ?toggleTask(t.id):toggleSpec(t.id)}>{isDone?"✓":""}</button>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:5}}>
              <div style={{fontSize:13,fontWeight:500,color:isDone?"rgba(255,255,255,0.2)":isQ&&skippedTasks2.has(String(t.id))?"rgba(255,204,0,0.5)":"rgba(255,255,255,0.83)",textDecoration:isDone||(isQ&&skippedTasks2.has(String(t.id)))?"line-through":"none"}}>{t.text}</div>
              {isQ&&skippedTasks2.has(String(t.id))&&<span style={{fontSize:9,color:"#E09818",fontWeight:700,background:"rgba(255,204,0,0.1)",padding:"1px 5px",borderRadius:5}}>⚡</span>}
            </div>
            {!isExp&&t.subtitle&&<div style={{fontSize:11,color:"rgba(255,255,255,0.25)",marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.subtitle}</div>}
          </div>
          <div style={{display:"flex",gap:4,flexShrink:0,alignItems:"center"}}>
            {isQ&&<button onClick={()=>{setSkippedTasks2(prev=>{const n=new Set(prev);n.has(String(t.id))?n.delete(String(t.id)):n.add(String(t.id));return n;});}} style={{background:skippedTasks2.has(String(t.id))?"rgba(255,204,0,0.15)":"rgba(255,255,255,0.04)",border:"1px solid "+(skippedTasks2.has(String(t.id))?"rgba(255,204,0,0.4)":"rgba(255,255,255,0.07)"),borderRadius:7,color:skippedTasks2.has(String(t.id))?"#E09818":"rgba(255,255,255,0.22)",fontSize:11,padding:"3px 7px",cursor:"pointer",fontWeight:700}}>⚡</button>}
            <button onClick={()=>{setEditId(isEd?null:t.id);setExpId(null);}} style={{background:isEd?"rgba(10,132,255,0.1)":"rgba(255,255,255,0.05)",border:"1px solid "+(isEd?"rgba(10,132,255,0.22)":"rgba(255,255,255,0.07)"),borderRadius:7,color:isEd?"#0A84FF":"rgba(255,255,255,0.28)",fontSize:11,padding:"3px 8px",cursor:"pointer"}}>✏️</button>
            {!isEd&&<button onClick={()=>{setExpId(isExp?null:t.id);setEditId(null);}} style={{background:isExp?"rgba(10,132,255,0.07)":"rgba(255,255,255,0.05)",border:"1px solid "+(isExp?"rgba(10,132,255,0.18)":"rgba(255,255,255,0.07)"),borderRadius:7,color:isExp?"#0A84FF":"rgba(255,255,255,0.28)",fontSize:11,padding:"3px 8px",cursor:"pointer",display:"inline-block",transform:isExp?"rotate(180deg)":"none",transition:"transform .2s"}}>&#9662;</button>}
            {isEd&&<button onClick={()=>isQ?removeTask(t.id):removeSpec(t.id)} style={{background:"rgba(10,132,255,0.07)",border:"1px solid rgba(10,132,255,0.14)",borderRadius:7,color:"#0A84FF",fontSize:11,padding:"3px 8px",cursor:"pointer"}}>✕</button>}
          </div>
        </div>
        {isExp&&!isEd&&t.subtitle&&(
          <div style={{padding:"0 11px 10px",borderTop:"1px solid rgba(255,255,255,0.05)"}}>
            <div style={{fontSize:13,color:"rgba(255,255,255,0.4)",lineHeight:1.6,marginTop:9}}>{t.subtitle}</div>
          </div>
        )}
        {isEd&&(
          <div style={{padding:"0 11px 12px",borderTop:"1px solid rgba(255,255,255,0.05)"}}>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.25)",fontWeight:600,letterSpacing:.5,marginTop:10,marginBottom:4}}>NOME</div>
            <input className="inp" value={draftText} onChange={e=>setDraftText(e.target.value)} onBlur={()=>isQ?updTask(t.id,{text:draftText}):updSpec(t.id,{text:draftText})} style={{marginBottom:9}}/>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.25)",fontWeight:600,letterSpacing:.5,marginBottom:4}}>SOTTOTITOLO</div>
            <input className="inp" placeholder="Descrizione opzionale..." value={draftSub} onChange={e=>setDraftSub(e.target.value)} onBlur={()=>isQ?updTask(t.id,{subtitle:draftSub}):updSpec(t.id,{subtitle:draftSub})} style={{marginBottom:10}}/>
            {isQ&&<>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.25)",fontWeight:600,letterSpacing:.5,marginBottom:7}}>GIORNI</div>
              <div style={{display:"flex",gap:3,marginBottom:4}}>
                {DAYS_LETTER.map((d,i)=><button key={i} onClick={()=>toggleDay(t.id,i)} style={{flex:1,padding:"6px 0",borderRadius:8,border:"1px solid "+(days.includes(i)?"rgba(10,132,255,0.35)":"rgba(255,255,255,0.08)"),background:days.includes(i)?"rgba(10,132,255,0.13)":"rgba(255,255,255,0.04)",color:days.includes(i)?"#0A84FF":"rgba(255,255,255,0.25)",fontSize:11,fontWeight:600,cursor:"pointer"}}>{d}</button>)}
              </div>
            </>}
            <button onClick={()=>setEditId(null)} className="btn-p" style={{width:"100%",marginTop:10}}>FATTO ✓</button>
          </div>
        )}
      </div>
    </div>);
  }

  return(<>
    {/* ── TASK QUOTIDIANE ─────────────────────────────────── */}
    <div className="card cg">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div>
          <div style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,0.82)"}}>Task quotidiane</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.25)",marginTop:1}}>Oggi: {DAYS_SHORT[dow]} · si resettano ogni giorno</div>
        </div>
        <span className="pill pg">{compDaily}/{todayTasks.length}</span>
      </div>
      <div className="pbar" style={{marginBottom:10,height:4}}><div className="pf" style={{width:(todayTasks.length?Math.round((compDaily/todayTasks.length)*100):0)+"%",background:"linear-gradient(90deg,#1EC96A,#1EC96A)"}}/></div>
      <div>
        {todayTasks.map(t=><TaskRow key={t.id} t={t} isQ={true}/>)}
      </div>
      <div style={{display:"flex",gap:7,marginTop:10}}>
        <input className="inp" placeholder="Aggiungi task quotidiana..." value={newTask} onChange={e=>setNewTask(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTask()}/>
        <button className="btn-p" onClick={addTask} style={{padding:"10px 13px",fontSize:18}}>+</button>
      </div>
    </div>

    {/* ── TO-DO SPECIALI ──────────────────────────────────── */}
    <div className="card cp">
      <div style={{marginBottom:10}}>
        <div style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,0.82)"}}>To-do speciali</div>
        <div style={{fontSize:11,color:"rgba(255,255,255,0.25)",marginTop:1}}>Non si resettano — cose da fare una volta</div>
      </div>
      {activeSpec.length===0&&doneSpec.length===0&&<div style={{textAlign:"center",padding:"13px 0",color:"rgba(255,255,255,0.17)",fontSize:12}}>Nessuna to-do speciale</div>}
      <div>
        {activeSpec.map(t=><TaskRow key={t.id} t={t} isQ={false}/>)}
      </div>
      <div style={{display:"flex",gap:7,marginTop:activeSpec.length>0?10:4}}>
        <input className="inp" placeholder="Aggiungi to-do speciale..." value={newSpec} onChange={e=>setNewSpec(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addSpec()}/>
        <button className="btn-p" onClick={addSpec} style={{padding:"10px 14px",fontSize:18,background:"linear-gradient(135deg,#9075D4,#8866dd)"}}>+</button>
      </div>
      {doneSpec.length>0&&(
        <div style={{marginTop:13,borderTop:"1px solid rgba(255,255,255,0.05)",paddingTop:10}}>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.17)",fontWeight:600,letterSpacing:.5,marginBottom:8}}>COMPLETATE</div>
          {doneSpec.map(t=><TaskRow key={t.id} t={t} isQ={false}/>)}
        </div>
      )}
    </div>

  </>);
}

