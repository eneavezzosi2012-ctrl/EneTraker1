function Donut({pct,color,size=86,stroke=8,label,sublabel,children}){
  const r=size/2-stroke;const c=2*Math.PI*r;const f=c*Math.min(pct,100)/100;
  const hasFill=pct>0;
  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5}}>
      <div style={{position:"relative",width:size,height:size}}>
        <svg className="donut-svg" width={size} height={size} style={{transform:"rotate(-90deg)"}}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke}/>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={f+" "+(c-f)} strokeLinecap="round" style={{transition:"stroke-dasharray .9s var(--spring)"}}/>
        </svg>
        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",filter:hasFill?"drop-shadow(0 0 6px "+color+"55)":"none"}}>
          {children||<span style={{fontFamily:"var(--font-mono)",fontSize:13,fontWeight:600,color}}>{Math.round(pct)}%</span>}
        </div>
      </div>
      {label&&<div style={{fontSize:11,fontWeight:600,color:"rgba(255,255,255,0.65)",letterSpacing:.3}}>{label}</div>}
      {sublabel&&<div style={{fontSize:10,color:"rgba(255,255,255,0.28)",textAlign:"center",maxWidth:78}}>{sublabel}</div>}
    </div>
  );
}

// Modal a bottom sheet per l'inserimento dei dati partita
function GameStatsModal({onSave,onCancel}){
  const STAT_KEYS_LOCAL=["Punti","Assist","Rimbalzi","Palle rubate","Falli"];
  const STAT_COLORS_LOCAL={
    "Punti":"#FFFFFF","Assist":"#D4D4D8","Rimbalzi":"#E4E4E7",
    "Palle rubate":"#A1A1AA","Falli":"#9F9FA8",
  };
  const [skipped,setSkipped]=useState(false);
  const [vals,setVals]=useState(()=>{const o={};STAT_KEYS_LOCAL.forEach(k=>{o[k]="";});return o;});
  const [scoreMia,setScoreMia]=useState("");
  const [scoreAvv,setScoreAvv]=useState("");

  function setVal(k,v){setVals(p=>({...p,[k]:v}));}
  function setNA(k){setVals(p=>({...p,[k]:"NA"}));}
  function handleSave(){
    if(skipped){onSave({skipped:true,stats:{},score:null});return;}
    const stats={};
    STAT_KEYS_LOCAL.forEach(k=>{
      const v=vals[k];
      if(v==="NA"||v===""||v==null)stats[k]=null;
      else{const n=Number(v);stats[k]=isNaN(n)?null:n;}
    });
    let score=null;
    const sm=Number(scoreMia),sa=Number(scoreAvv);
    if(scoreMia!==""&&scoreAvv!==""&&!isNaN(sm)&&!isNaN(sa)){
      score={mia:sm,avv:sa};
    }
    onSave({skipped:false,stats,score});
  }

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:400,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={onCancel}>
      <div onClick={e=>e.stopPropagation()}
        style={{background:"#0A0A0A",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"18px 18px 0 0",padding:"20px 16px",width:"100%",maxWidth:430,maxHeight:"88vh",overflowY:"auto"}}>
        <div style={{fontSize:14,fontWeight:700,color:"rgba(255,255,255,0.88)",marginBottom:6}}>🏀 Inserisci i dati della partita</div>
        <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:14}}>I dati saranno disponibili nella sezione Statistiche → Partite.</div>

        {/* Toggle partita saltata */}
        <button onClick={()=>setSkipped(s=>!s)}
          style={{width:"100%",padding:"10px 12px",borderRadius:11,border:"1px solid "+(skipped?"rgba(161,161,170,0.4)":"rgba(255,255,255,0.08)"),background:skipped?"rgba(161,161,170,0.08)":"rgba(255,255,255,0.04)",color:skipped?"#A1A1AA":"rgba(255,255,255,0.6)",fontSize:12,fontWeight:600,cursor:"pointer",marginBottom:12,textAlign:"left",display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:14}}>{skipped?"☑":"☐"}</span>
          <span>Partita saltata (non sono sceso in campo)</span>
        </button>

        {!skipped&&(<>
          {/* Risultato finale */}
          <div style={{padding:"10px 11px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.18)",borderRadius:11,marginBottom:12}}>
            <div style={{fontSize:10,color:"#FFFFFF",fontWeight:700,letterSpacing:.5,marginBottom:7}}>RISULTATO FINALE (opzionale)</div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{flex:1}}>
                <div style={{fontSize:9,color:"rgba(255,255,255,0.4)",fontWeight:600,marginBottom:3}}>Mia squadra</div>
                <input type="number" inputMode="numeric" value={scoreMia} onChange={e=>setScoreMia(e.target.value)} placeholder="0"
                  style={{width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,color:"#FFFFFF",padding:"7px 9px",fontSize:14,fontWeight:700,outline:"none",textAlign:"center",fontFamily:"var(--font-mono)"}}/>
              </div>
              <div style={{fontSize:18,color:"rgba(255,255,255,0.4)",fontWeight:700,marginTop:14}}>–</div>
              <div style={{flex:1}}>
                <div style={{fontSize:9,color:"rgba(255,255,255,0.4)",fontWeight:600,marginBottom:3}}>Avversari</div>
                <input type="number" inputMode="numeric" value={scoreAvv} onChange={e=>setScoreAvv(e.target.value)} placeholder="0"
                  style={{width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,color:"rgba(255,255,255,0.85)",padding:"7px 9px",fontSize:14,fontWeight:700,outline:"none",textAlign:"center",fontFamily:"var(--font-mono)"}}/>
              </div>
            </div>
          </div>

          {STAT_KEYS_LOCAL.map(k=>(
            <div key={k} style={{display:"flex",alignItems:"center",gap:8,marginBottom:9}}>
              <div style={{flex:1,minWidth:0,display:"flex",alignItems:"center",gap:8}}>
                <span style={{display:"inline-block",width:9,height:9,borderRadius:"50%",background:STAT_COLORS_LOCAL[k],flexShrink:0}}/>
                <span style={{fontSize:13,color:"rgba(255,255,255,0.78)",fontWeight:500}}>{k}</span>
              </div>
              <input type="number" inputMode="numeric" value={vals[k]==="NA"?"":vals[k]} onChange={e=>setVal(k,e.target.value)}
                placeholder={vals[k]==="NA"?"N/D":"0"}
                style={{width:70,background:"rgba(255,255,255,0.05)",border:"1px solid "+(vals[k]==="NA"?"rgba(255,255,255,0.2)":"rgba(255,255,255,0.08)"),borderRadius:8,color:vals[k]==="NA"?"rgba(255,255,255,0.4)":STAT_COLORS_LOCAL[k],padding:"7px 9px",fontSize:13,fontWeight:700,outline:"none",textAlign:"right",fontFamily:"var(--font-mono)"}}/>
              <button onClick={()=>setNA(k)}
                style={{padding:"7px 9px",borderRadius:8,border:"1px solid "+(vals[k]==="NA"?"rgba(255,255,255,0.25)":"rgba(255,255,255,0.07)"),background:vals[k]==="NA"?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.03)",color:vals[k]==="NA"?"#fff":"rgba(255,255,255,0.4)",fontSize:10,fontWeight:700,cursor:"pointer",letterSpacing:.3,minWidth:42}}>N/D</button>
            </div>
          ))}
        </>)}

        <div style={{display:"flex",gap:8,marginTop:14}}>
          <button onClick={onCancel} style={{flex:1,padding:"11px",borderRadius:10,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.04)",color:"rgba(255,255,255,0.55)",fontSize:13,cursor:"pointer",fontWeight:600}}>Annulla</button>
          <button onClick={handleSave} style={{flex:2,padding:"11px",borderRadius:10,border:"none",background:"linear-gradient(135deg,#E4E4E7,#FFFFFF)",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",letterSpacing:.3}}>SALVA ✓</button>
        </div>
      </div>
    </div>
  );
}

