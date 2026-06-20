// Calendario di default usato solo se l'utente non ha mai importato un PDF FIP
const DEFAULT_FIP_PARTITE=[];

// Normalizzazione nome squadra per matching robusto (case-insensitive, no punteggiatura)
function normalizeTeamName(s){
  return (s||"")
    .toUpperCase()
    .replace(/[.,'`'’“”"]/g," ")
    .replace(/\s+/g," ")
    .trim();
}

/**
 * Estrae le partite della squadra dall'output testuale di un PDF FIP.
 * @param {string[]} rawLines - linee di testo estratte dal PDF
 * @param {string} teamName - nome della squadra da filtrare
 * @returns {Array} partite nel formato {date, ora, avversario, casa, luogo, indirizzo, giornata, risultato}
 *
 * Strategia di parsing per linea:
 *   "N° Giornata - andata|ritorno del YYYY-MM-DD"   → memorizza giornata + data
 *   "<SQUADRA A>  <SQUADRA B>  <orario o risultato>" → partita
 *   Riga successiva                                   → luogo + indirizzo
 */
function parseFipPdfText(rawLines,teamName){
  const teamN=normalizeTeamName(teamName);
  if(!teamN)return [];
  const lines=rawLines.map(l=>l.trim()).filter(l=>l.length>0);
  const out=[];
  const dropped=[]; // linee scartate, loggate alla fine per debug
  let currentGiornata=null;
  let currentDate=null;
  // Regex tollerante: accetta "1°", "1ª", em-dash, spazi variabili
  const reGiornata=/^(\d+)\s*[°ª]?\s*Giornata\s*[-–—]\s*(andata|ritorno)\s*del\s*(\d{4}-\d{2}-\d{2})/i;
  // Risultato inserito "81 - 67" o orario partita "06/05/26 - 21:00"
  const reResult=/^(\d{1,3})\s*[-–]\s*(\d{1,3})$/;
  const reTime=/(\d{1,2}\/\d{1,2}\/\d{2,4})\s*[-–]\s*(\d{1,2}:\d{2})/;
  const reTimeOnly=/^(\d{1,2}):(\d{2})$/;

  for(let i=0;i<lines.length;i++){
    const ln=lines[i];
    const mg=ln.match(reGiornata);
    if(mg){
      currentGiornata=mg[1]+"ª "+mg[2];
      currentDate=mg[3];
      continue;
    }
    if(!currentDate)continue;

    const upper=normalizeTeamName(ln);
    if(!upper.includes(teamN))continue;

    // Splitter primario: 2+ spazi (layout PDF FIP) con fallback a " vs " / " - "
    // FIP convention: la squadra di casa è la prima, l'ospite la seconda
    let parts=ln.split(/\s{2,}|\t+/).map(p=>p.trim()).filter(p=>p.length>0);
    if(parts.length<2){
      const m=ln.split(/\s+(?:vs|VS|v\.?)\s+/);
      if(m.length>=2)parts=[m[0].trim(),m.slice(1).join(" vs ").trim()];
    }
    let homeText="",awayText="",extra="";
    if(parts.length>=2){
      homeText=parts[0];
      awayText=parts[1];
      extra=parts.slice(2).join(" ");
    } else {
      dropped.push(ln);
      continue;
    }

    const homeN=normalizeTeamName(homeText);
    const awayN=normalizeTeamName(awayText);
    let casa=null;
    if(homeN.includes(teamN)&&!awayN.includes(teamN))casa=true;
    else if(awayN.includes(teamN)&&!homeN.includes(teamN))casa=false;
    else {dropped.push(ln);continue;}

    const avversario=casa?awayText:homeText;

    let ora="";
    let risultato=null;
    const mr=extra.match(reResult);
    if(mr){risultato={mia:casa?Number(mr[1]):Number(mr[2]),avv:casa?Number(mr[2]):Number(mr[1])};}
    const mt=extra.match(reTime);
    if(mt)ora=mt[2];
    else {
      const mto=extra.match(reTimeOnly);
      if(mto)ora=mto[1].padStart(2,"0")+":"+mto[2];
    }

    // La riga successiva contiene tipicamente "luogo - indirizzo"
    let luogo="",indirizzo="";
    if(i+1<lines.length){
      const nxt=lines[i+1];
      if(!reGiornata.test(nxt)){
        const sep=nxt.indexOf(" - ");
        if(sep>=0){luogo=nxt.slice(0,sep).trim();indirizzo=nxt.slice(sep+3).trim();}
        else {luogo=nxt;}
      }
    }

    out.push({
      date:currentDate,
      ora:ora||"",
      avversario:avversario.replace(/\s+/g," ").trim(),
      casa,
      luogo,
      indirizzo,
      giornata:currentGiornata||"",
      risultato,
    });
  }
  if(dropped.length>0){
    console.warn("[FIP parser] "+dropped.length+" linee non riconosciute (con team match):",dropped);
  }
  return out;
}

async function extractTextFromPdf(file){
  const lib=await window.__loadPdfJs();
  const buf=await file.arrayBuffer();
  const pdf=await lib.getDocument({data:buf}).promise;
  const allLines=[];
  for(let p=1;p<=pdf.numPages;p++){
    const page=await pdf.getPage(p);
    const tc=await page.getTextContent();
    // Raggruppa gli items per coordinata y (riga)
    const byLine={};
    tc.items.forEach(it=>{
      const y=Math.round(it.transform[5]);
      if(!byLine[y])byLine[y]=[];
      byLine[y].push({x:it.transform[4],s:it.str});
    });
    Object.keys(byLine)
      .map(Number).sort((a,b)=>b-a) // y decrescente = ordine top→bottom
      .forEach(y=>{
        const sorted=byLine[y].sort((a,b)=>a.x-b.x);
        // Ricostruzione: doppio spazio quando il gap orizzontale supera 8 unità
        let line="";
        for(let i=0;i<sorted.length;i++){
          if(i>0){
            const gap=sorted[i].x-(sorted[i-1].x+(sorted[i-1].s.length*5));
            if(gap>8)line+="  ";
            else line+=" ";
          }
          line+=sorted[i].s;
        }
        allLines.push(line);
      });
  }
  return allLines;
}

// Archivio storico delle stagioni concluse
function SeasonsArchive({onClose}){
  const [seasons,setSeasons]=useState(()=>load("seasons_archive",[]));
  const [renameId,setRenameId]=useState(null);
  const [renameText,setRenameText]=useState("");
  const [expandId,setExpandId]=useState(null);

  function saveSeasonsToStore(updated){
    setSeasons(updated);
    save("seasons_archive",updated);
  }

  function doRename(id){
    if(!renameText.trim())return;
    saveSeasonsToStore(seasons.map(s=>s.id===id?{...s,label:renameText.trim()}:s));
    setRenameId(null);setRenameText("");
  }

  async function doDelete(id){
    if(!await window.__appConfirm("Elimina questa stagione? Le statistiche associate verranno rimosse.",{confirm:"Elimina",cancel:"Annulla"}))return;
    saveSeasonsToStore(seasons.filter(s=>s.id!==id));
  }

  const STAT_KEYS_S=["Punti","Assist","Rimbalzi","Palle rubate","Falli"];

  function getSeasonStats(seasonId){
    const games=load("game_stats",[]);
    const sg=games.filter(g=>g.season===seasonId&&!g.skipped);
    if(!sg.length)return null;
    const avgs={};
    STAT_KEYS_S.forEach(k=>{
      const vs=sg.map(g=>g.stats&&g.stats[k]!==null&&g.stats[k]!==undefined?g.stats[k]:null).filter(v=>v!==null);
      avgs[k]=vs.length>0?(vs.reduce((a,b)=>a+b,0)/vs.length).toFixed(1):"-";
    });
    const wins=sg.filter(g=>g.score&&g.score.mia>g.score.avv).length;
    const losses=sg.filter(g=>g.score&&g.score.mia<g.score.avv).length;
    return{avgs,wins,losses,total:sg.length,totalWithSkipped:games.filter(g=>g.season===seasonId).length};
  }

  if(!seasons.length){
    return(
      <div>
        <button onClick={onClose} style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:9,color:"rgba(255,255,255,0.5)",fontSize:12,padding:"6px 12px",cursor:"pointer",marginBottom:16}}>← Indietro</button>
        <div style={{textAlign:"center",padding:"30px 0",color:"rgba(255,255,255,0.25)",fontSize:13}}>
          <div style={{fontSize:32,marginBottom:10}}>📦</div>
          <div>Nessuna stagione passata archiviata.</div>
          <div style={{fontSize:11,marginTop:6,lineHeight:1.5}}>Le stagioni vengono salvate automaticamente quando importi un nuovo calendario PDF.</div>
        </div>
      </div>
    );
  }

  return(
    <div>
      <button onClick={onClose} style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:9,color:"rgba(255,255,255,0.5)",fontSize:12,padding:"6px 12px",cursor:"pointer",marginBottom:16}}>← Indietro</button>
      <div style={{fontSize:10,color:"rgba(255,255,255,0.28)",fontWeight:600,letterSpacing:.8,marginBottom:12}}>STAGIONI ARCHIVIATE · {seasons.length}</div>
      {seasons.slice().reverse().map(s=>{
        const stats=getSeasonStats(s.id);
        const isExp=expandId===s.id;
        const isRen=renameId===s.id;
        return(
          <div key={s.id} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:14,marginBottom:10,overflow:"hidden"}}>
            {/* Header stagione */}
            <div style={{padding:"12px 14px",display:"flex",alignItems:"center",gap:10}}>
              <div style={{flex:1,minWidth:0}}>
                {isRen?(
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    <input autoFocus value={renameText} onChange={e=>setRenameText(e.target.value)}
                      onKeyDown={e=>{if(e.key==="Enter")doRename(s.id);if(e.key==="Escape"){setRenameId(null);setRenameText("");}}}
                      style={{flex:1,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.35)",borderRadius:8,color:"#fff",padding:"6px 10px",fontSize:13,outline:"none",fontFamily:"inherit"}}/>
                    <button onClick={()=>doRename(s.id)} style={{background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.3)",borderRadius:7,color:"#FFFFFF",fontSize:11,padding:"5px 10px",cursor:"pointer",fontWeight:700}}>✓</button>
                    <button onClick={()=>{setRenameId(null);setRenameText("");}} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:7,color:"rgba(255,255,255,0.35)",fontSize:11,padding:"5px 10px",cursor:"pointer"}}>✕</button>
                  </div>
                ):(
                  <>
                    <div style={{fontSize:14,fontWeight:700,color:"rgba(255,255,255,0.88)"}}>{s.label||("Stagione "+s.id)}</div>
                    {s.archivedAt&&<div style={{fontSize:10,color:"rgba(255,255,255,0.25)",marginTop:2}}>Archiviata il {new Date(s.archivedAt).toLocaleDateString("it-IT",{day:"numeric",month:"long",year:"numeric"})}</div>}
                  </>
                )}
              </div>
              {!isRen&&<div style={{display:"flex",gap:5,flexShrink:0}}>
                <button onClick={()=>{setRenameId(s.id);setRenameText(s.label||("Stagione "+s.id));}} style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:7,color:"rgba(255,255,255,0.35)",fontSize:11,padding:"5px 8px",cursor:"pointer"}}>✏️</button>
                <button onClick={()=>setExpandId(isExp?null:s.id)} style={{background:isExp?"rgba(255,255,255,0.1)":"rgba(255,255,255,0.05)",border:"1px solid "+(isExp?"rgba(255,255,255,0.25)":"rgba(255,255,255,0.09)"),borderRadius:7,color:isExp?"#FFFFFF":"rgba(255,255,255,0.35)",fontSize:11,padding:"5px 10px",cursor:"pointer",fontWeight:600}}>
                  {isExp?"▲ Chiudi":"▼ Dettagli"}
                </button>
                <button onClick={()=>doDelete(s.id)} style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:7,color:"#F5F5F5",fontSize:11,padding:"5px 8px",cursor:"pointer"}}>🗑</button>
              </div>}
            </div>

            {/* Dettagli espansi */}
            {isExp&&(
              <div style={{borderTop:"1px solid rgba(255,255,255,0.05)",padding:"12px 14px"}}>
                {/* Statistiche medie */}
                {stats?(
                  <>
                    <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",fontWeight:600,letterSpacing:.5,marginBottom:8}}>📊 STATISTICHE MEDIE · {stats.total} partite giocate</div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
                      {STAT_KEYS_S.map(k=>(
                        <div key={k} style={{flex:"1 1 80px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:10,padding:"8px 10px",textAlign:"center"}}>
                          <div style={{fontSize:18,fontWeight:700,color:"#FFFFFF",fontFamily:"'JetBrains Mono'"}}>{stats.avgs[k]}</div>
                          <div style={{fontSize:9,color:"rgba(255,255,255,0.35)",marginTop:2,fontWeight:600}}>{k.toUpperCase()}</div>
                        </div>
                      ))}
                    </div>
                    {(stats.wins+stats.losses>0)&&(
                      <div style={{display:"flex",gap:8,marginBottom:10}}>
                        <div style={{flex:1,background:"rgba(228,228,231,0.07)",border:"1px solid rgba(228,228,231,0.18)",borderRadius:10,padding:"8px",textAlign:"center"}}>
                          <div style={{fontSize:20,fontWeight:700,color:"#E4E4E7"}}>{stats.wins}</div>
                          <div style={{fontSize:9,color:"rgba(228,228,231,0.6)",fontWeight:600}}>VITTORIE</div>
                        </div>
                        <div style={{flex:1,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.18)",borderRadius:10,padding:"8px",textAlign:"center"}}>
                          <div style={{fontSize:20,fontWeight:700,color:"#F5F5F5"}}>{stats.losses}</div>
                          <div style={{fontSize:9,color:"rgba(255,255,255,0.6)",fontWeight:600}}>SCONFITTE</div>
                        </div>
                        <div style={{flex:1,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"8px",textAlign:"center"}}>
                          <div style={{fontSize:20,fontWeight:700,color:"rgba(255,255,255,0.7)"}}>{stats.total-(stats.wins+stats.losses)}</div>
                          <div style={{fontSize:9,color:"rgba(255,255,255,0.3)",fontWeight:600}}>PAREGGI/N.R.</div>
                        </div>
                      </div>
                    )}
                  </>
                ):(
                  <div style={{fontSize:12,color:"rgba(255,255,255,0.25)",textAlign:"center",padding:"10px 0",marginBottom:10}}>Nessuna statistica registrata per questa stagione.</div>
                )}

                {/* Partite della stagione */}
                {Array.isArray(s.matches)&&s.matches.length>0&&(
                  <>
                    <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",fontWeight:600,letterSpacing:.5,marginBottom:8}}>📅 PARTITE · {s.matches.length}</div>
                    <div style={{maxHeight:260,overflowY:"auto"}}>
                      {s.matches.map((p,i)=>{
                        const games=load("game_stats",[]);
                        const gameEntry=games.find(g=>g.season===s.id&&g.date===p.date&&g.avversario===p.avversario);
                        return(
                          <div key={i} style={{padding:"8px 10px",marginBottom:6,background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:10}}>
                            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
                              <div style={{fontSize:11,color:"rgba(255,255,255,0.55)",fontWeight:600}}>{p.date} · {p.casa?"🏠 Casa":"✈️ Trasferta"}</div>
                              {gameEntry?.score&&<div style={{fontSize:11,fontWeight:700,color:gameEntry.score.mia>gameEntry.score.avv?"#E4E4E7":gameEntry.score.mia<gameEntry.score.avv?"#F5F5F5":"#A1A1AA",fontFamily:"'JetBrains Mono'"}}>{gameEntry.score.mia}–{gameEntry.score.avv}</div>}
                            </div>
                            <div style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,0.8)"}}>vs {p.avversario}</div>
                            {gameEntry&&!gameEntry.skipped&&gameEntry.stats&&(
                              <div style={{display:"flex",gap:8,marginTop:5,flexWrap:"wrap"}}>
                                {STAT_KEYS_S.filter(k=>gameEntry.stats[k]!==null&&gameEntry.stats[k]!==undefined).map(k=>(
                                  <span key={k} style={{fontSize:10,color:"rgba(255,255,255,0.4)",fontWeight:500}}>
                                    <span style={{color:"#FFFFFF",fontWeight:700}}>{gameEntry.stats[k]}</span> {k}
                                  </span>
                                ))}
                              </div>
                            )}
                            {gameEntry?.skipped&&<div style={{fontSize:10,color:"#A1A1AA",marginTop:4}}>⚡ Non sceso in campo</div>}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PartiteCalendar(){
  const [teamName,setTeamName]=useState(()=>load("fip_team_name","Cerreto Basket"));
  const [partite,setPartite]=useState([]);
  const [showArchive,setShowArchive]=useState(false);
  useEffect(()=>{
    const stored=load("fip_matches",null);
    if(Array.isArray(stored)&&stored.length>0){
      // Distinguiamo partite importate da PDF (campo 'avversario') dai dati legacy hard-coded (campo 'opponent')
      const isLegacy=stored.some(p=>p.opponent&&!p.avversario);
      if(!isLegacy)setPartite(stored);
      else save("fip_matches",[]);
    }
  },[]);
  const [importing,setImporting]=useState(false);
  const [importMsg,setImportMsg]=useState(null);
  const [previewMatches,setPreviewMatches]=useState(null);
  const fileInputRef=useRef(null);

  useEffect(()=>{save("fip_team_name",teamName);},[teamName]);
  useEffect(()=>{save("fip_matches",partite);},[partite]);

  function getArrivoOra(ora){
    if(!ora||!/^\d{1,2}:\d{2}$/.test(ora))return "";
    const[h,m]=ora.split(":").map(Number);const tot=h*60+m-45;
    if(tot<0)return "";
    return `${String(Math.floor(tot/60)).padStart(2,"0")}:${String(tot%60).padStart(2,"0")}`;
  }
  function fmtDate(d){const dt=new Date(d+"T12:00:00");return dt.toLocaleDateString("it-IT",{weekday:"long",day:"numeric",month:"long"});}
  const today=localDateStr();

  async function handleFile(e){
    const f=e.target.files&&e.target.files[0];
    if(!f)return;
    setImporting(true);setImportMsg(null);setPreviewMatches(null);
    try{
      const lines=await extractTextFromPdf(f);
      const parsed=parseFipPdfText(lines,teamName);
      if(parsed.length===0){
        setImportMsg({ok:false,text:`Nessuna partita trovata per "${teamName}". Controlla il nome squadra e il PDF.`});
      } else {
        setPreviewMatches(parsed);
        setImportMsg({ok:true,text:`✓ Trovate ${parsed.length} partite. Controlla e conferma per sostituire il calendario.`});
      }
    }catch(err){
      console.error("[FIP] errore parsing:",err);
      setImportMsg({ok:false,text:"Errore lettura PDF: "+(err.message||err)});
    } finally {
      setImporting(false);
      if(fileInputRef.current)fileInputRef.current.value="";
    }
  }

  function confirmImport(){
    if(!previewMatches)return;
    // Sostituisce solo il calendario corrente: l'archiviazione della stagione è un'azione esplicita
    // (Statistiche → Partite → "Nuova stagione")
    setPartite(previewMatches);
    setPreviewMatches(null);
    setImportMsg({ok:true,text:"✓ Calendario sostituito. Per archiviare la stagione vai in Statistiche → Partite → 🏁 Nuova stagione."});
  }
  function cancelImport(){
    setPreviewMatches(null);
    setImportMsg(null);
  }

  if(showArchive)return<SeasonsArchive onClose={()=>setShowArchive(false)}/>;

  return(
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
        <div style={{fontSize:11,color:"rgba(255,255,255,0.28)",lineHeight:1.5,flex:1}}>
          Calendario partite della tua squadra. A fine stagione importa il nuovo PDF FIP.
        </div>
        <button onClick={()=>setShowArchive(true)}
          style={{flexShrink:0,marginLeft:10,background:"rgba(160,120,255,0.12)",border:"1px solid rgba(160,120,255,0.3)",borderRadius:10,color:"#9F9FA8",fontSize:11,fontWeight:700,padding:"7px 11px",cursor:"pointer",letterSpacing:.2,whiteSpace:"nowrap"}}>
          🏆 Stagioni passate
        </button>
      </div>

      {/* Nome squadra editabile */}
      <div style={{marginBottom:10}}>
        <div style={{fontSize:10,color:"rgba(255,255,255,0.32)",fontWeight:600,letterSpacing:.5,marginBottom:6,textTransform:"uppercase"}}>Nome della tua squadra</div>
        <input value={teamName} onChange={e=>setTeamName(e.target.value)} placeholder="es. Cerreto Basket"
          style={{width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:11,color:"#fff",padding:"10px 12px",fontSize:14,fontWeight:600,outline:"none",fontFamily:"inherit"}}/>
        <div style={{fontSize:10,color:"rgba(255,255,255,0.25)",marginTop:4,lineHeight:1.4}}>Usato per riconoscere le tue partite nel PDF FIP. Non serve esatto al 100%, basta che sia contenuto nel nome ufficiale.</div>
      </div>

      {/* Pulsante svuota calendario */}
      {partite.length>0&&!previewMatches&&(
        <div style={{marginBottom:14,textAlign:"right"}}>
          <button onClick={async()=>{if(await window.__appConfirm("Sei sicuro? Il calendario verrà svuotato.",{confirm:"Svuota",cancel:"Annulla"}))setPartite([]);}}
            style={{background:"transparent",border:"1px solid rgba(255,255,255,0.25)",borderRadius:9,color:"rgba(255,255,255,0.6)",fontSize:11,padding:"5px 12px",cursor:"pointer",fontWeight:600}}>
            🗑 Svuota calendario
          </button>
        </div>
      )}

      {/* Pulsante import PDF */}
      <div style={{marginBottom:14}}>
        <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" onChange={handleFile} style={{display:"none"}}/>
        <button onClick={()=>fileInputRef.current&&fileInputRef.current.click()} disabled={importing||!teamName.trim()}
          style={{width:"100%",padding:"12px",borderRadius:11,border:"1px dashed rgba(255,255,255,0.4)",background:"rgba(255,255,255,0.06)",color:"#FFFFFF",fontSize:13,fontWeight:700,cursor:importing||!teamName.trim()?"not-allowed":"pointer",opacity:importing||!teamName.trim()?0.5:1,letterSpacing:.3}}>
          {importing?"⏳ Lettura PDF…":"📄 Importa calendario FIP da PDF"}
        </button>
      </div>

      {importMsg&&(
        <div style={{marginBottom:12,padding:"11px 13px",borderRadius:11,background:importMsg.ok?"rgba(228,228,231,0.08)":"rgba(255,255,255,0.08)",border:"1px solid "+(importMsg.ok?"rgba(228,228,231,0.22)":"rgba(255,255,255,0.22)"),color:importMsg.ok?"#E4E4E7":"#FFFFFF",fontSize:12,fontWeight:600,lineHeight:1.5}}>
          {importMsg.text}
        </div>
      )}

      {/* Anteprima import */}
      {previewMatches&&(
        <div style={{marginBottom:14,padding:12,borderRadius:12,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.22)"}}>
          <div style={{fontSize:11,fontWeight:700,color:"#FFFFFF",marginBottom:9}}>ANTEPRIMA — {previewMatches.length} partite</div>
          <div style={{maxHeight:180,overflowY:"auto",marginBottom:10}}>
            {previewMatches.map((p,i)=>(
              <div key={i} style={{padding:"6px 0",borderBottom:i<previewMatches.length-1?"1px solid rgba(255,255,255,0.04)":"none",fontSize:11,color:"rgba(255,255,255,0.7)"}}>
                <span style={{color:"#FFFFFF",fontWeight:700}}>{p.date}</span> · {p.casa?"🏠":"✈️"} vs {p.avversario}{p.ora?" · "+p.ora:""}
              </div>
            ))}
          </div>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.7)",marginBottom:10,lineHeight:1.5}}>⚠ Importando, il calendario corrente verrà <b>sostituito</b>. Le statistiche delle partite già giocate non vengono toccate. Per archiviare la stagione, usa "Nuova stagione" da Statistiche.</div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={cancelImport} style={{flex:1,padding:"9px",borderRadius:9,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.04)",color:"rgba(255,255,255,0.55)",fontSize:12,cursor:"pointer",fontWeight:600}}>Annulla</button>
            <button onClick={confirmImport} style={{flex:2,padding:"9px",borderRadius:9,border:"none",background:"linear-gradient(135deg,#E4E4E7,#FFFFFF)",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",letterSpacing:.3}}>Sostituisci calendario ✓</button>
          </div>
        </div>
      )}

      {/* Calendario partite */}
      <div style={{borderTop:"1px solid rgba(255,255,255,0.05)",paddingTop:12,marginTop:6}}>
        <div style={{fontSize:10,color:"rgba(255,255,255,0.32)",fontWeight:600,letterSpacing:.5,marginBottom:10,textTransform:"uppercase"}}>Calendario stagione corrente · {partite.length} partite</div>
        {partite.length===0&&<div style={{fontSize:12,color:"rgba(255,255,255,0.32)",textAlign:"center",padding:"16px 0"}}>Nessuna partita. Importa il PDF FIP qui sopra.</div>}
        {partite.map((p,idx)=>{
          const isPast=p.date<today;const isToday2=p.date===today;
          return(
            <div key={p.date+"_"+idx} style={{marginBottom:12,background:isToday2?"rgba(255,255,255,0.08)":isPast?"rgba(255,255,255,0.015)":"rgba(255,255,255,0.03)",border:"1px solid "+(isToday2?"rgba(255,255,255,0.35)":isPast?"rgba(255,255,255,0.04)":"rgba(255,255,255,0.08)"),borderRadius:14,padding:"13px 14px",opacity:isPast?0.55:1}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                <div>
                  <div style={{fontSize:10,color:isToday2?"#FFFFFF":"rgba(255,255,255,0.35)",fontWeight:700,letterSpacing:.5,textTransform:"uppercase",marginBottom:2}}>{p.giornata||""}{isToday2?" · OGGI 🏆":""}</div>
                  <div style={{fontSize:13,fontWeight:700,color:isPast?"rgba(255,255,255,0.4)":"rgba(255,255,255,0.9)",textTransform:"capitalize"}}>{fmtDate(p.date)}</div>
                </div>
                <span style={{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:8,background:p.casa?"rgba(0,220,130,0.12)":"rgba(0,140,255,0.12)",color:p.casa?"#E4E4E7":"#D4D4D8",border:"1px solid "+(p.casa?"rgba(0,220,130,0.25)":"rgba(0,140,255,0.25)")}}>
                  {p.casa?"🏠 Casa":"✈️ Trasferta"}
                </span>
              </div>
              <div style={{fontSize:14,fontWeight:700,color:"rgba(255,255,255,0.85)",marginBottom:10}}>vs {p.avversario}</div>
              {p.risultato&&(
                <div style={{marginBottom:10,padding:"6px 10px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.18)",borderRadius:8,fontSize:13,fontWeight:700,color:"#FFFFFF",fontFamily:"var(--font-mono)"}}>
                  Risultato: {p.risultato.mia} - {p.risultato.avv} {p.risultato.mia>p.risultato.avv?"✓":p.risultato.mia<p.risultato.avv?"✗":"="}
                </div>
              )}
              {p.ora&&(
                <div style={{display:"flex",flexDirection:"column",gap:5}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{width:28,height:28,borderRadius:8,background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0}}>⏰</div>
                    <div>
                      <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",fontWeight:600}}>PALLA A DUE</div>
                      <div style={{fontSize:14,fontWeight:700,color:"#FFFFFF",fontFamily:"'JetBrains Mono'"}}>{p.ora}</div>
                    </div>
                    {getArrivoOra(p.ora)&&<>
                      <div style={{width:1,height:30,background:"rgba(255,255,255,0.07)",margin:"0 4px"}}/>
                      <div>
                        <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",fontWeight:600}}>ESSERE LÌ ALLE</div>
                        <div style={{fontSize:14,fontWeight:700,color:"#A1A1AA",fontFamily:"'JetBrains Mono'"}}>{getArrivoOra(p.ora)}</div>
                      </div>
                    </>}
                  </div>
                </div>
              )}
              {p.luogo&&<div style={{marginTop:8,fontSize:11,color:"rgba(255,255,255,0.5)",fontWeight:500}}>📍 {p.luogo}{p.indirizzo?" — "+p.indirizzo:""}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BackupRestore(){
  const [mode,setMode]=useState(null); // null | "export" | "import"
  const [exportText,setExportText]=useState("");
  const [importText,setImportText]=useState("");
  const [msg,setMsg]=useState(null);
  const [busy,setBusy]=useState(false);

  function doExport(){
    const keys={};
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i);
      if(k&&k.startsWith("enea_")){try{keys[k]=JSON.parse(localStorage.getItem(k));}catch{keys[k]=localStorage.getItem(k);}}
    }
    setExportText(JSON.stringify(keys,null,2));
    setMode("export");
    setMsg(null);
  }

  function copyExport(){
    if(navigator.clipboard){navigator.clipboard.writeText(exportText).then(()=>setMsg({ok:true,text:"✓ Testo copiato! Incollalo in un file .txt o Notes."})).catch(()=>setMsg({ok:false,text:"⚠ Copia manuale: seleziona tutto il testo qui sopra."}));}
    else{setMsg({ok:false,text:"⚠ Seleziona tutto il testo e copialo manualmente."});}
  }

  // Chiavi di sessione/dispositivo che non vanno ripristinate da un backup
  const SESSION_KEYS=new Set(["enea_current_user","enea_local_accounts","enea_data_version","enea_fip_seeded_v22"]);

  function doImport(){
    if(busy)return;
    try{
      const data=JSON.parse(importText.trim());
      if(typeof data!=="object"||Array.isArray(data))throw new Error("not an object");
      const entries=Object.entries(data);
      if(entries.length===0)throw new Error("empty");
      setBusy(true);
      let count=0,skipped=0;
      const pushQueue=[];
      entries.forEach(([k,v])=>{
        try{
          if(SESSION_KEYS.has(k)){skipped++;return;}
          const cleanKey=k.startsWith("enea_")?k.slice(5):k;
          localStorage.setItem("enea_"+cleanKey,JSON.stringify(v));
          // Push su Firebase in background (best-effort)
          try{
            const cu=localStorage.getItem("enea_current_user");
            if(cu&&window.__firestore&&window.__fbHelpers){
              const {doc,setDoc}=window.__fbHelpers;
              let safe;
              try{safe=JSON.parse(JSON.stringify(v));}catch{safe=undefined;}
              if(safe!==undefined){
                const ref=doc(window.__firestore,"users",cu,"data",cleanKey);
                pushQueue.push(setDoc(ref,{value:safe,updatedAt:Date.now()}));
              }
            }
          }catch{}
          count++;
        }catch{}
      });
      if(count===0){setBusy(false);throw new Error("none saved");}
      setMsg({ok:true,text:`✓ ${count} voci ripristinate${skipped?` (${skipped} chiavi di sessione saltate)`:""}. Sincronizzazione su cloud...`,reload:false});
      Promise.allSettled(pushQueue).then(()=>{
        setBusy(false);
        setMsg({ok:true,text:`✓ ${count} voci ripristinate e sincronizzate. Ricarica per vedere i dati.`,reload:true});
      });
    }catch(e){
      setBusy(false);
      setMsg({ok:false,text:"⚠ Testo non valido. Assicurati di incollare tutto il backup."});
    }
  }

  const tabStyle=(active)=>({flex:1,padding:"10px 0",borderRadius:10,border:"1px solid "+(active?"rgba(255,255,255,0.35)":"rgba(255,255,255,0.08)"),background:active?"rgba(255,255,255,0.12)":"rgba(255,255,255,0.03)",color:active?"#FFFFFF":"rgba(255,255,255,0.4)",fontSize:13,fontWeight:700,cursor:"pointer"});

  return(
    <div>
      <div style={{fontSize:11,color:"rgba(255,255,255,0.28)",marginBottom:16,lineHeight:1.7}}>
        Esporta i tuoi dati come testo, salvalo dove vuoi. Per ripristinarli incollalo qui.
      </div>
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        <button onClick={doExport} style={tabStyle(mode==="export")}>📤 Esporta</button>
        <button onClick={()=>{setMode("import");setMsg(null);}} style={tabStyle(mode==="import")}>📥 Importa</button>
      </div>

      {mode==="export"&&exportText&&(
        <div>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.28)",marginBottom:6,fontWeight:600}}>COPIA TUTTO QUESTO TESTO E SALVALO:</div>
          <textarea readOnly rows={8} value={exportText} onClick={e=>e.target.select()} style={{fontSize:9,lineHeight:1.4,color:"rgba(255,255,255,0.55)",background:"rgba(0,0,0,0.3)"}}/>
          <button onClick={copyExport} className="btn-p" style={{width:"100%",marginTop:8,padding:"12px",fontWeight:700}}>📋 COPIA TUTTO ✓</button>
        </div>
      )}

      {mode==="import"&&(
        <div>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.28)",marginBottom:6,fontWeight:600}}>INCOLLA QUI IL TUO BACKUP:</div>
          <textarea rows={8} value={importText} onChange={e=>setImportText(e.target.value)} disabled={busy} placeholder='Incolla qui il testo del backup...' style={{fontSize:9,lineHeight:1.4,opacity:busy?0.5:1}}/>
          <button onClick={doImport} disabled={busy||!importText.trim()} className="btn-p" style={{width:"100%",marginTop:8,padding:"12px",fontWeight:700,opacity:busy||!importText.trim()?0.5:1,cursor:busy?"wait":"pointer"}}>{busy?"RIPRISTINO IN CORSO…":"RIPRISTINA ✓"}</button>
        </div>
      )}

      {msg&&(
        <div style={{marginTop:12,padding:"12px 15px",borderRadius:12,background:msg.ok?"rgba(228,228,231,0.08)":"rgba(255,255,255,0.08)",border:`1px solid ${msg.ok?"rgba(228,228,231,0.22)":"rgba(255,255,255,0.22)"}`,color:msg.ok?"#E4E4E7":"#FFFFFF",fontSize:13,fontWeight:600,lineHeight:1.5}}>
          {msg.text}
          {msg.reload&&<button onClick={()=>window.location.reload()} style={{display:"block",marginTop:10,width:"100%",padding:"11px",borderRadius:10,border:"none",background:"#E4E4E7",color:"#000",fontWeight:800,cursor:"pointer",fontSize:14}}>RICARICA ORA ↺</button>}
        </div>
      )}
    </div>
  );
}

