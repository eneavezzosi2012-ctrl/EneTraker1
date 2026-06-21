// ═══════════════════════════════════════════════════════════════════
// NOTE — clone monocromatico di Apple Notes (editor full-screen iOS)
// ═══════════════════════════════════════════════════════════════════

function stripHtml(html){
  if(!html)return "";
  const tmp=document.createElement("div");
  tmp.innerHTML=html;
  return (tmp.textContent||tmp.innerText||"").trim();
}
function escapeHtml(s){
  return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
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

// Riga "vuota" del contentEditable (usata per mostrare/nascondere il placeholder):
// una sola riga (div/p/h1-6) senza testo, oppure un singolo <br>.
const NOTE_EMPTY_RE=/^(\s|<br\s*\/?>|<(div|p|h[1-6])>(\s|<br\s*\/?>)?<\/\2>)*$/i;
function isContentEmpty(html){return NOTE_EMPTY_RE.test(html||"");}

// La prima riga del contentEditable = titolo (formattato in automatico via CSS).
// Tutto il resto = corpo. Round-trip compatibile con {id,title,body,pinned,...}.
function buildInitialHtml(note){
  const t=note&&note.title?escapeHtml(note.title):"";
  const titleLine=t?("<div>"+t+"</div>"):"<div><br></div>";
  return titleLine+((note&&note.body)||"");
}
function splitEditorContent(root){
  if(!root)return {title:"",body:""};
  const first=root.firstChild;
  const title=first?(first.textContent||"").replace(/\u00a0/g," ").trim():"";
  const rest=document.createElement("div");
  let node=first?first.nextSibling:null;
  while(node){
    rest.appendChild(node.cloneNode(true));
    node=node.nextSibling;
  }
  return {title,body:rest.innerHTML};
}

// Stili di testo del pannello "Aa" (formatBlock)
const TEXT_STYLES=[
  {tag:"H1",label:"Titolo"},
  {tag:"H2",label:"Intestazione"},
  {tag:"H3",label:"Sottotitolo"},
  {tag:"DIV",label:"Corpo"},
  {tag:"PRE",label:"Monospazio"},
];
// Evidenziatori — esclusivamente scale di grigio (nessun colore)
const HILITES=[
  {id:"h-white",bg:"rgb(255,255,255)",fg:"rgb(17,17,17)",label:"Bianco"},
  {id:"h-light",bg:"rgb(178,178,182)",fg:"rgb(17,17,17)",label:"Grigio chiaro"},
  {id:"h-mid",  bg:"rgb(110,110,115)",fg:"rgb(255,255,255)",label:"Grigio"},
  {id:"h-dark", bg:"rgb(58,58,60)",   fg:"rgb(255,255,255)",label:"Grigio scuro"},
];

// Riga di anteprima condivisa tra widget Home e archivio Impostazioni
function NoteRow({n,onClick}){
  const txt=stripHtml(n.body);
  const snippet=txt.length>140?txt.slice(0,140)+"…":txt;
  return(
    <button onClick={onClick} className={"note-row"+(n.pinned?" pinned":"")}>
      <div className="note-icon"></div>
      <div style={{flex:1,minWidth:0}}>
        <div className="note-title">{n.title||"Senza titolo"}</div>
        <div className="note-meta-line">
          <span className="note-meta">{fmtNoteDate(n.updatedAt)}</span>
          {snippet&&<span className="note-snippet"> {snippet}</span>}
        </div>
      </div>
    </button>
  );
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
    const trimmedTitle=(editor.title||"").trim();
    const cleanBody=(editor.body||"").trim();
    if(!trimmedTitle&&!stripHtml(cleanBody)){setEditor(null);return;}
    haptic.success();
    const ts=Date.now();
    if(editor.id){
      setNotes(prev=>prev.map(n=>n.id===editor.id?{...n,title:trimmedTitle,body:cleanBody,pinned:!!editor.pinned,updatedAt:ts}:n));
    } else {
      setNotes(prev=>[{id:genId(),title:trimmedTitle||"Nuova nota",body:cleanBody,pinned:!!editor.pinned,createdAt:ts,updatedAt:ts},...prev]);
    }
    setEditor(null);
  }
  function deleteEditor(){
    if(!editor||!editor.id){setEditor(null);return;}
    haptic.warn();
    setNotes(prev=>prev.filter(n=>n.id!==editor.id));
    setEditor(null);
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
        {pinned.length>0&&<div className="note-section-hdr"><span className="icon-pin-inline"></span> Fissate in alto</div>}
        {pinned.map(n=><NoteRow key={n.id} n={n} onClick={()=>openExisting(n)}/>)}
        {others.length>0&&pinned.length>0&&<div className="note-section-hdr gray" style={{marginTop:10}}>Tutte le note</div>}
        {others.map(n=><NoteRow key={n.id} n={n} onClick={()=>openExisting(n)}/>)}
      </>)}
      {notes&&notes.length>preview.length&&<div style={{fontSize:11,color:"rgba(255,255,255,0.3)",textAlign:"center",marginTop:8,fontStyle:"italic"}}>+ altre {notes.length-preview.length} note in Impostazioni → Note</div>}
      {editor&&<NoteEditorScreen editor={editor} setEditor={setEditor} onSave={saveEditor} onDelete={deleteEditor}/>}
    </div>
  );
}

// Archivio completo note (sezione Impostazioni): lista Apple Notes-style con ricerca full-text
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
    const trimmedTitle=(editor.title||"").trim();
    const cleanBody=(editor.body||"").trim();
    if(!trimmedTitle&&!stripHtml(cleanBody)){setEditor(null);return;}
    haptic.success();
    const ts=Date.now();
    if(editor.id){
      setNotes(prev=>prev.map(n=>n.id===editor.id?{...n,title:trimmedTitle,body:cleanBody,pinned:!!editor.pinned,updatedAt:ts}:n));
    } else {
      setNotes(prev=>[{id:genId(),title:trimmedTitle||"Nuova nota",body:cleanBody,pinned:!!editor.pinned,createdAt:ts,updatedAt:ts},...prev]);
    }
    setEditor(null);
  }
  function deleteEditor(){
    if(!editor||!editor.id){setEditor(null);return;}
    haptic.warn();
    setNotes(prev=>prev.filter(n=>n.id!==editor.id));
    setEditor(null);
  }

  return(
    <div className="note-list-wrap">
      {/* Search bar iOS-style, fissa in alto durante lo scroll */}
      <div className="note-search-sticky">
        <div className="note-search">
          <span className="icon-search"></span>
          <input
            placeholder="Cerca nelle note"
            value={search}
            onChange={e=>setSearch(e.target.value)}
            autoCorrect="off" autoCapitalize="off" spellCheck="false"
          />
          {search&&<button onClick={()=>setSearch("")} className="note-search-clear" aria-label="Cancella ricerca">✕</button>}
        </div>
      </div>

      {filtered.length===0?(
        <div style={{fontSize:13,color:"rgba(255,255,255,0.28)",textAlign:"center",padding:"36px 0",lineHeight:1.6}}>
          <div className="icon-note-empty" style={{marginBottom:8,opacity:.5}}></div>
          {q?"Nessuna nota corrisponde alla ricerca.":"Nessuna nota. Tocca ＋ per crearne una."}
        </div>
      ):(<>
        {pinnedF.length>0&&<>
          <div className="note-section-hdr"><span className="icon-pin-inline"></span> Fissate in alto · {pinnedF.length}</div>
          {pinnedF.map(n=><NoteRow key={n.id} n={n} onClick={()=>openExisting(n)}/>)}
        </>}
        {otherF.length>0&&<>
          <div className="note-section-hdr gray" style={{marginTop:pinnedF.length>0?14:0}}>Tutte le note · {otherF.length}</div>
          {otherF.map(n=><NoteRow key={n.id} n={n} onClick={()=>openExisting(n)}/>)}
        </>}
      </>)}

      {/* Tasto "Nuova Nota" — cerchio fluttuante sempre visibile */}
      <div className="note-fab-wrap">
        <button className="note-fab" onClick={openNew} aria-label="Nuova nota">
          <span className="icon-edit"></span>
        </button>
      </div>

      {editor&&<NoteEditorScreen editor={editor} setEditor={setEditor} onSave={saveEditor} onDelete={deleteEditor}/>}
    </div>
  );
}

// Editor note full-screen (vera schermata, stile navigazione a stack iOS — non un bottom sheet)
function NoteEditorScreen({editor,setEditor,onSave,onDelete}){
  const bodyRef=useRef(null);
  const screenRef=useRef(null);
  const moreRef=useRef(null);
  const [keyboardOpen,setKeyboardOpen]=useState(false);
  const [panelOpen,setPanelOpen]=useState(false);
  const [moreOpen,setMoreOpen]=useState(false);
  const [fmt,setFmt]=useState({bold:false,italic:false,underline:false,strike:false,ul:false,ol:false,block:"DIV"});

  function updateEmptyClass(){
    const root=bodyRef.current;
    if(!root)return;
    root.classList.toggle("is-empty",isContentEmpty(root.innerHTML));
  }
  function refreshFmtState(){
    try{
      setFmt({
        bold:document.queryCommandState("bold"),
        italic:document.queryCommandState("italic"),
        underline:document.queryCommandState("underline"),
        strike:document.queryCommandState("strikeThrough"),
        ul:document.queryCommandState("insertUnorderedList"),
        ol:document.queryCommandState("insertOrderedList"),
        block:(document.queryCommandValue("formatBlock")||"").toUpperCase(),
      });
    }catch(e){}
  }

  // Inizializza il contenuto (1a riga = titolo, auto-formattata via CSS) e porta il focus alla fine
  useEffect(()=>{
    const root=bodyRef.current;
    if(!root)return;
    try{document.execCommand("defaultParagraphSeparator",false,"div");}catch(e){}
    root.innerHTML=buildInitialHtml(editor);
    updateEmptyClass();
    const t=setTimeout(()=>{
      const r2=bodyRef.current;
      if(!r2)return;
      r2.focus();
      const r=document.createRange();
      r.selectNodeContents(r2);
      r.collapse(false);
      const sel=window.getSelection();
      if(sel){sel.removeAllRanges();sel.addRange(r);}
      refreshFmtState();
    },300);
    return ()=>clearTimeout(t);
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

  // Visual Viewport API: calcola l'altezza esattamente visibile (sopra la tastiera) e la applica
  // come altezza dello schermo editor — toolbar/pannello, essendo in fondo al flusso flex, finiscono
  // così esattamente sopra la tastiera senza bisogno di hack di posizionamento.
  useEffect(()=>{
    const el=screenRef.current;
    if(!el)return;
    function apply(){
      const vv=window.visualViewport;
      const h=vv?vv.height:window.innerHeight;
      el.style.setProperty("--vvh",h+"px");
    }
    apply();
    const vv=window.visualViewport;
    if(vv){vv.addEventListener("resize",apply);vv.addEventListener("scroll",apply);}
    window.addEventListener("orientationchange",apply);
    return()=>{
      if(vv){vv.removeEventListener("resize",apply);vv.removeEventListener("scroll",apply);}
      window.removeEventListener("orientationchange",apply);
    };
  },[]);

  // Chiude il menu "···" al tocco fuori
  useEffect(()=>{
    if(!moreOpen)return;
    function h(e){if(moreRef.current&&!moreRef.current.contains(e.target))setMoreOpen(false);}
    document.addEventListener("pointerdown",h);
    return()=>document.removeEventListener("pointerdown",h);
  },[moreOpen]);

  // Riflette lo stato dei tasti di formattazione (B/I/U/S, elenchi, stile blocco) sulla selezione corrente
  useEffect(()=>{
    function onSelChange(){if(document.activeElement===bodyRef.current)refreshFmtState();}
    document.addEventListener("selectionchange",onSelChange);
    return()=>document.removeEventListener("selectionchange",onSelChange);
  },[]);

  function syncBody(){
    const root=bodyRef.current;
    if(!root)return;
    updateEmptyClass();
    const {title,body}=splitEditorContent(root);
    setEditor(prev=>({...prev,title,body}));
  }

  // Salva e ripristina la selezione prima di execCommand (su iOS viene persa facilmente)
  function exec(cmd,val){
    haptic.light();
    const root=bodyRef.current;
    if(!root)return;
    const sel=window.getSelection();
    if(!sel||sel.rangeCount===0||!root.contains(sel.anchorNode)){
      root.focus();
      const r=document.createRange();
      r.selectNodeContents(root);
      r.collapse(false);
      if(sel){sel.removeAllRanges();sel.addRange(r);}
    }
    try{document.execCommand(cmd,false,val);}catch(e){console.warn("execCommand failed:",cmd,e);}
    syncBody();
    refreshFmtState();
  }
  function insertChecklist(){
    haptic.light();
    if(bodyRef.current)bodyRef.current.focus();
    try{document.execCommand("insertText",false,"☐ ");}catch(e){}
    syncBody();
  }
  function handleBodyClick(e){
    // Tap su ☐ → diventa ☑ e viceversa
    const root=bodyRef.current;
    if(!root)return;
    const range=document.caretRangeFromPoint?document.caretRangeFromPoint(e.clientX,e.clientY):null;
    if(!range)return;
    const node=range.startContainer;
    if(node&&node.nodeType===3){
      const txt=node.textContent;
      const offset=range.startOffset;
      for(let delta=-1;delta<=0;delta++){
        const pos=offset+delta;
        if(pos<0||pos>=txt.length)continue;
        const ch=txt[pos];
        if(ch==="☐"||ch==="☑"){
          haptic.success();
          const newCh=ch==="☐"?"☑":"☐";
          node.textContent=txt.slice(0,pos)+newCh+txt.slice(pos+1);
          syncBody();
          return;
        }
      }
    }
  }
  function applyHighlight(h){
    haptic.light();
    if(bodyRef.current)bodyRef.current.focus();
    try{
      document.execCommand("styleWithCSS",false,true);
      document.execCommand("hiliteColor",false,h.bg);
      document.execCommand("foreColor",false,h.fg);
    }catch(e){}
    syncBody();
  }
  function clearHighlight(){
    haptic.light();
    if(bodyRef.current)bodyRef.current.focus();
    try{
      document.execCommand("styleWithCSS",false,true);
      document.execCommand("hiliteColor",false,"transparent");
      document.execCommand("foreColor",false,"rgba(255,255,255,0.92)");
    }catch(e){}
    syncBody();
  }
  function dismissKeyboard(){
    haptic.light();
    setPanelOpen(false);
    setKeyboardOpen(false);
    if(bodyRef.current)bodyRef.current.blur();
  }
  function togglePin(){
    haptic.light();
    setMoreOpen(false);
    setEditor(prev=>({...prev,pinned:!prev.pinned}));
  }
  async function handleDelete(){
    setMoreOpen(false);
    if(await window.__appConfirm("Eliminare questa nota?",{confirm:"Elimina",cancel:"Annulla"}))onDelete();
  }
  function handleBack(){
    // Il blur (mousedown sul tasto, prima del click) ha già sincronizzato editor.title/body:
    // onSave legge sempre lo stato più recente. Salvataggio automatico, nessun tasto "Annulla".
    onSave();
  }

  const metaDate=editor.updatedAt?fmtNoteDate(editor.updatedAt):(editor.id?"Nota":"Nuova nota");

  const ui=(
    <div className="note-editor-overlay">
      <div className="note-editor-screen" ref={screenRef} style={{height:"var(--vvh, 100dvh)"}}>

        {/* Top bar: back (salva in automatico) a sx · Fine (solo a tastiera aperta) + menu ··· a dx */}
        <div className="ne-topbar">
          <button className="ne-back" onClick={handleBack} aria-label="Torna alle note">‹ Note</button>
          <div className="ne-top-actions">
            {keyboardOpen&&<button className="ne-done" onClick={dismissKeyboard} aria-label="Chiudi tastiera">Fine</button>}
            <div className="ne-more-wrap" ref={moreRef}>
              <button className="ne-more-btn" onClick={()=>setMoreOpen(o=>!o)} aria-label="Altre azioni">•••</button>
              {moreOpen&&(
                <div className="ne-more-menu">
                  <button onClick={togglePin}>
                    <span className="icon-pin-inline"></span>
                    {editor.pinned?"Rimuovi da In alto":"Fissa in alto"}
                  </button>
                  {editor.id&&<>
                    <div className="ne-more-sep"></div>
                    <button className="danger" onClick={handleDelete}>
                      <span className="icon-trash"></span>
                      Elimina nota
                    </button>
                  </>}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="ne-meta">{metaDate}</div>

        {/* Unico contentEditable: la prima riga è il titolo, formattata in automatico via CSS */}
        <div
          ref={bodyRef}
          className="ne-body"
          contentEditable
          role="textbox"
          aria-multiline="true"
          aria-label="Nota"
          suppressContentEditableWarning
          data-placeholder="Nuova nota"
          onInput={syncBody}
          onBlur={()=>{syncBody();setKeyboardOpen(false);}}
          onFocus={()=>{setKeyboardOpen(true);refreshFmtState();}}
          onClick={handleBodyClick}
        ></div>

        {/* Barra incollata sopra la tastiera (altezza schermo = visualViewport ⇒ resta sempre sopra) */}
        {keyboardOpen&&(
          <div className="ne-keyboard-bar">
            {panelOpen?(
              <div className="ne-aa-panel">
                <div className="ne-aa-head">
                  <span>Formattazione</span>
                  <button type="button" className="ne-aa-close" onMouseDown={e=>e.preventDefault()} onClick={()=>setPanelOpen(false)} aria-label="Chiudi pannello">✕</button>
                </div>

                <div className="ne-aa-group">
                  <div className="ne-aa-label">Stile testo</div>
                  <div className="ne-aa-row">
                    {TEXT_STYLES.map(s=>(
                      <button key={s.tag} type="button"
                        className={"ne-aa-pill"+(fmt.block===s.tag?" active":"")}
                        onMouseDown={e=>e.preventDefault()}
                        onClick={()=>exec("formatBlock",s.tag)}>{s.label}</button>
                    ))}
                  </div>
                </div>

                <div className="ne-aa-group">
                  <div className="ne-aa-label">Stile carattere</div>
                  <div className="ne-aa-row">
                    <button type="button" className={"ne-aa-charbtn bold"+(fmt.bold?" active":"")} onMouseDown={e=>e.preventDefault()} onClick={()=>exec("bold")} aria-label="Grassetto">B</button>
                    <button type="button" className={"ne-aa-charbtn italic"+(fmt.italic?" active":"")} onMouseDown={e=>e.preventDefault()} onClick={()=>exec("italic")} aria-label="Corsivo">I</button>
                    <button type="button" className={"ne-aa-charbtn under"+(fmt.underline?" active":"")} onMouseDown={e=>e.preventDefault()} onClick={()=>exec("underline")} aria-label="Sottolineato">U</button>
                    <button type="button" className={"ne-aa-charbtn strike"+(fmt.strike?" active":"")} onMouseDown={e=>e.preventDefault()} onClick={()=>exec("strikeThrough")} aria-label="Barrato">S</button>
                  </div>
                </div>

                <div className="ne-aa-group">
                  <div className="ne-aa-label">Elenchi e indentazione</div>
                  <div className="ne-aa-row">
                    <button type="button" className={"ne-aa-charbtn"+(fmt.ul?" active":"")} onMouseDown={e=>e.preventDefault()} onClick={()=>exec("insertUnorderedList")} aria-label="Elenco puntato">•</button>
                    <button type="button" className={"ne-aa-charbtn"+(fmt.ol?" active":"")} onMouseDown={e=>e.preventDefault()} onClick={()=>exec("insertOrderedList")} aria-label="Elenco numerato">1.</button>
                    <button type="button" className="ne-aa-charbtn" onMouseDown={e=>e.preventDefault()} onClick={insertChecklist} aria-label="Lista di controllo">☐</button>
                    <div className="ne-aa-divider"></div>
                    <button type="button" className="ne-aa-charbtn" onMouseDown={e=>e.preventDefault()} onClick={()=>exec("outdent")} aria-label="Sposta a sinistra">⇤</button>
                    <button type="button" className="ne-aa-charbtn" onMouseDown={e=>e.preventDefault()} onClick={()=>exec("indent")} aria-label="Sposta a destra">⇥</button>
                  </div>
                </div>

                <div className="ne-aa-group">
                  <div className="ne-aa-label">Evidenziatore</div>
                  <div className="ne-aa-row hl">
                    {HILITES.map(h=>(
                      <button key={h.id} type="button" className="ne-hl-swatch" style={{background:h.bg}}
                        onMouseDown={e=>e.preventDefault()} onClick={()=>applyHighlight(h)}
                        aria-label={h.label} title={h.label}></button>
                    ))}
                    <button type="button" className="ne-hl-swatch clear" onMouseDown={e=>e.preventDefault()} onClick={clearHighlight} aria-label="Rimuovi evidenziazione" title="Rimuovi evidenziazione">
                      <span className="icon-ban-inline"></span>
                    </button>
                  </div>
                </div>
              </div>
            ):(
              <div className="ne-toolbar">
                <button type="button" className="ne-tb-btn" onMouseDown={e=>e.preventDefault()} onClick={insertChecklist} aria-label="Lista di controllo">☐</button>
                <button type="button" className="ne-tb-btn aa" onMouseDown={e=>e.preventDefault()} onClick={()=>setPanelOpen(true)} aria-label="Formattazione">Aa</button>
                <button type="button" className="ne-tb-btn close-kb" onClick={dismissKeyboard} aria-label="Chiudi tastiera">⌄</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
  // Render via Portal su document.body per evitare che i parent con backdrop-filter
  // collassino position:fixed dell'overlay
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
