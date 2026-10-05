// Reveal only after adapters, the requested initial view and game font are ready.
(()=>{
 const root=document.documentElement,slug=new URLSearchParams(location.search).get('atlas');if(!slug)return;
 let loaded=false,opened=window===parent,revealed=false,timer;
 async function reveal(){if(!loaded||!opened||revealed)return;revealed=true;try{await document.fonts.ready}catch{}await new Promise(r=>setTimeout(r,100));requestAnimationFrame(()=>requestAnimationFrame(()=>{delete root.dataset.readerLoading;parent.postMessage({type:'reader-ready',slug},location.origin)}));}
 addEventListener('message',e=>{if(e.origin===location.origin&&e.source===parent&&e.data?.type==='atlas-open'){opened=true;reveal()}});
 addEventListener('load',()=>{loaded=true;reveal();timer=setTimeout(()=>{opened=true;reveal()},2500)});
 addEventListener('pagehide',()=>clearTimeout(timer));
})();
