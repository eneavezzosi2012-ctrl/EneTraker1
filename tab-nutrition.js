function NutritionTab({customMealPlan,meals,setMeals,water,setWater,profile,foodStars,setFoodStars,skippedMeals,setSkippedMeals}){
  const [openPlan,setOpenPlan]=useState(null);
  const [mealStars,setMealStars]=useState(()=>load("mstars_"+todayStr(),{}));
  useEffect(()=>{
    save("mstars_"+todayStr(),mealStars);
    const r=Object.values(mealStars).filter(v=>v>0);
    setFoodStars(r.length>0?Math.round(r.reduce((a,b)=>a+b,0)/r.length):0);
  },[mealStars]);
  const wMl=water*250;
  const r=Object.values(mealStars).filter(v=>v>0);
  const avg=r.length>0?(r.reduce((a,b)=>a+b,0)/r.length).toFixed(1):null;
  const sc=s=>s>=4?"#E4E4E7":s>=3?"#A1A1AA":s?"#71717A":"rgba(255,255,255,0.2)";
  const lbl=s=>(["","Pessimo","Male","Normale","Bene","Ottimo"])[Math.round(s)]||"";
  return(<>
    <div className="card cb">
      <div style={{fontSize:10,color:"#D4D4D8",fontWeight:600,letterSpacing:.5,marginBottom:11}}>IDRATAZIONE</div>
      <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:13}}>
        <div>
          <div className="H" style={{fontSize:36,color:"#D4D4D8",lineHeight:1,fontWeight:700}}>{wMl}ml</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.22)",marginTop:2}}>{wMl>=2000?"Obiettivo raggiunto!":wMl>=1500?"Quasi ci sei":"Continua a bere"} · /2000ml</div>
        </div>
        <div style={{flex:1}}>
          <div className="pbar" style={{height:8}}><div className="pf" style={{width:Math.min((wMl/2000)*100,100)+"%",background:"linear-gradient(90deg,#FFFFFF,#D4D4D8)"}}/></div>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.22)",marginTop:4}}>{Math.round((wMl/2000)*100)}%</div>
        </div>
      </div>
      <div style={{display:"flex",gap:7}}>
        <button className="wb" onClick={()=>{haptic.light();setWater(w=>Math.max(0,w-1));}}>-</button>
        <button className="wb" style={{flex:1}} onClick={()=>{haptic.light();setWater(w=>w+1);}}>+250ml</button>
        <button className="wb" onClick={()=>{haptic.medium();setWater(0);}} style={{color:"#FFFFFF",borderColor:"rgba(255,255,255,0.2)"}}>reset</button>
      </div>
    </div>
    {MEALS.map((meal,i)=>{
      const stars=mealStars[meal]||0;
      const activePlan=customMealPlan||MEAL_PLAN;
      const plan=activePlan[meal];
      const isOpen=openPlan===meal;
      const isMealSkipped=skippedMeals.has(meal);
      function toggleMealSkip(){setSkippedMeals(prev=>{const n=new Set(prev);n.has(meal)?n.delete(meal):n.add(meal);return n;});}
      return(
        <div key={meal} className="card" style={{opacity:isMealSkipped?0.55:1,borderColor:isMealSkipped?"rgba(161,161,170,0.3)":"rgba(255,255,255,0.065)"}}>
          <div style={{display:"flex",alignItems:"center",gap:11}}>
            <span style={{fontSize:20,flexShrink:0}}>{MEAL_ICONS[i]}</span>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                <div className="H" style={{fontSize:14,fontWeight:600,color:isMealSkipped?"rgba(255,255,255,0.35)":"#fff"}}>{meal}</div>
                {isMealSkipped&&<span style={{fontSize:9,color:"#A1A1AA",fontWeight:700,background:"rgba(161,161,170,0.12)",padding:"2px 6px",borderRadius:6,letterSpacing:.3}}>⚡ SALTATO</span>}
              </div>
              {!isMealSkipped&&<StarRating value={stars} onChange={v=>setMealStars(p=>({...p,[meal]:v}))}/>}
              {isMealSkipped&&<div style={{fontSize:11,color:"rgba(161,161,170,0.5)"}}>Non conta nella media</div>}
            </div>
            <div style={{textAlign:"right",flexShrink:0,display:"flex",flexDirection:"column",gap:5,alignItems:"flex-end"}}>
              <button onClick={toggleMealSkip} style={{background:isMealSkipped?"rgba(161,161,170,0.15)":"rgba(255,255,255,0.04)",border:"1px solid "+(isMealSkipped?"rgba(161,161,170,0.4)":"rgba(255,255,255,0.08)"),borderRadius:8,color:isMealSkipped?"#A1A1AA":"rgba(255,255,255,0.3)",fontSize:12,padding:"4px 9px",cursor:"pointer",fontWeight:700,transition:"all .2s"}}>⚡</button>
              {!isMealSkipped&&<button onClick={()=>setOpenPlan(isOpen?null:meal)} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:8,color:"rgba(255,255,255,0.28)",fontSize:11,padding:"3px 9px",cursor:"pointer"}}>
                Piano <span style={{display:"inline-block",transform:isOpen?"rotate(180deg)":"none",transition:"transform .2s"}}>▾</span>
              </button>}
            </div>
          </div>
          {isOpen&&plan&&(
            <div style={{marginTop:11,paddingTop:11,borderTop:"1px solid rgba(255,255,255,0.06)"}}>
              <div style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:9,padding:"7px 11px",marginBottom:9}}>
                <div style={{fontSize:10,color:"#FFFFFF",fontWeight:600,letterSpacing:.5,marginBottom:2}}>TARGET</div>
                <div style={{fontSize:12,color:"rgba(255,255,255,0.52)",lineHeight:1.5}}>{plan.target}</div>
              </div>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.22)",fontWeight:600,letterSpacing:.5,marginBottom:5}}>ESEMPI</div>
              {plan.examples.map((ex,j)=><div key={j} style={{fontSize:12,color:"rgba(255,255,255,0.45)",lineHeight:1.55,marginBottom:4,paddingLeft:8,borderLeft:"2px solid rgba(255,255,255,0.07)"}}>{ex}</div>)}
              {plan.warning&&<div style={{marginTop:8,background:"rgba(161,161,170,0.05)",border:"1px solid rgba(161,161,170,0.1)",borderRadius:9,padding:"7px 11px"}}><div style={{fontSize:11,color:"rgba(161,161,170,0.72)",lineHeight:1.4}}>{plan.warning}</div></div>}
            </div>
          )}
        </div>
      );
    })}
    <div className="card" style={{borderColor:"rgba(255,255,255,0.2)",background:"rgba(255,255,255,0.04)"}}>
      <div style={{fontSize:10,color:"#FFFFFF",fontWeight:600,letterSpacing:.5,marginBottom:7}}>💪 POST-ALLENAMENTO (entro 30-45 min)</div>
      {["🥛 Latte 300ml + 3 cucchiai cacao + 2 fette pane con miele","🥛 Yogurt greco (vasetto grande) + banana + miele","🍳 2-3 uova + pane + succo di frutta"].map((t,i)=><div key={i} style={{fontSize:12,color:"rgba(255,255,255,0.45)",lineHeight:1.55,marginBottom:4,paddingLeft:8,borderLeft:"2px solid rgba(255,255,255,0.2)"}}>{t}</div>)}
    </div>
  </>);
}

