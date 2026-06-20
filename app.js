function App(){
  const [tab,setTab]=useState("home");
  const td=todayStr();
  const wd=getWD();
  const dow=(new Date().getDay()+6)%7;
  const [customSchedule,setCustomSchedule]=useState(()=>load("custom_schedule",null));
  const [customMealPlan,setCustomMealPlan]=useState(()=>load("custom_meal_plan",null));
  useEffect(()=>{if(customSchedule)save("custom_schedule",customSchedule);},[customSchedule]);
  useEffect(()=>{if(customMealPlan)save("custom_meal_plan",customMealPlan);},[customMealPlan]);
  // Usa il piano personalizzato se valido; fallback a SCHEDULE per i giorni non definiti
  const effectiveSched=(customSchedule&&typeof customSchedule==="object")?customSchedule:SCHEDULE;

  const [profile,setProfile]=useState(()=>load("profile",{name:"",age:0,weight:0,height:0}));
  const [dailyLogs,setDailyLogs]=useState(()=>load("dlogs",{}));
  const [meals,setMeals]=useState(()=>load("meals_"+td,{}));
  const [water,setWater]=useState(()=>load("water_"+td,0));
  const [exercises,setExercises]=useState(()=>load("ex_"+td,{}));
  const [skills,setSkills]=useState(()=>load("sk_"+td,{}));
  const [trainingDone,setTrainingDone]=useState(()=>load("tdone_"+td,false));
  const [streak,setStreak]=useState(()=>load("streak",0));
  const [completedDays,setCompletedDays]=useState(()=>load("cdays",{}));
  const [tasks,setTasks]=useState(()=>load("tasks_v2",[]));
  const [taskDone,setTaskDone]=useState(()=>load("tdone2_"+td,{}));
  const [specialTasks,setSpecialTasks]=useState(()=>load("stasks",[]));
  const [foodStars,setFoodStars]=useState(()=>load("fstars_"+td,0));

  // Note: migra le vecchie note giornaliere "enea_note_<date>" nel nuovo array unificato
  const [notes,setNotes]=useState(()=>{
    const existing=load("notes_v1",null);
    if(existing&&Array.isArray(existing))return existing;
    const migrated=[];
    try{
      for(let i=0;i<localStorage.length;i++){
        const k=localStorage.key(i);
        if(k&&k.startsWith("enea_note_")){
          const dateStr=k.replace("enea_note_","");
          if(!/^\d{4}-\d{2}-\d{2}$/.test(dateStr))continue;
          let txt="";
          try{txt=JSON.parse(localStorage.getItem(k))||"";}catch{}
          if(typeof txt==="string"&&txt.trim()){
            const ts=new Date(dateStr+"T12:00:00").getTime();
            migrated.push({
              id:String(ts)+"_"+Math.random().toString(36).slice(2,10),
              title:new Date(dateStr+"T12:00:00").toLocaleDateString("it-IT",{weekday:"long",day:"numeric",month:"long"}),
              body:txt.replace(/\n/g,"<br/>"),
              pinned:false,
              createdAt:ts,
              updatedAt:ts,
            });
          }
        }
      }
    }catch{}
    migrated.sort((a,b)=>b.updatedAt-a.updatedAt);
    save("notes_v1",migrated);
    return migrated;
  });
  useEffect(()=>{save("notes_v1",notes);},[notes]);

  // Eventi "imprevisto": esercizi/pasti/task saltati nel giorno corrente
  const [skippedEx,setSkippedEx]=useState(()=>new Set(load("skip_ex_"+td,[])));
  const [skippedMeals,setSkippedMeals]=useState(()=>new Set(load("skip_meals_"+td,[])));
  const [skippedTasks2,setSkippedTasks2]=useState(()=>new Set(load("skip_tasks_"+td,[])));
  const [newTask,setNewTask]=useState("");
  const [calEvents,setCalEvents]=useState(()=>load("cal_events",[]));
  useEffect(()=>{save("cal_events",calEvents);},[calEvents]);

  // Una-tantum: rimuove eventi fip_* legacy iniettati dal vecchio seed
  useEffect(()=>{
    setCalEvents(prev=>{
      const filtered=prev.filter(e=>!(typeof e.id==="string"&&e.id.startsWith("fip_")));
      return filtered.length!==prev.length?filtered:prev;
    });
  },[]);

  // Game day = c'è un evento FIP oggi nel calendario, sia tra calEvents che tra le partite importate dal PDF FIP
  const todayIsFipGameFromCal=calEvents.some(e=>typeof e.id==="string"&&e.id.startsWith("fip_")&&e.date===td);
  const todayIsFipGameFromImport=React.useMemo(()=>{
    try{
      const m=load("fip_matches",null);
      if(!Array.isArray(m))return false;
      return m.some(p=>p.date===td);
    }catch{return false;}
  },[td]);
  const todayIsFipGame=todayIsFipGameFromCal||todayIsFipGameFromImport;
  const sched=todayIsFipGame
    ?{label:"GAME DAY — Partita FIP",type:"game",icon:"🏆",exercises:[],skills:[],note:""}
    :(effectiveSched[dow]||SCHEDULE[dow]);

  useEffect(()=>{save("profile",profile);},[profile]);
  useEffect(()=>{save("dlogs",dailyLogs);},[dailyLogs]);
  useEffect(()=>{save("meals_"+td,meals);},[meals]);
  useEffect(()=>{save("water_"+td,water);},[water]);
  useEffect(()=>{save("ex_"+td,exercises);},[exercises]);
  useEffect(()=>{save("sk_"+td,skills);},[skills]);
  useEffect(()=>{save("tdone_"+td,trainingDone);},[trainingDone]);
  useEffect(()=>{save("streak",streak);},[streak]);
  useEffect(()=>{save("cdays",completedDays);},[completedDays]);
  useEffect(()=>{save("tasks_v2",tasks);},[tasks]);
  useEffect(()=>{save("tdone2_"+td,taskDone);},[taskDone]);
  useEffect(()=>{save("stasks",specialTasks);},[specialTasks]);
  useEffect(()=>{save("fstars_"+td,foodStars);},[foodStars]);
  useEffect(()=>{save("skip_ex_"+td,[...skippedEx]);},[skippedEx]);
  useEffect(()=>{save("skip_meals_"+td,[...skippedMeals]);},[skippedMeals]);
  useEffect(()=>{save("skip_tasks_"+td,[...skippedTasks2]);},[skippedTasks2]);

  const todayTasks=tasks.filter(t=>{
    if(!t.days)return true;
    if(t.days.length===1&&t.days[0]===7)return false; // task "solo game day" senza FIP attivo
    return t.days.includes(dow);
  });
  const compTasks=todayTasks.filter(t=>taskDone[t.id]).length;
  const taskPct=todayTasks.length>0?Math.round((compTasks/todayTasks.length)*100):0;

  // Stabilizza i Set come array ordinati per evitare re-render a cascata
  const skipExArr=React.useMemo(()=>[...skippedEx].sort(),[skippedEx]);
  const skipMealsArr=React.useMemo(()=>[...skippedMeals].sort(),[skippedMeals]);
  const skipTasksArr=React.useMemo(()=>[...skippedTasks2].sort(),[skippedTasks2]);

  useEffect(()=>{
    setDailyLogs(prev=>{
      const cur=prev[td];
      const next={
        foodStars,trainingDone,taskPct,
        skippedEx:skipExArr,skippedMeals:skipMealsArr,skippedTasks:skipTasksArr,
      };
      // Skip update se identico, per evitare scritture inutili su Firestore
      if(cur
        &&cur.foodStars===next.foodStars
        &&cur.trainingDone===next.trainingDone
        &&cur.taskPct===next.taskPct
        &&JSON.stringify(cur.skippedEx)===JSON.stringify(next.skippedEx)
        &&JSON.stringify(cur.skippedMeals)===JSON.stringify(next.skippedMeals)
        &&JSON.stringify(cur.skippedTasks)===JSON.stringify(next.skippedTasks)
      )return prev;
      return {...prev,[td]:next};
    });
  },[foodStars,trainingDone,taskPct,skipExArr,skipMealsArr,skipTasksArr,td]);

  // Blocchi unificati: tutti gli item (con migrazione automatica dal vecchio formato)
  const allBlockItems=flatBlockItems(schedDayToBlocks(sched));
  const compEx=allBlockItems.filter(it=>exercises[it.name]||skills[it.name]).length;
  const compSk=0; // Unificato: tutto conta come compEx
  const total=allBlockItems.length;
  const allDone=total>0&&compEx>=total;

  useEffect(()=>{
    if(!allDone||trainingDone)return;
    setTrainingDone(true);
    setCompletedDays(prev=>({...prev,[td]:true}));
    const y=new Date();y.setDate(y.getDate()-1);const yd=localDateStr(y);
    // Funzionale: non legge lo streak captured (evita stale closure)
    setStreak(s=>completedDays[yd]?s+1:1);
  },[allDone,trainingDone,td,completedDays]);

  // Dopo "ho giocato" apre il modal per inserire i dati partita
  const [gameStatsModal,setGameStatsModal]=useState(null);

  function markGameDone(){
    haptic.success();
    setTrainingDone(true);setCompletedDays(prev=>({...prev,[td]:true}));
    const y=new Date();y.setDate(y.getDate()-1);const yd=localDateStr(y);
    setStreak(s=>completedDays[yd]?s+1:1);
    try{
      const existing=load("game_stats",[]);
      const already=Array.isArray(existing)&&existing.some(g=>g.date===td);
      if(!already)setGameStatsModal({date:td});
    }catch{
      setGameStatsModal({date:td});
    }
  }

  function saveGameStats({skipped,stats,score}){
    if(!gameStatsModal)return;
    const date=gameStatsModal.date;
    const season=load("current_season",1);
    const newRec={
      id:genId(),
      date,
      season,
      skipped:!!skipped,
      stats:skipped?{}:stats,
      score:skipped?null:(score||null),
    };
    const prev=load("game_stats",[]);
    // Se esiste già un record per la data, lo sostituisce
    const filtered=Array.isArray(prev)?prev.filter(g=>g.date!==date):[];
    save("game_stats",[...filtered,newRec]);
    // Sincronizza il risultato anche nel calendario partite
    if(!skipped&&score){
      try{
        const matches=load("fip_matches",null);
        if(Array.isArray(matches)){
          const updated=matches.map(m=>m.date===date?{...m,risultato:score}:m);
          save("fip_matches",updated);
        }
      }catch{}
    }
    setGameStatsModal(null);
  }

  const weekComp=wd.filter(d=>completedDays[d]).length;
  const bmi=(profile.height>0&&profile.weight>0)?(profile.weight/((profile.height/100)**2)).toFixed(1):"—";

  const p={
    profile,setProfile,customMealPlan,customSchedule,
    dailyLogs,td,wd,dow,sched,completedDays,trainingDone,markGameDone,
    tasks,setTasks,todayTasks,taskDone,
    toggleTask:id=>setTaskDone(prev=>{const next={...prev,[id]:!prev[id]};next[id]?haptic.success():haptic.light();return next;}),
    addTask:()=>{if(!newTask.trim())return;haptic.medium();setTasks(prev=>[...prev,{id:genId(),text:newTask,subtitle:"",days:[0,1,2,3,4,5,6]}]);setNewTask("");},
    newTask,setNewTask,specialTasks,setSpecialTasks,
    water,setWater,weekComp,compTasks,taskPct,streak,bmi,
    meals,setMeals,foodStars,setFoodStars,
    exercises,toggleEx:ex=>setExercises(prev=>{const next={...prev,[ex]:!prev[ex]};next[ex]?haptic.success():haptic.light();return next;}),
    skills,toggleSk:sk=>setSkills(prev=>{const next={...prev,[sk]:!prev[sk]};next[sk]?haptic.success():haptic.light();return next;}),
    compEx,compSk,total,allDone,
    skippedEx,setSkippedEx,skippedMeals,setSkippedMeals,skippedTasks2,setSkippedTasks2,
    calEvents,setCalEvents,
    notes,setNotes,
  };

  const [editMode,setEditMode]=useState(false);

  const TABS=[{id:"home",icon:"⌂",label:"Home"},{id:"nutrition",icon:"◎",label:"Cibo"},{id:"training",icon:"◈",label:"Train"},{id:"calendar",icon:"▦",label:"Piano"},{id:"tasks",icon:"✓",label:"Task"}];

  const confirm=useConfirm();
  // Espone il confirm globalmente per componenti figli senza prop drilling
  React.useEffect(()=>{window.__appConfirm=confirm;return()=>{if(window.__appConfirm===confirm)delete window.__appConfirm;};},[confirm]);

  return(
    <div className="app">
      <ConfirmModal/>

      <div style={{padding:"max(16px, env(safe-area-inset-top)) 16px 0",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <div className="H title-app" style={{fontSize:32,lineHeight:1,letterSpacing:2.5}}>{(profile.name||"App").toUpperCase()}</div>
          <div style={{fontSize:11,color:"rgba(235,235,245,0.3)",marginTop:4,fontWeight:500,letterSpacing:.2,textTransform:"capitalize"}}>{new Date().toLocaleDateString("it-IT",{weekday:"long",day:"numeric",month:"long"})}</div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button onClick={()=>{haptic.light();setEditMode(!editMode);}} aria-label={editMode?"Chiudi impostazioni":"Apri impostazioni"} style={{background:editMode?"rgba(255,255,255,0.14)":"rgba(255,255,255,0.06)",border:`1px solid ${editMode?"rgba(255,255,255,0.3)":"rgba(255,255,255,0.08)"}`,borderRadius:9,padding:"7px 10px",cursor:"pointer",color:editMode?"#FFFFFF":"rgba(235,235,245,0.35)",fontSize:15,fontWeight:600,transition:"all .22s var(--ios)",fontFamily:"var(--font-sys)"}}>⚙</button>
          <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:10,padding:"6px 12px",textAlign:"center",minWidth:52}}>
            <div style={{fontSize:9,color:"rgba(235,235,245,0.3)",fontWeight:700,letterSpacing:.8,textTransform:"uppercase",fontFamily:"var(--font-mono)"}}>STREAK</div>
            <div style={{fontSize:17,color:"#FFFFFF",fontWeight:700,lineHeight:1.2,fontFamily:"var(--font-mono)",letterSpacing:-.5}}>{streak}<span style={{fontSize:10,color:"rgba(235,235,245,0.3)",fontWeight:500,marginLeft:1}}>d</span></div>
          </div>
        </div>
      </div>
      <div className="tc su">
        {editMode
          ? <SettingsTab
              profile={profile} setProfile={setProfile}
              customSchedule={customSchedule||SCHEDULE} setCustomSchedule={setCustomSchedule}
              customMealPlan={customMealPlan||MEAL_PLAN} setCustomMealPlan={setCustomMealPlan}
              tasks={tasks} setTasks={setTasks}
              onClose={()=>setEditMode(false)}
              dailyLogs={dailyLogs} setDailyLogs={setDailyLogs}
              completedDays={completedDays} setCompletedDays={setCompletedDays}
              setStreak={setStreak}
              notes={notes} setNotes={setNotes}
            />
          : <>
              {tab==="home"&&<HomeTab {...p}/>}
              {tab==="nutrition"&&<NutritionTab {...p}/>}
              {tab==="training"&&<TrainingTab {...p}/>}
              {tab==="calendar"&&<CalendarTab calEvents={p.calEvents} setCalEvents={p.setCalEvents}/>}
              {tab==="tasks"&&<TasksTab {...p}/>}
            </>
        }
      </div>
      {!editMode&&<div className="nav">
        {TABS.map(t=>(
          <button key={t.id} className={"nb "+(tab===t.id?"active":"")} onClick={()=>{if(tab!==t.id)haptic.light();setTab(t.id);}}>
            <span className="nb-dot"/>
            <span className="nb-icon">{t.icon}</span>
            <span className="nb-label">{t.label}</span>
          </button>
        ))}
      </div>}
      {gameStatsModal&&(
        <GameStatsModal
          onSave={saveGameStats}
          onCancel={()=>setGameStatsModal(null)}
        />
      )}
    </div>
  );
}


