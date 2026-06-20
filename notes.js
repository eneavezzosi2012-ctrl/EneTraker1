function stripHtml(html){
  if(!html)return "";
  const tmp=document.createElement("div");
  tmp.innerHTML=html;
  return (tmp.textContent||tmp.innerText||"").trim();
}
function fmtNoteDate(ts){
  if(!ts)return "";
  const d=new Date(ts);
  const now=new Date();
  const sameDay=d.toDateString()===now.toDateString();
  const yest=new Date(now);yest.setDate(now.getDate()-1);
  const time=d.toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit"});
  if(sameDay)return "Oggi "+time;
  if(d.toDateString()===yest.toDateString())return "Ieri "+time;
  if((now-d)<7*864e5){
    const wd=d.toLocaleDateString("it-IT",{weekday:"long"});
    return wd.charAt(0).toUpperCase()+wd.slice(1)+" "+time;
  }
  if(d.getFullYear()===now.getFullYear()){
    return d.toLocaleDateString("it-IT",{day:"2-digit",month:"2-digit"})+" "+time;
  }
  return d.toLocaleDateString("it-IT",{day:"2-digit",month:"2-digit",year:"2-digit"});
}

// Se il titolo è vuoto, usa la prima riga del corpo come titolo automatico
// (comportamento nativo di Apple Notes)
function deriveTitle(title,body){
  const t=(title||"").trim();
  if(t)return t;
  const plain=stripHtml(body||"");
  if(!plain)return "Nuova nota";
  const firstLine=plain.split("\n")[0].trim();
  if(!firstLine)return "Nuova nota";
  return firstLine.length>60?firstLine.slice(0,60)+"…":firstLine;
}

// Anteprima note nella Home (massimo 3, pinnate in cima)
function NoteCard({notes,setNotes}){
  const [editor,setEditor]=useState(null);
  // Ordina: pinnate prima, poi per data aggiornamento decrescente
  const sorted=React.useMemo(()=>[...(notes||[])].sort((a,b)=>{
    if((a.pinned?1:0)!==(b.pinned?1:0))return (b.pinned?1:0)-(a.pinned?1:0);
    return (b.updatedAt||0)-(a.updatedAt||0);
  }),[notes]);
  const pinned=sorted.filter(n=>n.pinned).slice(0,2);
  const others=sorted.filter(n=>!n.pinned).slice(0,3-pinned.length);
  const preview=[...pinned,...others];

  function openNew(){haptic.medium();setEditor({title:"",body:"",pinned:false});}
  function openExisting(n){haptic.light();setEditor({...n});}
  function saveEditor(){
    if(!editor)return;
    const cleanBody=(editor.body||"").trim();
    if(!(editor.title||"").trim()&&!stripHtml(cleanBody)){setEditor(null);return;}
    const finalTitle=deriveTitle(editor.title,cleanBody);
    haptic.success();
    const ts=Date.now();
    if(editor.id){
      setNotes(prev=>prev.map(n=>n.id===editor.id?{...n,title:finalTitle,body:cleanBody,pinned:!!editor.pinned,updatedAt:ts}:n));
    } else {
      setNotes(prev=>[{id:genId(),title:finalTitle,body:cleanBody,pinned:!!editor.pinned,createdAt:ts,updatedAt:ts},...prev]);
    }
    setEditor(null);
  }
  function deleteEditor(){
    if(!editor||!editor.id){setEditor(null);return;}
    haptic.warn();
    setNotes(prev=>prev.filter(n=>n.id!==editor.id));
    setEditor(null);
  }

  function renderRow(n){
    const txt=stripHtml(n.body);
    const snippet=txt.length>120?txt.slice(0,120)+"…":txt;
    return(
      <button key={n.id} onClick={()=>openExisting(n)} className={"note-row"+(n.pinned?" pinned":"")}>
        <div className="note-icon"></div>
        <div style={{flex:1,minWidth:0}}>
          <div className="note-title">{n.title||"Senza titolo"}</div>
          {snippet&&<div className="note-snippet">{snippet}</div>}
          <div className="note-meta">{fmtNoteDate(n.updatedAt)}</div>
        </div>
      </button>
    );
  }

  return(
    <div className="card">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div className="sechdr" style={{color:"rgba(161,161,170,0.6)",display:"flex",alignItems:"center",gap:5}}><span className="icon-note-inline"></span>NOTE {notes&&notes.length>0?<span style={{color:"rgba(255,255,255,0.25)",marginLeft:4}}>· {notes.length}</span>:null}</div>
        <button onClick={openNew} style={{background:"linear-gradient(135deg,rgba(161,161,170,0.18),rgba(255,255,255,0.1))",border:"1px solid rgba(161,161,170,0.32)",borderRadius:9,color:"#A1A1AA",fontSize:12,padding:"5px 12px",cursor:"pointer",fontWeight:700,letterSpacing:.2,boxShadow:"0 2px 8px rgba(161,161,170,0.15)"}}>＋ Nuova</button>
      </div>
      {preview.length===0?(
        <div style={{fontSize:13,color:"rgba(255,255,255,0.3)",padding:"18px 0",textAlign:"center",lineHeight:1.5}}>
          <div className="icon-note-empty" style={{marginBottom:6,opacity:.5}}></div>
          Nessuna nota.<br/>Tocca <span style={{color:"#A1A1AA",fontWeight:700}}>＋ Nuova</span> per crearne una.
        </div>
      ):(<>
        {pinned.length>0&&<div className="note-section-hdr"><span className="icon-pin-inline"></span> In alto</div>}
        {pinned.map(renderRow)}
        {others.length>0&&pinned.length>0&&<div className="note-section-hdr gray" style={{marginTop:10}}>Tutte</div>}
        {others.map(renderRow)}
      </>)}
      {notes&&notes.length>preview.length&&<div style={{fontSize:11,color:"rgba(255,255,255,0.3)",textAlign:"center",marginTop:8,fontStyle:"italic"}}>+ altre {notes.length-preview.length} note in Impostazioni → Note</div>}
      {editor&&<NoteEditor editor={editor} setEditor={setEditor} onSave={saveEditor} onDelete={deleteEditor}/>}
    </div>
  );
}

// Archivio completo note (sezione Impostazioni) con ricerca full-text
function NotesArchive({notes,setNotes}){
  const [editor,setEditor]=useState(null);
  const [search,setSearch]=useState("");
  // Indice memoizzato per non ri-strippare HTML ad ogni keystroke della ricerca
  const indexed=React.useMemo(()=>(notes||[]).map(n=>({
    n,
    _t:(n.title||"").toLowerCase(),
    _b:stripHtml(n.body).toLowerCase(),
  })),[notes]);
  const sorted=React.useMemo(()=>[...indexed].sort((a,b)=>{
    if((a.n.pinned?1:0)!==(b.n.pinned?1:0))return (b.n.pinned?1:0)-(a.n.pinned?1:0);
    return (b.n.updatedAt||0)-(a.n.updatedAt||0);
  }),[indexed]);
  const q=search.trim().toLowerCase();
  const filtered=q?sorted.filter(x=>x._t.includes(q)||x._b.includes(q)):sorted;
  const pinnedF=filtered.filter(x=>x.n.pinned).map(x=>x.n);
  const otherF=filtered.filter(x=>!x.n.pinned).map(x=>x.n);

  function openNew(){haptic.medium();setEditor({title:"",body:"",pinned:false});}
  function openExisting(n){haptic.light();setEditor({...n});}
  function saveEditor(){
    if(!editor)return;
    const cleanBody=(editor.body||"").trim();
    if(!(editor.title||"").trim()&&!stripHtml(cleanBody)){setEditor(null);return;}
    const finalTitle=deriveTitle(editor.title,cleanBody);
    haptic.success();
    const ts=Date.now();
    if(editor.id){
      setNotes(prev=>prev.map(n=>n.id===editor.id?{...n,title:finalTitle,body:cleanBody,pinned:!!editor.pinned,updatedAt:ts}:n));
    } else {
      setNotes(prev=>[{id:genId(),title:finalTitle,body:cleanBody,pinned:!!editor.pinned,createdAt:ts,updatedAt:ts},...prev]);
    }
    setEditor(null);
  }
  function deleteEditor(){
    if(!editor||!editor.id){setEditor(null);return;}
    haptic.warn();
    setNotes(prev=>prev.filter(n=>n.id!==editor.id));
    setEditor(null);
  }

  function renderRow(n){
    const txt=stripHtml(n.body);
    const snippet=txt.length>140?txt.slice(0,140)+"…":txt;
    return(
      <button key={n.id} onClick={()=>openExisting(n)} className={"note-row"+(n.pinned?" pinned":"")}>
        <div className="note-icon"></div>
        <div style={{flex:1,minWidth:0}}>
          <div className="note-title">{n.title||"Senza titolo"}</div>
          {snippet&&<div className="note-snippet">{snippet}</div>}
          <div className="note-meta">{fmtNoteDate(n.updatedAt)}</div>
        </div>
      </button>
    );
  }

  return(
    <div>
      {/* Search bar iOS-style */}
      <div className="note-search">
        <span className="icon-search"></span>
        <input placeholder="Cerca nelle note" value={search} onChange={e=>setSearch(e.target.value)}/>
        {search&&<button onClick={()=>setSearch("")} style={{background:"rgba(255,255,255,0.1)",border:"none",borderRadius:"50%",width:18,height:18,color:"rgba(255,255,255,0.5)",fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>✕</button>}
      </div>
      <button onClick={openNew} className="btn-p" style={{width:"100%",padding:"12px",fontSize:14,marginBottom:14}}>＋ Nuova nota</button>

      {filtered.length===0?(
        <div style={{fontSize:13,color:"rgba(255,255,255,0.28)",textAlign:"center",padding:"36px 0",lineHeight:1.6}}>
          <div className="icon-note-empty" style={{marginBottom:8,opacity:.5}}></div>
          {q?"Nessuna nota corrisponde alla ricerca.":"Nessuna nota. Tocca + Nuova per crearne una."}
        </div>
      ):(<>
        {pinnedF.length>0&&<>
          <div className="note-section-hdr"><span className="icon-pin-inline"></span> In alto · {pinnedF.length}</div>
          {pinnedF.map(renderRow)}
        </>}
        {otherF.length>0&&<>
          {pinnedF.length>0&&<div className="note-section-hdr gray" style={{marginTop:14}}>Tutte · {otherF.length}</div>}
          {otherF.map(renderRow)}
        </>}
      </>)}
      {editor&&<NoteEditor editor={editor} setEditor={setEditor} onSave={saveEditor} onDelete={deleteEditor}/>}
    </div>
  );
}

// Editor note full-screen (sheet iOS-style con toolbar flottante)
function NoteEditor({editor,setEditor,onSave,onDelete}){
  const bodyRef=useRef(null);
  const titleRef=useRef(null);
  const [showFormat,setShowFormat]=useState(false);
  const [activeFmt,setActiveFmt]=useState({bold:false,italic:false,underline:false,strike:false,block:"P"});

  // Legge lo stato di formattazione nel punto del cursore, per evidenziare i pulsanti attivi
  function refreshActiveFmt(){
    try{
      const block=(document.queryCommandValue("formatBlock")||"P").toUpperCase();
      setActiveFmt({
        bold:document.queryCommandState("bold"),
        italic:document.queryCommandState("italic"),
        underline:document.queryCommandState("underline"),
        strike:document.queryCommandState("strikeThrough"),
        block,
      });
    }catch(e){/* queryCommandState non disponibile: ignora */}
  }

  // Resetta il body e sincronizza il placeholder quando si apre una nota diversa
  useEffect(()=>{
    if(bodyRef.current&&typeof editor.body==="string"){
      bodyRef.current.innerHTML=editor.body;
      updateEmptyClass();
    }
    // Auto-focus sul titolo solo per le note nuove
    if(!editor.id&&!editor.title&&titleRef.current){
      setTimeout(()=>titleRef.current&&titleRef.current.focus(),350);
    }
  // eslint-disable-next-line
  },[editor.id]);

  // Blocca lo scroll del body con position:fixed (più stabile su iOS) e lo ripristina alla chiusura
  useEffect(()=>{
    const scrollY=window.scrollY;
    const prevPos=document.body.style.position;
    const prevTop=document.body.style.top;
    const prevWidth=document.body.style.width;
    document.body.style.position="fixed";
    document.body.style.top=`-${scrollY}px`;
    document.body.style.width="100%";
    return()=>{
      document.body.style.position=prevPos;
      document.body.style.top=prevTop;
      document.body.style.width=prevWidth;
      window.scrollTo(0,scrollY);
    };
  },[]);

  // Sposta la toolbar sopra la tastiera su iOS (tramite visualViewport)
  useEffect(()=>{
    if(!window.visualViewport)return;
    function adjust(){
      const tb=document.querySelector(".note-toolbar");
      if(!tb)return;
      const offset=window.innerHeight-window.visualViewport.height-(window.visualViewport.offsetTop||0);
      tb.style.transform=offset>0?`translateY(${-offset}px)`:"";
    }
    window.visualViewport.addEventListener("resize",adjust);
    window.visualViewport.addEventListener("scroll",adjust);
    return()=>{
      window.visualViewport.removeEventListener("resize",adjust);
      window.visualViewport.removeEventListener("scroll",adjust);
    };
  },[]);

  // Aggiorna la classe is-empty per mostrare/nascondere il placeholder (gestisce edge case come <h3><br></h3>)
  function updateEmptyClass(){
    if(!bodyRef.current)return;
    const html=bodyRef.current.innerHTML;
    const isEmpty=/^(\s|<br\s*\/?>|<div><br\s*\/?><\/div>|<p>(\s|<br\s*\/?>)?<\/p>|<h\d>(\s|<br\s*\/?>)?<\/h\d>)*$/i.test(html);
    bodyRef.current.classList.toggle("is-empty",isEmpty);
  }

  // Salva e ripristina la selezione prima di execCommand (su iOS viene persa facilmente)
  function exec(cmd,val){
    haptic.light();
    if(!bodyRef.current)return;
    const sel=window.getSelection();
    // Se il cursore non è nel body, lo posiziona alla fine
    if(!sel||sel.rangeCount===0||!bodyRef.current.contains(sel.anchorNode)){
      bodyRef.current.focus();
      const r=document.createRange();
      r.selectNodeContents(bodyRef.current);
      r.collapse(false);
      if(sel){sel.removeAllRanges();sel.addRange(r);}
    }
    try{document.execCommand(cmd,false,val);}catch(e){console.warn("execCommand failed:",cmd,e);}
    syncBody();
    refreshActiveFmt();
  }
  function syncBody(){
    if(!bodyRef.current)return;
    updateEmptyClass();
    setEditor(prev=>({...prev,body:bodyRef.current.innerHTML}));
  }
  function insertChecklist(){
    haptic.light();
    if(!bodyRef.current)return;
    bodyRef.current.focus();
    const sel=window.getSelection();
    if(!sel||sel.rangeCount===0||!bodyRef.current.contains(sel.anchorNode)){
      const r=document.createRange();
      r.selectNodeContents(bodyRef.current);
      r.collapse(false);
      if(sel){sel.removeAllRanges();sel.addRange(r);}
    }
    try{
      // Inserisce un checkbox HTML reale (non più il carattere Unicode ☐)
      document.execCommand("insertHTML",false,'<span class="note-checkbox" contenteditable="false"></span>&nbsp;');
    }catch(e){console.warn("insertChecklist failed:",e);}
    syncBody();
  }
  function handleBodyClick(e){
    // Tap su un .note-checkbox → toggla checked/unchecked
    const cb=e.target.closest&&e.target.closest(".note-checkbox");
    if(cb&&bodyRef.current&&bodyRef.current.contains(cb)){
      haptic.success();
      cb.classList.toggle("checked");
      const line=cb.closest(".checklist-line");
      if(line)line.classList.toggle("done",cb.classList.contains("checked"));
      syncBody();
      return;
    }
    refreshActiveFmt();
  }

  function togglePin(){
    haptic.light();
    setEditor(prev=>({...prev,pinned:!prev.pinned}));
  }

  const metaDate=editor.updatedAt?fmtNoteDate(editor.updatedAt):(editor.id?"Nota":"Nuova nota");

  // Render via Portal su document.body per evitare che i parent con backdrop-filter
  // collassino position:fixed dell'overlay
  const ui=(
    <div className="note-overlay" onClick={()=>setEditor(null)}>
      <div className="note-sheet" onClick={e=>e.stopPropagation()}>
        {/* Drag handle */}
        <div className="note-drag" onClick={()=>setEditor(null)}>
          <div className="note-drag-bar"/>
        </div>

        {/* Header iOS-style: Annulla sx, azioni dx */}
        <div className="note-sheet-hdr">
          <button className="note-hdr-btn" onClick={()=>setEditor(null)} aria-label="Annulla">Annulla</button>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <button className={"note-hdr-btn icon icon-pin "+(editor.pinned?"pinned":"")} onClick={togglePin} title={editor.pinned?"Rimuovi pin":"Pin"} aria-label={editor.pinned?"Rimuovi pin":"Aggiungi pin"}></button>
            {editor.id&&<button className="note-hdr-btn icon danger icon-trash" onClick={async()=>{if(await window.__appConfirm("Eliminare questa nota?",{confirm:"Elimina",cancel:"Annulla"}))onDelete();}} aria-label="Elimina nota"></button>}
            <button className="note-hdr-btn bold" onClick={onSave} aria-label="Salva nota" title="Fine"></button>
          </div>
        </div>

        {/* Meta date */}
        <div className="note-meta-bar">{metaDate}</div>

        {/* Big title */}
        <input
          ref={titleRef}
          className="note-title-input"
          placeholder="Titolo"
          aria-label="Titolo della nota"
          value={editor.title}
          onChange={e=>setEditor(prev=>({...prev,title:e.target.value}))}
        />

        {/* Body contentEditable */}
        <div
          ref={bodyRef}
          className="note-body"
          contentEditable
          role="textbox"
          aria-multiline="true"
          aria-label="Corpo della nota"
          suppressContentEditableWarning
          data-placeholder="Inizia a scrivere..."
          onInput={syncBody}
          onBlur={syncBody}
          onClick={handleBodyClick}
          onKeyUp={refreshActiveFmt}
        />

        {/* Toolbar fluttuante in basso stile iOS */}
        <div className="note-toolbar">
          <button className="note-tb-btn title" type="button" onClick={()=>{refreshActiveFmt();setShowFormat(true);haptic.light();}} title="Formato" aria-label="Apri menu formato">Aa</button>
          <div className="note-tb-divider"/>
          <button className="note-tb-btn" type="button" onClick={insertChecklist} title="Lista di controllo" aria-label="Lista di controllo"><span className="tb-ico checklist"></span></button>
          <button className="note-tb-btn" type="button" onClick={()=>exec("insertHTML",'<table><tr><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td>&nbsp;</td><td>&nbsp;</td></tr></table>')} title="Tabella" aria-label="Inserisci tabella"><span className="tb-ico table"></span></button>
          <button className="note-tb-btn" type="button" title="Allegato" aria-label="Aggiungi allegato"><span className="tb-ico attach"></span></button>
          <button className="note-tb-btn" type="button" title="Markup" aria-label="Disegna con il pennarello"><span className="tb-ico markup"></span></button>
        </div>

        {/* Menu Formato — pillole Titolo/Sottointestazione/Corpo + B/I/U/S */}
        {showFormat&&(
          <div className="note-format-overlay" onClick={()=>setShowFormat(false)}>
            <div className="note-format-sheet" onClick={e=>e.stopPropagation()}>
              <div className="note-format-hdr">
                <div className="note-format-title">Formato</div>
                <button className="note-format-close" onClick={()=>setShowFormat(false)} aria-label="Chiudi formato"></button>
              </div>
              <div className="note-format-row" role="group" aria-label="Stile testo">
                <button className={"note-format-pill heading"+(activeFmt.block==="H1"?" selected":"")} onClick={()=>exec("formatBlock","H1")}>Titolo</button>
                <button className={"note-format-pill subheading"+(activeFmt.block==="H3"?" selected":"")} onClick={()=>exec("formatBlock","H3")}>Sottointestazione</button>
                <button className={"note-format-pill"+(activeFmt.block==="P"||activeFmt.block==="DIV"?" selected":"")} onClick={()=>exec("formatBlock","P")}>Corpo</button>
              </div>
              <div className="note-format-icons">
                <button className={"note-format-icon-btn"+(activeFmt.bold?" selected":"")} onClick={()=>exec("bold")} aria-label="Grassetto">B</button>
                <button className={"note-format-icon-btn italic"+(activeFmt.italic?" selected":"")} onClick={()=>exec("italic")} aria-label="Corsivo">I</button>
                <button className={"note-format-icon-btn under"+(activeFmt.underline?" selected":"")} onClick={()=>exec("underline")} aria-label="Sottolineato">U</button>
                <button className={"note-format-icon-btn strike"+(activeFmt.strike?" selected":"")} onClick={()=>exec("strikeThrough")} aria-label="Barrato">S</button>
              </div>
              <div className="note-format-list-row">
                <button className="note-tb-btn" type="button" onClick={()=>exec("insertUnorderedList")} title="Elenco puntato" aria-label="Elenco puntato">•</button>
                <button className="note-tb-btn" type="button" onClick={()=>exec("insertOrderedList")} title="Elenco numerato" aria-label="Elenco numerato">1.</button>
                <button className="note-tb-btn" type="button" onClick={insertChecklist} title="Lista di controllo" aria-label="Lista di controllo"><span className="tb-ico checklist"></span></button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
  return ReactDOM.createPortal(ui,document.body);
}

function StarRating({value,onChange,size=19}){
  return(
    <div style={{display:"flex",gap:2}}>
      {[1,2,3,4,5].map(s=>(
        <button key={s} onClick={()=>{haptic.light();onChange(value===s?0:s);}} className={"starbtn "+(s<=value?"on":"")} style={{fontSize:size,lineHeight:1,color:s<=value?"#A1A1AA":"rgba(255,255,255,0.1)"}}>★</button>
      ))}
    </div>
  );
}

