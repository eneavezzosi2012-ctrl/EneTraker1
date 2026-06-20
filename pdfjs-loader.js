// PDF.js: caricato lazy on-demand quando l'utente importa un calendario FIP
window.__loadPdfJs = function(){
  if(window.__pdfJsLoaded) return Promise.resolve(window.pdfjsLib);
  if(window.__pdfJsLoading) return window.__pdfJsLoading;
  window.__pdfJsLoading = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = () => {
      if(window.pdfjsLib){
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        window.__pdfJsLoaded = true;
        resolve(window.pdfjsLib);
      } else {
        reject(new Error("pdf.js non caricato"));
      }
    };
    s.onerror = () => reject(new Error("Errore rete caricando pdf.js"));
    document.head.appendChild(s);
  });
  return window.__pdfJsLoading;
};
