const EMOJI_LIST_TRAINING=["💪","🏋️","🤸","🏃","🚴","🏊","🤾","🧘","🦵","🦾","🦶","✊","⚡","🔥","💯","🎯","🏀","⚽","🥅","⏱️","📐","🥊","🏆","🥇","❤️","🧠","😴","🤺","⛹️","🤽"];
const EMOJI_LIST_GENERAL=["📝","📌","💡","⭐","✨","🎨","📚","🍎","🥗","💧","☀️","🌙","🍽️","🥛","🥤","💊","🩺","📅","🎵","🚀","🎮","💻","📱","🎬","📺","🎤","🎓"];

function EmojiPicker({value,onChange,list,size=44}){
  const [open,setOpen]=useState(false);
  const emojis=list||EMOJI_LIST_TRAINING;
  // Chiude il picker al click fuori
  const ref=useRef(null);
  useEffect(()=>{
    if(!open)return;
    function h(e){if(ref.current&&!ref.current.contains(e.target))setOpen(false);}
    document.addEventListener("pointerdown",h);
    return()=>document.removeEventListener("pointerdown",h);
  },[open]);
  return(
    <div ref={ref} style={{position:"relative",display:"inline-block",width:size}}>
      <button type="button" onClick={()=>setOpen(o=>!o)} className="inp" style={{width:size,fontSize:18,padding:"7px 0",textAlign:"center",cursor:"pointer",background:"rgba(255,255,255,0.055)"}}>
        {value||"💪"}
      </button>
      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,zIndex:50,background:"#0A0A0A",border:"1px solid rgba(255,255,255,0.3)",borderRadius:12,padding:8,boxShadow:"0 8px 24px rgba(0,0,0,0.6)",display:"grid",gridTemplateColumns:"repeat(6, 32px)",gap:4,width:6*32+10*2}}>
          {emojis.map(e=>(
            <button key={e} type="button" onClick={()=>{onChange(e);setOpen(false);}} style={{fontSize:18,width:32,height:32,borderRadius:7,border:"1px solid "+(value===e?"rgba(255,255,255,0.5)":"rgba(255,255,255,0.05)"),background:value===e?"rgba(255,255,255,0.15)":"rgba(255,255,255,0.03)",cursor:"pointer",padding:0}}>{e}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsTab({profile,setProfile,customSchedule,setCustomSchedule,customMealPlan,setCustomMealPlan,tasks,setTasks,onClose,dailyLogs,setDailyLogs,completedDays,setCompletedDays,setStreak}){
  const [section,setSection]=useState(null);
  const [draft,setDraft]=useState({...profile});
  const [schedDraft,setSchedDraft]=useState(()=>JSON.parse(JSON.stringify(customSchedule)));
  const [mealDraft,setMealDraft]=useState(()=>JSON.parse(JSON.stringify(customMealPlan)));
  const [taskDraft,setTaskDraft]=useState(()=>tasks.map(t=>({...t})));
  // Stato per la funzione "replica esercizio su altri giorni"
  const [replicate,setReplicate]=useState(null);
  // Stato per l'inserimento inline di task tra due righe esistenti
  const [insertAfterIdx,setInsertAfterIdx]=useState(null);
  const [insertText,setInsertText]=useState("");
  const [insertSub,setInsertSub]=useState("");
  // Stato per i flussi di logout / eliminazione account
  const [logoutConfirm,setLogoutConfirm]=useState(false);
  const [deleteConfirm,setDeleteConfirm]=useState(false);
  const [accountBusy,setAccountBusy]=useState(false);

  function doLogout(){
    setAccountBusy(true);
    if(typeof window.__logout==="function"){window.__logout();}
    else{try{localStorage.removeItem("enea_current_user");}catch{};window.location.reload();}
  }
  async function doDeleteAccount(){
    setAccountBusy(true);
    window.__deletingAccount=true; // blocca tutte le scritture durante l'eliminazione
    try{__flushWrites&&__flushWrites();}catch{}
    try{
      const cu=localStorage.getItem("enea_current_user");
      if(cu){
        await fbDeleteUser(cu);
        try{
          const list=(()=>{try{const v=localStorage.getItem("enea_local_accounts");return v?JSON.parse(v):[];}catch{return[];}})();
          const filtered=list.filter(x=>x!==cu);
          localStorage.setItem("enea_local_accounts",JSON.stringify(filtered));
        }catch{}
      }
    }catch(e){
      console.warn("[doDeleteAccount] errore:",e);
    }
    try{localStorage.removeItem("enea_current_user");}catch{}
    // Il flag __deletingAccount resta a true: stiamo per fare reload comunque
    if(typeof window.__logout==="function")window.__logout();
    else window.location.reload();
  }

  function saveAll(){setProfile(draft);setCustomSchedule(schedDraft);setCustomMealPlan(mealDraft);setTasks(taskDraft);onClose();}

  function confirmInsertSettings(afterIdx){
    if(!insertText.trim()){setInsertAfterIdx(null);setInsertText("");setInsertSub("");return;}
    const newT={id:genId(),text:insertText.trim(),subtitle:insertSub.trim(),days:[0,1,2,3,4,5,6]};
    const arr=[...taskDraft];
    arr.splice(afterIdx+1,0,newT);
    setTaskDraft(arr);
    setInsertAfterIdx(null);setInsertText("");setInsertSub("");
  }

  function applyReplicate(){
    if(!replicate)return;
    const {di,exIdx,days}=replicate;
    const s=JSON.parse(JSON.stringify(schedDraft));
    const ex=s[di].exercises[exIdx];
    if(!ex){setReplicate(null);return;}
    days.forEach(targetDi=>{
      if(String(targetDi)===String(di))return;
      // Inizializza blocks se mancante (migra dal vecchio formato)
      if(!Array.isArray(s[targetDi].blocks)||s[targetDi].blocks.length===0){
        s[targetDi].blocks=schedDayToBlocks(s[targetDi]);
      }
      // Se anche dopo la migrazione non ci sono blocchi, ne creiamo uno di default
      if(s[targetDi].blocks.length===0){
        s[targetDi].blocks=[{id:genId(),title:ex._block||"Allenamento",icon:ex.icon||"💪",items:[]}];
      }
      // Cerca un blocco col titolo originale; se non c'è, usa il primo
      let targetBlock=s[targetDi].blocks.find(b=>b.title===(ex._block||""))||s[targetDi].blocks[0];
      // Evita duplicati esatti (stesso nome + stesse serie nello stesso blocco)
      const dup=(targetBlock.items||[]).some(it=>it.name===ex.name&&it.sets===ex.sets);
      if(!dup){
        if(!targetBlock.items)targetBlock.items=[];
        targetBlock.items.push({name:ex.name||"",sets:ex.sets||"",icon:ex.icon||targetBlock.icon||"💪"});
      }
      // Aggiorna anche il legacy mirror per compat
      const legacy=blocksToLegacy(s[targetDi].blocks);
      s[targetDi].exercises=legacy.exercises;
      s[targetDi].skills=legacy.skills;
    });
    setSchedDraft(s);
    setReplicate(null);
  }

  const SECS=[
    {id:"profile",  icon:"",label:"Dati profilo"},
    {id:"tracking", icon:"",label:"Stato app (inizia / pausa / reset)"},
    {id:"training", icon:"",label:"Piano allenamento"},
    {id:"nutrition",icon:"",label:"Piano alimentare"},
    {id:"tasks",    icon:"", label:"Task quotidiane"},
    {id:"history",  icon:"",label:"Modifica giorni passati"},
    {id:"partite",  icon:"",label:"Calendario Partite"},
    {id:"backup",   icon:"",label:"Backup / Ripristino dati"},
  ];

  return(<>
    <div className="card" style={{background:"rgba(255,255,255,0.06)",borderColor:"rgba(255,255,255,0.2)",marginBottom:10}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div><div className="H" style={{fontSize:20,letterSpacing:.3}}>Impostazioni</div><div style={{fontSize:11,color:"rgba(255,255,255,0.3)",marginTop:2}}>Modifica e salva tutto</div></div>
        <button onClick={saveAll} className="btn-p" style={{padding:"8px 16px",fontSize:13}}>SALVA</button>
      </div>
    </div>

    {SECS.map(s=>(
      <div key={s.id}>
        <button onClick={()=>setSection(section===s.id?null:s.id)} style={{width:"100%",background:"rgba(255,255,255,0.038)",border:"1px solid "+(section===s.id?"rgba(255,255,255,0.3)":"rgba(255,255,255,0.065)"),borderRadius:14,padding:"13px 15px",display:"flex",alignItems:"center",gap:12,cursor:"pointer",marginBottom:section===s.id?0:8,borderBottomLeftRadius:section===s.id?0:14,borderBottomRightRadius:section===s.id?0:14}}>
          <span className={"sec-icon sec-"+s.id}></span>
          <span style={{flex:1,fontSize:14,fontWeight:600,color:"rgba(255,255,255,0.8)",textAlign:"left"}}>{s.label}</span>
          <span style={{color:"rgba(255,255,255,0.3)",fontSize:13,transform:section===s.id?"rotate(180deg)":"none",transition:"transform .2s",display:"inline-block"}}>▾</span>
        </button>
        {section===s.id&&(
          <div style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.2)",borderTop:"none",borderBottomLeftRadius:14,borderBottomRightRadius:14,padding:"14px",marginBottom:8}}>
            {s.id==="profile"&&(
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
                {[{l:"Nome",k:"name",t:"text"},{l:"Eta",k:"age",t:"number"},{l:"Peso kg",k:"weight",t:"number"},{l:"Altezza cm",k:"height",t:"number"}].map(f=>(
                  <div key={f.k}><div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginBottom:4,fontWeight:600}}>{f.l.toUpperCase()}</div><input type={f.t} className="inp" value={draft[f.k]} onChange={e=>setDraft(p=>({...p,[f.k]:f.t==="number"?parseFloat(e.target.value)||0:e.target.value}))}/></div>
                ))}
              </div>
            )}
            {s.id==="training"&&(
              <div>
                {Object.entries(schedDraft).map(([di,day])=>{
                  // Converti vecchio formato in blocks se necessario
                  const blocks=schedDayToBlocks(day);
                  function updateBlocks(newBlocks){
                    const s=JSON.parse(JSON.stringify(schedDraft));
                    s[di].blocks=newBlocks;
                    // Mantieni backward compat: aggiorna anche exercises/skills dal primo/secondo blocco
                    const legacy=blocksToLegacy(newBlocks);
                    s[di].exercises=legacy.exercises;
                    s[di].skills=legacy.skills;
                    setSchedDraft(s);
                  }
                  function addBlock(){
                    updateBlocks([...blocks,{id:genId(),title:"",icon:"💪",items:[]}]);
                  }
                  function removeBlock(bi){
                    const nb=[...blocks];nb.splice(bi,1);updateBlocks(nb);
                  }
                  function setBlockField(bi,field,val){
                    const nb=JSON.parse(JSON.stringify(blocks));nb[bi][field]=val;updateBlocks(nb);
                  }
                  function addItem(bi){
                    const nb=JSON.parse(JSON.stringify(blocks));
                    nb[bi].items.push({name:"",sets:"",icon:nb[bi].icon||"💪"});
                    updateBlocks(nb);
                  }
                  function removeItem(bi,ii){
                    const nb=JSON.parse(JSON.stringify(blocks));nb[bi].items.splice(ii,1);updateBlocks(nb);
                  }
                  function setItemField(bi,ii,field,val){
                    const nb=JSON.parse(JSON.stringify(blocks));nb[bi].items[ii][field]=val;updateBlocks(nb);
                  }
                  function replicateItem(bi,ii){
                    // Usa il sistema replicate esistente — salva il riferimento come esercizio del blocco
                    const item=blocks[bi]?.items?.[ii];
                    if(!item)return;
                    // Hack: salva i dati dell'esercizio come se fosse exercises[exIdx] (per compatibilità col modal replicate)
                    const s2=JSON.parse(JSON.stringify(schedDraft));
                    // Appiattisci in exercises per il modal replicate
                    const flatIdx=(()=>{let c=0;for(let b=0;b<bi;b++)c+=(blocks[b].items||[]).length;return c+ii;})();
                    s2[di].exercises=flatBlockItems(blocks);
                    setSchedDraft(s2);
                    setReplicate({di,exIdx:flatIdx,days:new Set()});
                  }

                  return(
                  <div key={di} style={{marginBottom:20,paddingBottom:14,borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
                    <div style={{fontSize:11,color:"#FFFFFF",fontWeight:700,letterSpacing:.5,marginBottom:8}}>{DAYS_SHORT[di]}</div>
                    {/* Label giorno */}
                    <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginBottom:3,fontWeight:600}}>NOME DEL GIORNO</div>
                    <input className="inp" value={day.label||""} onChange={e=>{const s=JSON.parse(JSON.stringify(schedDraft));s[di].label=e.target.value;setSchedDraft(s);}} style={{marginBottom:8,fontSize:15,padding:"7px 10px"}} placeholder={DAYS_SHORT[di]}/>
                    <div style={{display:"flex",gap:6,marginBottom:10,alignItems:"flex-end"}}>
                      <div style={{flex:2}}>
                        <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginBottom:3,fontWeight:600}}>TIPO</div>
                        <select className="inp" value={day.type||"custom"} onChange={e=>{const s=JSON.parse(JSON.stringify(schedDraft));s[di].type=e.target.value;setSchedDraft(s);}} style={{fontSize:14,padding:"7px 10px"}}>
                          <option value="custom">💪 Allenamento</option>
                          <option value="strength">🏋️ Forza</option>
                          <option value="hiit">⚡ Esplosività</option>
                          <option value="practice">🏀 Squadra</option>
                          <option value="game" disabled>🏆 Game Day (auto da FIP)</option>
                          <option value="rest">😴 Riposo</option>
                        </select>
                      </div>
                      <div>
                        <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginBottom:3,fontWeight:600}}>ICONA</div>
                        <EmojiPicker value={day.icon||""} onChange={v=>{const s=JSON.parse(JSON.stringify(schedDraft));s[di].icon=v;setSchedDraft(s);}}/>
                      </div>
                    </div>

                    {/* ── BLOCCHI ALLENAMENTO ── */}
                    {blocks.map((block,bi)=>(
                      <div key={block.id||bi} style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:11,padding:"10px 11px",marginBottom:10}}>
                        <div style={{display:"flex",gap:5,marginBottom:8,alignItems:"center"}}>
                          <EmojiPicker value={block.icon||"💪"} onChange={v=>setBlockField(bi,"icon",v)}/>
                          <input className="inp" value={block.title||""} onChange={e=>setBlockField(bi,"title",e.target.value)} style={{flex:1,fontSize:14,fontWeight:700,padding:"7px 10px"}} placeholder="Titolo blocco (es. Forza, Tiro, Cardio…)"/>
                          <button onClick={()=>removeBlock(bi)} className="icon-trash" style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:8,padding:"5px 8px",cursor:"pointer"}} title="Elimina blocco"></button>
                        </div>
                        {/* Items del blocco */}
                        {(block.items||[]).map((it,ii)=>(
                          <div key={ii} style={{display:"flex",gap:4,marginBottom:4,alignItems:"flex-start"}}>
                            <EmojiPicker value={it.icon||block.icon||"💪"} onChange={v=>setItemField(bi,ii,"icon",v)}/>
                            <input className="inp" value={it.name||""} onChange={e=>setItemField(bi,ii,"name",e.target.value)} style={{flex:2,fontSize:14,padding:"7px 9px"}} placeholder="Esercizio"/>
                            <input className="inp" value={it.sets||""} onChange={e=>setItemField(bi,ii,"sets",e.target.value)} style={{flex:1,fontSize:14,padding:"7px 9px",minWidth:0}} placeholder="3x10"/>
                            <button onClick={()=>replicateItem(bi,ii)} title="Copia su altri giorni" style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.18)",borderRadius:8,color:"#D4D4D8",fontSize:12,padding:"5px 7px",cursor:"pointer"}}>↗</button>
                            <button onClick={()=>removeItem(bi,ii)} style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:8,color:"#FFFFFF",fontSize:12,padding:"5px 7px",cursor:"pointer"}}>✕</button>
                          </div>
                        ))}
                        <button onClick={()=>addItem(bi)} style={{background:"rgba(255,255,255,0.03)",border:"1px dashed rgba(255,255,255,0.1)",borderRadius:8,color:"rgba(255,255,255,0.3)",fontSize:11,padding:"5px 10px",cursor:"pointer",width:"100%",marginTop:3}}>+ Esercizio</button>
                      </div>
                    ))}

                    <button onClick={addBlock} style={{background:"rgba(255,255,255,0.05)",border:"1px dashed rgba(255,255,255,0.25)",borderRadius:10,color:"rgba(255,255,255,0.7)",fontSize:12,fontWeight:700,padding:"9px 14px",cursor:"pointer",width:"100%",marginBottom:10}}>+ Aggiungi blocco allenamento</button>

                    {/* Nota */}
                    <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginBottom:3,fontWeight:600}}>NOTA</div>
                    <textarea rows={2} value={day.note||""} onChange={e=>{const s=JSON.parse(JSON.stringify(schedDraft));s[di].note=e.target.value;setSchedDraft(s);}} style={{fontSize:13,padding:"7px 10px"}} placeholder="Es. 60'' riposo tra i set…"/>
                  </div>
                  );
                })}
              </div>
            )}
            {s.id==="nutrition"&&(
              <div>
                {Object.entries(mealDraft).map(([meal,plan])=>(
                  <div key={meal} style={{marginBottom:14}}>
                    <div style={{fontSize:11,color:"#FFFFFF",fontWeight:700,letterSpacing:.5,marginBottom:6}}>{meal.toUpperCase()}</div>
                    <input className="inp" value={plan.target} onChange={e=>{const m={...mealDraft,[meal]:{...mealDraft[meal],target:e.target.value}};setMealDraft(m);}} style={{marginBottom:7,fontSize:16}}/>
                    {plan.examples.map((ex,i)=>(
                      <div key={i} style={{display:"flex",gap:6,marginBottom:5}}>
                        <input className="inp" value={ex} onChange={e=>{const m=JSON.parse(JSON.stringify(mealDraft));m[meal].examples[i]=e.target.value;setMealDraft(m);}} style={{flex:1,fontSize:16,padding:"7px 10px"}}/>
                        <button onClick={()=>{const m=JSON.parse(JSON.stringify(mealDraft));m[meal].examples.splice(i,1);setMealDraft(m);}} style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:8,color:"#FFFFFF",fontSize:13,padding:"6px 8px",cursor:"pointer"}}>✕</button>
                      </div>
                    ))}
                    <button onClick={()=>{const m=JSON.parse(JSON.stringify(mealDraft));m[meal].examples.push("");setMealDraft(m);}} style={{background:"rgba(255,255,255,0.04)",border:"1px dashed rgba(255,255,255,0.1)",borderRadius:8,color:"rgba(255,255,255,0.3)",fontSize:12,padding:"6px 12px",cursor:"pointer",width:"100%",marginTop:2,marginBottom:6}}>+ Esempio</button>
                  </div>
                ))}
              </div>
            )}
            {s.id==="tasks"&&(
              <div>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginBottom:8,lineHeight:1.5}}>Tocca <span style={{color:"#FFFFFF",fontWeight:700}}>+</span> tra una task e l'altra per inserirla in mezzo.</div>
                {taskDraft.map((t,i)=>(<React.Fragment key={t.id}>
                  <div style={{marginBottom:5,padding:"10px",background:"rgba(255,255,255,0.03)",borderRadius:11,border:"1px solid rgba(255,255,255,0.07)"}}>
                    <div style={{display:"flex",gap:6,marginBottom:6}}>
                      <input className="inp" value={t.text} onChange={e=>{const d=[...taskDraft];d[i]={...d[i],text:e.target.value};setTaskDraft(d);}} style={{flex:1,fontSize:16}} placeholder="Nome task"/>
                      <button onClick={()=>setTaskDraft(p=>p.filter((_,j)=>j!==i))} style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:8,color:"#FFFFFF",fontSize:13,padding:"6px 8px",cursor:"pointer"}}>✕</button>
                    </div>
                    <input className="inp" value={t.subtitle||""} onChange={e=>{const d=[...taskDraft];d[i]={...d[i],subtitle:e.target.value};setTaskDraft(d);}} style={{marginBottom:7,fontSize:16}} placeholder="Sottotitolo opzionale"/>
                    <div style={{display:"flex",gap:3,marginBottom:4}}>
                      {DAYS_LETTER.map((dl,j)=>{const days=t.days||[0,1,2,3,4,5,6];const active=days.includes(j);return <button key={j} onClick={()=>{const nd=active?days.filter(x=>x!==j):[...days,j].sort();const dr=[...taskDraft];dr[i]={...dr[i],days:nd};setTaskDraft(dr);}} style={{flex:1,padding:"5px 0",borderRadius:7,border:"1px solid "+(active?"rgba(255,255,255,0.35)":"rgba(255,255,255,0.08)"),background:active?"rgba(255,255,255,0.13)":"rgba(255,255,255,0.04)",color:active?"#FFFFFF":"rgba(255,255,255,0.25)",fontSize:11,fontWeight:600,cursor:"pointer"}}>{dl}</button>;})}
                    </div>
                    {(()=>{const days=t.days||[0,1,2,3,4,5,6];const active=days.includes(7);return <button onClick={()=>{const nd=active?days.filter(x=>x!==7):[...days,7].sort();const dr=[...taskDraft];dr[i]={...dr[i],days:nd};setTaskDraft(dr);}} style={{width:"100%",padding:"5px 0",borderRadius:7,border:"1px solid "+(active?"rgba(255,255,255,0.4)":"rgba(255,255,255,0.08)"),background:active?"rgba(255,255,255,0.15)":"rgba(255,255,255,0.04)",color:active?"#FFFFFF":"rgba(255,255,255,0.25)",fontSize:11,fontWeight:700,cursor:"pointer"}}>🏀 Solo Game Day</button>;})()}
                  </div>
                  {/* Pulsante "+" inline (fix v22 #3) */}
                  {insertAfterIdx===i?(
                    <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:11,padding:"9px 10px",marginBottom:5}}>
                      <input autoFocus className="inp" placeholder="Nome nuova task..." value={insertText} onChange={e=>setInsertText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")confirmInsertSettings(i);if(e.key==="Escape"){setInsertAfterIdx(null);setInsertText("");setInsertSub("");}}} style={{marginBottom:6,fontSize:15}}/>
                      <input className="inp" placeholder="Sottotitolo opzionale..." value={insertSub} onChange={e=>setInsertSub(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")confirmInsertSettings(i);}} style={{marginBottom:8,fontSize:14}}/>
                      <div style={{display:"flex",gap:6}}>
                        <button className="btn-p" onClick={()=>confirmInsertSettings(i)} style={{flex:1,padding:"8px",fontSize:13}}>AGGIUNGI ✓</button>
                        <button className="btn-s" onClick={()=>{setInsertAfterIdx(null);setInsertText("");setInsertSub("");}} style={{padding:"8px 12px",fontSize:12}}>Annulla</button>
                      </div>
                    </div>
                  ):(
                    <button onClick={()=>{setInsertAfterIdx(i);setInsertText("");setInsertSub("");}} style={{width:"100%",background:"transparent",border:"none",padding:"1px 0 5px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:4,color:"rgba(255,255,255,0.18)",fontSize:13,fontWeight:600}}>
                      <span style={{display:"inline-block",width:18,height:18,borderRadius:"50%",background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.18)",lineHeight:"16px",fontSize:13,color:"#FFFFFF"}}>+</span>
                    </button>
                  )}
                </React.Fragment>))}
                <button onClick={()=>setTaskDraft(p=>[...p,{id:genId(),text:"",subtitle:"",days:[0,1,2,3,4,5,6]}])} style={{background:"rgba(255,255,255,0.04)",border:"1px dashed rgba(255,255,255,0.1)",borderRadius:10,color:"rgba(255,255,255,0.3)",fontSize:13,padding:"9px",cursor:"pointer",width:"100%",marginTop:6}}>+ Nuova task in coda</button>
              </div>
            )}
            {s.id==="tracking"&&<TrackingSection/>}
            {s.id==="history"&&<HistoryEditor dailyLogs={dailyLogs} setDailyLogs={setDailyLogs} completedDays={completedDays} setCompletedDays={setCompletedDays} setStreak={setStreak}/>}
            {s.id==="partite"&&<PartiteCalendar/>}
            {s.id==="backup"&&<BackupRestore/>}
          </div>
        )}
      </div>
    ))}
    <div style={{height:10}}/>
    <button onClick={saveAll} className="btn-p" style={{width:"100%",padding:"13px",fontSize:15,fontWeight:700}}>SALVA TUTTO E CHIUDI ✓</button>

    {/* ── ACCOUNT: Disconnetti / Elimina account ──────────────────────── */}
    <div style={{marginTop:30,marginBottom:8,fontSize:10,color:"rgba(255,255,255,0.28)",fontWeight:600,letterSpacing:.8}}>ACCOUNT</div>
    {(()=>{const cu=(typeof window!=="undefined")&&localStorage.getItem("enea_current_user");return cu?(
      <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:10}}>Loggato come <span style={{color:"#FFFFFF",fontWeight:600}}>{cu}</span></div>
    ):null;})()}
    {!logoutConfirm?(
      <button onClick={()=>setLogoutConfirm(true)} disabled={accountBusy}
        style={{width:"100%",padding:"12px",borderRadius:11,border:"1px solid rgba(255,255,255,0.35)",background:"rgba(255,255,255,0.08)",color:"#F5F5F5",fontSize:13,fontWeight:700,cursor:"pointer",letterSpacing:.3,marginBottom:8}}>
        Disconnetti
      </button>
    ):(
      <div style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.25)",borderRadius:12,padding:12,marginBottom:8}}>
        <div style={{fontSize:13,color:"rgba(255,255,255,0.85)",marginBottom:9,fontWeight:600}}>Sei sicuro di voler uscire?</div>
        <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:10,lineHeight:1.5}}>I tuoi dati restano salvati su cloud. Al prossimo login li ritrovi tutti.</div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setLogoutConfirm(false)} disabled={accountBusy} style={{flex:1,padding:"10px",borderRadius:10,border:"1px solid rgba(255,255,255,0.1)",background:"rgba(255,255,255,0.04)",color:"rgba(255,255,255,0.6)",fontSize:12,cursor:"pointer",fontWeight:600}}>Annulla</button>
          <button onClick={doLogout} disabled={accountBusy} style={{flex:1,padding:"10px",borderRadius:10,border:"none",background:"#F5F5F5",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>Disconnetti</button>
        </div>
      </div>
    )}
    {!deleteConfirm?(
      <button onClick={()=>setDeleteConfirm(true)} disabled={accountBusy}
        style={{width:"100%",padding:"8px",borderRadius:9,border:"none",background:"transparent",color:"rgba(255,255,255,0.3)",fontSize:11,cursor:"pointer",textDecoration:"underline",fontWeight:500}}>
        Elimina account
      </button>
    ):(
      <div style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.4)",borderRadius:12,padding:12}}>
        <div style={{fontSize:13,color:"#F5F5F5",marginBottom:8,fontWeight:700,display:"flex",alignItems:"center",gap:6}}><span className="icon-warning"></span>Questa azione è irreversibile.</div>
        <div style={{fontSize:11,color:"rgba(255,255,255,0.55)",marginBottom:11,lineHeight:1.5}}>Tutti i tuoi dati verranno eliminati definitivamente da cloud e da questo dispositivo. Non potranno essere recuperati.</div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setDeleteConfirm(false)} disabled={accountBusy} style={{flex:1,padding:"10px",borderRadius:10,border:"1px solid rgba(255,255,255,0.1)",background:"rgba(255,255,255,0.04)",color:"rgba(255,255,255,0.7)",fontSize:12,cursor:"pointer",fontWeight:600}}>Annulla</button>
          <button onClick={doDeleteAccount} disabled={accountBusy} style={{flex:1,padding:"10px",borderRadius:10,border:"none",background:"#F5F5F5",color:"#fff",fontSize:12,fontWeight:700,cursor:accountBusy?"wait":"pointer",opacity:accountBusy?0.6:1}}>{accountBusy?"…":"Elimina"}</button>
        </div>
      </div>
    )}
    <div style={{height:30}}/>

    {/* ── Modal replica esercizio — portal su body per evitare trappola overflow iOS ── */}
    {replicate&&ReactDOM.createPortal(
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:9998,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>setReplicate(null)}>
        <div onClick={e=>e.stopPropagation()} style={{background:"#0A0A0A",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"18px 18px 0 0",padding:"20px 16px",width:"100%",maxWidth:430,maxHeight:"75vh",overflowY:"auto",paddingBottom:"calc(20px + env(safe-area-inset-bottom,0px))"}}>
          <div style={{fontSize:14,fontWeight:700,color:"rgba(255,255,255,0.85)",marginBottom:6}}>↗ Copia esercizio su altri giorni</div>
          {(()=>{const ex=schedDraft[replicate.di]?.exercises?.[replicate.exIdx];return ex?(
            <div style={{fontSize:12,color:"rgba(255,255,255,0.45)",marginBottom:12}}>
              <span style={{fontSize:14,marginRight:5}}>{ex.icon||"💪"}</span>
              <span style={{color:"rgba(255,255,255,0.75)",fontWeight:600}}>{ex.name||"(senza nome)"}</span>
              {ex.sets&&<span style={{color:"rgba(255,255,255,0.4)"}}> · {ex.sets}</span>}
            </div>
          ):null;})()}
          <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",fontWeight:600,letterSpacing:.5,marginBottom:6}}>SELEZIONA I GIORNI ({DAYS_SHORT[replicate.di]} è già il giorno corrente)</div>
          <div style={{display:"flex",gap:5,marginBottom:14,flexWrap:"wrap"}}>
            {DAYS_SHORT.map((d,i)=>{
              const isCurrent=String(i)===String(replicate.di);
              const sel=replicate.days.has(String(i));
              return(
                <button key={i} onClick={()=>{if(isCurrent)return;const nd=new Set(replicate.days);if(nd.has(String(i)))nd.delete(String(i));else nd.add(String(i));setReplicate({...replicate,days:nd});}}
                  style={{flex:"1 1 calc(33% - 5px)",minWidth:0,padding:"12px 0",borderRadius:9,fontSize:12,fontWeight:700,cursor:isCurrent?"default":"pointer",border:"1px solid "+(isCurrent?"rgba(255,255,255,0.05)":sel?"rgba(255,255,255,0.55)":"rgba(255,255,255,0.1)"),background:isCurrent?"rgba(255,255,255,0.02)":sel?"rgba(255,255,255,0.2)":"rgba(255,255,255,0.05)",color:isCurrent?"rgba(255,255,255,0.15)":sel?"#D4D4D8":"rgba(255,255,255,0.5)"}}>
                  {d}{isCurrent?" ⓘ":""}
                </button>
              );
            })}
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>setReplicate(null)} style={{flex:1,padding:"13px",borderRadius:10,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.04)",color:"rgba(255,255,255,0.4)",fontSize:13,cursor:"pointer"}}>Annulla</button>
            <button onClick={applyReplicate} disabled={replicate.days.size===0} style={{flex:2,padding:"13px",borderRadius:10,border:"none",background:replicate.days.size===0?"rgba(255,255,255,0.06)":"linear-gradient(135deg,#FFFFFF,#D4D4D8)",color:replicate.days.size===0?"rgba(255,255,255,0.25)":"#fff",fontSize:13,fontWeight:700,cursor:replicate.days.size===0?"not-allowed":"pointer"}}>COPIA SU {replicate.days.size} GIORNI ✓</button>
          </div>
        </div>
      </div>,
      document.body
    )}
  </>);
}


