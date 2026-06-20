// ── Auth Gate: gestisce login Firebase e caricamento dati iniziale ────────
function LoginScreen({onLogin}){
  const [username,setUsername]=useState("");
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(false);
  const [localAccounts,setLocalAccounts]=useState(()=>{
    try{const v=localStorage.getItem("enea_local_accounts");return v?JSON.parse(v):[];}catch{return[];}
  });

  function addToLocalAccounts(name){
    try{
      const cur=(()=>{try{const v=localStorage.getItem("enea_local_accounts");return v?JSON.parse(v):[];}catch{return[];}})();
      if(!cur.includes(name)){
        cur.push(name);
        localStorage.setItem("enea_local_accounts",JSON.stringify(cur));
        setLocalAccounts(cur);
      }
    }catch{}
  }

  async function doLogin(name,mode){
    const u=(name||"").trim().toLowerCase();
    if(!u){setError("Inserisci un nome utente");return;}
    if(!/^[a-z0-9_-]{1,32}$/.test(u)){setError("Solo lettere, numeri, - e _ (max 32)");return;}
    setError("");setLoading(true);
    try{
      const exists=await fbUserExists(u);
      if(mode==="login"){
        if(!exists){setError("Account non trovato");setLoading(false);return;}
      } else {
        if(exists){setError("Username già in uso");setLoading(false);return;}
        await fbCreateUser(u);
      }
      await fbHydrateLocalStorage(u);
      localStorage.setItem("enea_current_user",u);
      addToLocalAccounts(u);
      onLogin(u);
    }catch(err){
      console.error("[Auth] errore login/crea:",err);
      let msg="Errore di rete. Riprova.";
      const code=err?.code||"";
      const text=err?.message||String(err);
      if(code==="permission-denied"||/permission/i.test(text)){
        msg="Permessi Firestore mancanti. Controlla le Security Rules.";
      } else if(code==="unavailable"||/offline|network/i.test(text)){
        msg="Sei offline o Firestore non risponde.";
      } else if(/firestore|database/i.test(text)){
        msg="Cloud Firestore non abilitato sul progetto?";
      } else if(text){
        msg="Errore: "+text.slice(0,80);
      }
      setError(msg);
      setLoading(false);
    }
  }

  async function quickLogin(name){
    setError("");setLoading(true);
    try{
      const exists=await fbUserExists(name);
      if(!exists){
        // Chiede conferma prima di ricreare un account non più presente sul cloud
        const ok=window.confirm(`L'account "${name}" non esiste più sul cloud (potrebbe essere stato eliminato da un altro dispositivo).\n\nVuoi crearlo da zero? I dati vecchi sono persi.`);
        if(!ok){setLoading(false);return;}
        await fbCreateUser(name);
      }
      await fbHydrateLocalStorage(name);
      localStorage.setItem("enea_current_user",name);
      onLogin(name);
    }catch(err){
      console.error("[Auth] errore quickLogin:",err);
      let msg="Errore di rete. Riprova.";
      const code=err?.code||"";
      const text=err?.message||String(err);
      if(code==="permission-denied"||/permission/i.test(text)){
        msg="Permessi Firestore mancanti. Controlla le Security Rules.";
      } else if(code==="unavailable"||/offline|network/i.test(text)){
        msg="Sei offline o Firestore non risponde.";
      } else if(/firestore|database/i.test(text)){
        msg="Cloud Firestore non abilitato sul progetto?";
      } else if(text){
        msg="Errore: "+text.slice(0,80);
      }
      setError(msg);
      setLoading(false);
    }
  }

  return(
    <div style={{minHeight:"100vh",background:"#000000",color:"#fff",display:"flex",flexDirection:"column",padding:"max(48px, env(safe-area-inset-top)) 24px 32px",maxWidth:430,margin:"0 auto",fontFamily:"-apple-system,BlinkMacSystemFont,'SF Pro Text',system-ui,'Inter',sans-serif"}}>
      {/* ── Header ── */}
      <div style={{textAlign:"center",marginTop:24,marginBottom:40}}>
        <div className="H" style={{fontSize:44,letterSpacing:3,lineHeight:1,color:"#fff"}}>ENEA · TRACKER</div>
        <div style={{fontSize:12,color:"rgba(235,235,245,0.3)",marginTop:8,letterSpacing:.8,textTransform:"uppercase",fontWeight:500}}>Accedi al tuo account</div>
      </div>

      {/* ── Quick access ── */}
      {localAccounts.length>0&&(
        <div style={{marginBottom:28}}>
          <div style={{fontSize:11,color:"rgba(235,235,245,0.3)",fontWeight:700,letterSpacing:.7,textTransform:"uppercase",marginBottom:10}}>Accesso rapido</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {localAccounts.map(a=>(
              <button key={a} disabled={loading} onClick={()=>quickLogin(a)}
                style={{background:"#1C1C1E",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:"14px 16px",color:"#fff",fontSize:15,fontWeight:600,cursor:loading?"wait":"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:12,opacity:loading?0.5:1,transition:"background .18s"}}>
                <div style={{width:36,height:36,borderRadius:9,background:"rgba(255,255,255,0.14)",border:"1px solid rgba(255,255,255,0.22)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:700,color:"#FFFFFF",flexShrink:0}}>
                  {a[0].toUpperCase()}
                </div>
                <span style={{flex:1}}>{a}</span>
                <span style={{color:"rgba(255,255,255,0.22)",fontSize:20,fontWeight:300}}>›</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── New account input ── */}
      <div style={{marginBottom:16}}>
        <div style={{fontSize:11,color:"rgba(235,235,245,0.3)",fontWeight:700,letterSpacing:.7,textTransform:"uppercase",marginBottom:10}}>Nuovo o altro account</div>
        <input
          type="text"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck="false"
          value={username}
          onChange={e=>setUsername(e.target.value)}
          placeholder="Nome utente"
          disabled={loading}
          style={{width:"100%",background:"rgba(118,118,128,0.12)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,color:"#fff",padding:"13px 15px",fontSize:16,outline:"none",fontFamily:"inherit",transition:"border-color .2s, box-shadow .2s"}}
        />
      </div>

      {/* ── Error message ── */}
      {error&&(
        <div style={{background:"rgba(255,69,58,0.08)",border:"1px solid rgba(255,69,58,0.22)",borderRadius:10,padding:"10px 13px",color:"#F5F5F5",fontSize:13,marginBottom:14,fontWeight:500,lineHeight:1.45}}>
          {error}
        </div>
      )}

      {/* ── Actions ── */}
      <div style={{display:"flex",gap:10,flexDirection:"column"}}>
        <button onClick={()=>doLogin(username,"login")} disabled={loading||!username.trim()}
          style={{padding:"14px 18px",borderRadius:12,border:"none",background:loading||!username.trim()?"rgba(118,118,128,0.18)":"#FFFFFF",color:loading||!username.trim()?"rgba(235,235,245,0.28)":"#fff",fontSize:16,fontWeight:600,cursor:loading?"wait":"pointer",letterSpacing:-.1,transition:"background .15s, transform .12s",boxShadow:loading||!username.trim()?"none":"0 4px 16px rgba(255,255,255,0.22)"}}>
          {loading?"Caricamento…":"Accedi"}
        </button>
        <button onClick={()=>doLogin(username,"create")} disabled={loading||!username.trim()}
          style={{padding:"13px 18px",borderRadius:12,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(118,118,128,0.1)",color:"rgba(235,235,245,0.6)",fontSize:15,fontWeight:500,cursor:loading?"wait":"pointer",opacity:loading||!username.trim()?0.4:1,transition:"opacity .15s"}}>
          Crea nuovo account
        </button>
      </div>

      <div style={{flex:1}}/>
      <div style={{textAlign:"center",fontSize:11,color:"rgba(235,235,245,0.2)",marginTop:32,letterSpacing:.2}}>
        I tuoi dati sono sincronizzati su cloud
      </div>
    </div>
  );
}

function LoadingScreen({label}){
  return(
    <div style={{minHeight:"100vh",background:"#000000",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}>
      <div style={{width:36,height:36,border:"2.5px solid rgba(255,255,255,0.14)",borderTopColor:"#FFFFFF",borderRadius:"50%",animation:"spin 0.75s linear infinite"}}/>
      <div style={{fontSize:13,color:"rgba(235,235,245,0.42)",fontWeight:500,letterSpacing:.2}}>{label||"Caricamento…"}</div>
    </div>
  );
}

// Banner fisso in cima alla schermata quando il dispositivo è offline
function OfflineBanner(){
  const [online,setOnline]=useState(()=>navigator.onLine!==false);
  useEffect(()=>{
    const up=()=>setOnline(true);
    const down=()=>setOnline(false);
    window.addEventListener("online",up);
    window.addEventListener("offline",down);
    return()=>{
      window.removeEventListener("online",up);
      window.removeEventListener("offline",down);
    };
  },[]);
  if(online)return null;
  return(
    <div style={{position:"fixed",top:0,left:0,right:0,zIndex:10000,background:"rgba(255,255,255,0.96)",color:"#fff",padding:"8px 16px",fontSize:12,fontWeight:600,textAlign:"center",letterSpacing:.2,boxShadow:"0 1px 0 rgba(0,0,0,0.3)"}}>
      Sei offline — i dati non si stanno sincronizzando
    </div>
  );
}

function AuthGate(){
  const [phase,setPhase]=useState("init");
  const [currentUser,setCurrentUser]=useState(null);

  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      try{
        await fbAwaitReady();
        if(cancelled)return;
        const cu=localStorage.getItem("enea_current_user");
        if(cu){
          // Sessione esistente: ricarica i dati da Firebase per avere la versione più aggiornata
          setPhase("loading");
          try{
            await fbHydrateLocalStorage(cu);
          }catch{}
          if(cancelled)return;
          setCurrentUser(cu);
          setPhase("app");
        } else {
          setPhase("login");
        }
      }catch{
        // Se Firebase non risponde, fallback a localStorage se la sessione esiste ancora
        const cu=localStorage.getItem("enea_current_user");
        if(cu){setCurrentUser(cu);setPhase("app");}
        else setPhase("login");
      }
    })();
    return()=>{cancelled=true;};
  },[]);

  function handleLogin(u){
    setCurrentUser(u);
    setPhase("app");
  }

  function handleLogout(){
    try{localStorage.removeItem("enea_current_user");}catch{}
    setCurrentUser(null);
    setPhase("login");
  }

  // window.__logout espone il logout globalmente: SettingsTab vive dentro App
  // e non può ricevere direttamente il setter di AuthGate
  useEffect(()=>{
    window.__logout=handleLogout;
    return()=>{if(window.__logout===handleLogout)delete window.__logout;};
  });

  if(phase==="init"||phase==="loading")return<><OfflineBanner/><LoadingScreen label={phase==="loading"?"Sincronizzazione…":"Avvio…"}/></>;
  if(phase==="login")return<><OfflineBanner/><LoginScreen onLogin={handleLogin}/></>;
  return<><OfflineBanner/><App key={currentUser}/></>;
}

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(AuthGate));

