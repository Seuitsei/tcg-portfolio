// Web uses a local demo only. Future AdSense/iOS adapters must explicitly opt in
// after approval/consent; no publisher IDs, ad scripts or real inventory here.
export const bannerPolicy=Object.freeze({web:'demo',android:'google-test',ios:'disabled',width:320,height:50});
const slot=document.createElement('aside');slot.id='bannerSlot';slot.setAttribute('aria-label','Emplacement publicitaire de test');
const label=document.createElement('p');label.id='bannerLabel';label.textContent='Emplacement de test · non rémunéré';
const creative=document.createElement('div');creative.id='bannerCreative';creative.textContent='Bannière de démonstration · 320 × 50';
slot.append(label,creative);document.body.append(slot);document.body.classList.add('has-test-banner');

// Platform adapter owns only the native ad view; never camera or recognition.
export async function attachNativeBanner(adapter){
 label.textContent='Bannière AdMob de test · non rémunérée';creative.textContent='Chargement de la bannière de test…';
 let frame=0,closed=false,listener;
 const report=data=>window.dispatchEvent(new CustomEvent('craftdrop-banner',{detail:data}));
 const failed=error=>{report({phase:'bridge_error',message:error?.message||String(error)});creative.textContent='Bannière de test indisponible';};
 const update=()=>{if(frame||closed)return;frame=requestAnimationFrame(()=>{frame=0;const r=creative.getBoundingClientRect();Promise.resolve(adapter.setBounds({x:r.x,y:r.y,width:r.width,height:r.height,viewportWidth:innerWidth,visible:!document.hidden&&r.width>=320})).catch(failed);});};
 const observer=new ResizeObserver(update);observer.observe(creative);
 window.addEventListener('resize',update);window.visualViewport?.addEventListener('resize',update);document.addEventListener('visibilitychange',update);
 window.addEventListener('pagehide',()=>{closed=true;cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('resize',update);window.visualViewport?.removeEventListener('resize',update);document.removeEventListener('visibilitychange',update);void listener?.remove();void adapter.hide().catch(()=>{});},{once:true});
 try{listener=await adapter.addListener('bannerState',s=>{report(s);if(typeof s.loaded==='boolean')creative.textContent=s.loaded?'':'Banni\u00e8re de test indisponible';else if(s.phase==='undersized')creative.textContent='Espace insuffisant pour la banni\u00e8re de test';});if(closed){await listener.remove();return;}update();}catch(error){failed(error);}
}
