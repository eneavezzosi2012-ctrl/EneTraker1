function TrainingTab({sched,exercises,toggleEx,skills,toggleSk,compEx,compSk,total,allDone,trainingDone,markGameDone,skippedEx,setSkippedEx,customSchedule}){
  const isRest=sched.type==="rest";const isGame=sched.type==="game";
  const pct=total>0?Math.round(((compEx+compSk)/total)*100):0;
  return(<>
    {isGame?(
      <div className="card" style={{background:"linear-gradient(135deg,rgba(255,255,255,0.1),rgba(8,9,16,0.96))",border:"1px solid rgba(255,255,255,0.22)",textAlign:"center",padding:"30px 20px"}}>
        <div style={{fontSize:54}}>🏆</div>
        <div className="H" style={{fontSize:38,color:"#FFFFFF",marginTop:10}}>GAME DAY!</div>
        <div style={{fontSize:13,color:"rgba(255,255,255,0.38)",marginTop:7,lineHeight:1.6}}>Warm-up leggero, testa libera.<br/>Vai e divertiti in campo!</div>
        {!trainingDone?<button onClick={markGameDone} className="pulse" style={{marginTop:16,background:"#FFFFFF",border:"none",borderRadius:13,color:"#fff",fontFamily:"'DM Sans'",fontSize:14,fontWeight:700,padding:"12px 30px",cursor:"pointer"}}>HO GIOCATO ✓</button>
        :<div style={{marginTop:13,background:"rgba(228,228,231,0.09)",border:"1px solid rgba(228,228,231,0.2)",borderRadius:12,padding:10}}><span className="H" style={{fontSize:14,color:"#E4E4E7"}}>PARTITA GIOCATA!</span></div>}
      </div>
    ):isRest?(
      <div className="card" style={{textAlign:"center",padding:"30px 20px"}}>
        <div style={{fontSize:54}}>😴</div>
        <div className="H" style={{fontSize:30,marginTop:10,color:"rgba(255,255,255,0.2)"}}>RIPOSO TOTALE</div>
        <div style={{fontSize:13,color:"rgba(255,255,255,0.18)",marginTop:7,lineHeight:1.6}}>Il recupero e parte dell'allenamento.</div>
      </div>
    ):(total===0&&!isGame&&!isRest?(
      <div className="card" style={{textAlign:"center",padding:"24px 16px"}}>
        <div className="icon-clipboard" style={{width:36,height:36,margin:"0 auto",opacity:.5}}></div>
        <div className="H" style={{fontSize:20,marginTop:10,color:"rgba(255,255,255,0.35)"}}>NESSUN PIANO</div>
        <div style={{fontSize:12,color:"rgba(255,255,255,0.18)",marginTop:6,lineHeight:1.6}}>Vai in Impostazioni → Piano allenamento<br/>per personalizzare ogni giorno.</div>
      </div>
    ):(
      <div className="card co" style={{background:"linear-gradient(135deg,rgba(255,255,255,0.08),rgba(8,9,16,0.96))"}}>
        <div style={{fontSize:10,color:"#FFFFFF",fontWeight:600,letterSpacing:.8,marginBottom:5}}>PIANO DI OGGI</div>
        <div style={{fontSize:28}}>{sched.icon}</div>
        <div className="H" style={{fontSize:16,fontWeight:700,marginTop:5}}>{sched.label}</div>
        {sched.note&&<div style={{fontSize:12,color:"rgba(255,255,255,0.32)",marginTop:5,lineHeight:1.5}}>{sched.note}</div>}
        {total>0&&(
          <div style={{marginTop:11}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
              <span style={{fontSize:11,color:"rgba(255,255,255,0.28)"}}>Progresso</span>
              <span style={{fontSize:11,color:allDone?"#E4E4E7":"#FFFFFF",fontWeight:600}}>{compEx+compSk}/{total} · {pct}%</span>
            </div>
            <div className="pbar" style={{height:5}}><div className="pf" style={{width:pct+"%",background:allDone?"linear-gradient(90deg,#E4E4E7,#E4E4E7)":"linear-gradient(90deg,#FFFFFF,#FFFFFF)"}}/></div>
          </div>
        )}
        {allDone&&<div style={{marginTop:10,background:"rgba(228,228,231,0.08)",border:"1px solid rgba(228,228,231,0.2)",borderRadius:11,padding:9,textAlign:"center"}}><span className="H" style={{fontSize:14,color:"#E4E4E7"}}>COMPLETATO!</span></div>}
      </div>
    ))
    }
    {(()=>{
      const blocks=schedDayToBlocks(sched);
      return blocks.map((block,bi)=>{
        const items=block.items||[];
        if(items.length===0)return null;
        const compB=items.filter(it=>exercises[it.name]||skills[it.name]).length;
        const nonSkipItems=items.filter(it=>!skippedEx.has(it.name));
        const compNonSkip=nonSkipItems.filter(it=>exercises[it.name]||skills[it.name]).length;
        return(
        <div key={block.id||bi} className="card">
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:9}}>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.28)",fontWeight:600,letterSpacing:.5}}>{block.icon||"💪"} {(block.title||"BLOCCO "+(bi+1)).toUpperCase()} ({compB}/{items.length})</div>
            <span className="pill po">{items.length>0?Math.round((compB/items.length)*100):0}%</span>
          </div>
          <div className="pbar" style={{marginBottom:12}}><div className="pf" style={{width:(items.length>0?(compB/items.length)*100:0)+"%",background:"linear-gradient(90deg,#E4E4E7,#FFFFFF)"}}/></div>
          {items.map((it,ii)=>{
            const itemKey=it.name||("item_"+bi+"_"+ii);
            const isSkipped=skippedEx.has(it.name);
            const isDone=!!(exercises[it.name]||skills[it.name]);
            function toggleSkipItem(){setSkippedEx(prev=>{const n=new Set(prev);n.has(it.name)?n.delete(it.name):n.add(it.name);return n;});}
            function toggleItem(){
              // Toggle come exercise (le skills ora sono trattate come exercises)
              toggleEx(it.name);
            }
            return(
            <div key={itemKey} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,opacity:isSkipped?0.45:1}}>
              {!isSkipped&&<button className={"ck "+(isDone?"done":"")} onClick={toggleItem}>{isDone?"✓":""}</button>}
              {isSkipped&&<div style={{width:24,height:24,borderRadius:7,background:"rgba(161,161,170,0.1)",border:"1px solid rgba(161,161,170,0.3)",display:"flex",alignItems:"center",justifyContent:"center"}}><span className="icon-ban-inline"></span></div>}
              <span style={{fontSize:16}}>{it.icon||block.icon||"💪"}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:600,color:isSkipped?"rgba(161,161,170,0.5)":isDone?"#FFFFFF":"rgba(255,255,255,0.8)",textDecoration:isSkipped||isDone?"line-through":"none"}}>{it.name||"(senza nome)"}</div>
                <div style={{fontSize:11,color:isSkipped?"rgba(161,161,170,0.35)":"rgba(255,255,255,0.22)"}}>{isSkipped?"non conta":it.sets||""}</div>
              </div>
              <button onClick={toggleSkipItem} style={{background:isSkipped?"rgba(161,161,170,0.12)":"rgba(255,255,255,0.04)",border:"1px solid "+(isSkipped?"rgba(161,161,170,0.3)":"rgba(255,255,255,0.07)"),borderRadius:7,color:isSkipped?"#A1A1AA":"rgba(255,255,255,0.25)",padding:"3px 7px",cursor:"pointer",minWidth:20,minHeight:16}}><span className="icon-ban-inline"></span></button>
            </div>
            );
          })}
        </div>
        );
      });
    })()}
    <div className="card cb">
      <div style={{fontSize:10,color:"#D4D4D8",fontWeight:600,letterSpacing:.5,marginBottom:10}}>PIANO SETTIMANA</div>
      {(()=>{
        const _plan=(customSchedule&&typeof customSchedule==="object")?customSchedule:SCHEDULE;
        return Object.entries(_plan).map(([i,s])=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:9,marginBottom:8,padding:"3px 0"}}>
            <span style={{fontSize:11,color:"rgba(255,255,255,0.2)",fontWeight:600,width:24}}>{DAYS_SHORT[i]}</span>
            <span style={{fontSize:14}}>{s.icon||"💪"}</span>
            <span style={{fontSize:12,color:"rgba(255,255,255,0.4)",lineHeight:1.3}}>{s.label||""}</span>
          </div>
        ));
      })()}
    </div>
  </>);
}


