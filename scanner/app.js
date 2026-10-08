import {createCatalog} from './catalog.js?v=20261009-1';
import {loadPortfolioPrice} from './portfolio-prices.js?v=20261009-1';
import {BestFrame,nextDelay,configureFocus,cameraInfo} from './camera.js?v=20261007-3';
import {createPricePanel} from './prices.js?v=20261007-4';
const $=id=>document.getElementById(id);
const VERSION='20261009-1';
const bestFrame=new BestFrame();let lastVideoTime=-1,tickStart=0,cameraDiagnostic={};
const sampleCanvas=document.createElement('canvas'),sampleContext=sampleCanvas.getContext('2d',{willReadFrequently:true});
const loadPrices=createPricePanel($('priceContent'));
let worker,requestId=0,pending=new Map(),ready=false,preparing=false,summary=null,stream=null,cameraToken=0,live=false,paused=false,timer=null,frameBusy=false,analysisBusy=false,selected=null,lastDiagnostic=null;
let collection=[];try{const stored=JSON.parse(localStorage.getItem('tcgCards')||'[]');if(Array.isArray(stored))collection=stored;}catch{status('Le portfolio local ne peut pas être lu. Il ne sera pas écrasé.',true);}
const frameCanvas=document.createElement('canvas'),frameContext=frameCanvas.getContext('2d',{willReadFrequently:true});
function status(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);}
function rpc(type,data={},transfer=[]){
 return new Promise((resolve,reject)=>{const id=++requestId;const timeout=type==='prepare'?600000:type==='init'?180000:30000;const t=setTimeout(()=>{pending.delete(id);reject(Error(type==='analyse'?'L’analyse a pris trop de temps. Réessaie.':'Chargement trop long. Vérifie la connexion puis actualise la page.'));},timeout);pending.set(id,{resolve,reject,t});worker.postMessage({id,type,...data},transfer);});
}
async function boot(){
 ready=false;summary=null;$('search').disabled=true;
 if(worker)worker.terminate();for(const p of pending.values()){clearTimeout(p.t);p.reject(Error('Changement de langue.'));}pending.clear();
 worker=new Worker('scanner/worker.js?v='+VERSION);
 worker.onmessage=e=>{const m=e.data;if(m.type==='progress'){if(!$('status').classList.contains('error'))status(m.text);$('catalogState').textContent=m.text;return;}const p=pending.get(m.id);if(!p)return;clearTimeout(p.t);pending.delete(m.id);if(m.type==='error')p.reject(Error(m.error));else p.resolve(m.result);};
 worker.onerror=()=>{ready=false;status('Le moteur visuel n’a pas démarré. La caméra et la version stable restent accessibles. Actualise pour réessayer.',true);};
 try{summary=await rpc('init',{lang:$('lang').value});ready=true;$('search').disabled=false;updateCoverage();if(!$('status').classList.contains('error'))status(live?'Présente une carte entière. Le scan est automatique.':'Scanner prêt. Ouvre la caméra et présente une carte entière.');renderSets();if(live)schedule();}
 catch(e){status(e.message,true);}
}
function updateCoverage(){if(!summary)return;$('coverage').textContent=summary.count.toLocaleString('fr-FR')+' références visuelles · '+summary.lang.toUpperCase()+' · traitement sur cet appareil'+(summary.lang==='ja'?' · couverture japonaise partielle : seules les cartes illustrées du catalogue sont reconnues.':'');$('catalogState').textContent=$('coverage').textContent;}
function stopCamera(){$('again').hidden=true;bestFrame.reset();lastVideoTime=-1;$('scanScreen').classList.remove('camera-open');cameraToken++;live=false;paused=false;clearTimeout(timer);timer=null;stream?.getTracks().forEach(t=>t.stop());stream=null;$('video').srcObject=null;$('video').hidden=true;$('cameraPlaceholder').hidden=false;$('liveHint').hidden=true;$('meter').hidden=true;$('stop').hidden=true;$('capture').hidden=true;$('start').disabled=false;$('stage').classList.add('idle');$('outline').setAttribute('points','16,5 84,5 84,95 16,95');$('outline').style.stroke='#f27568';}
async function startCamera(){
 stopCamera();const token=++cameraToken;$('start').disabled=true;selected=null;$('selection').hidden=true;$('results').hidden=true;
 try{
  if(!navigator.mediaDevices?.getUserMedia)throw Error('Caméra indisponible dans ce navigateur. Ouvre le lien HTTPS dans Chrome ou Safari, ou importe une photo.');
  // Keep the known-working stable page's ideal constraints. Never require a specific lens.
  const acquired=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080},frameRate:{ideal:30}},audio:false});
  if(token!==cameraToken){acquired.getTracks().forEach(t=>t.stop());return;}
  stream=acquired;$('video').srcObject=stream;$('video').hidden=false;$('cameraPlaceholder').hidden=true;await $('video').play();
  if(token!==cameraToken){acquired.getTracks().forEach(t=>t.stop());return;}
  live=true;paused=false;$('scanScreen').classList.add('camera-open');$('stop').hidden=false;$('capture').hidden=false;$('liveHint').hidden=false;$('meter').hidden=false;$('stage').classList.remove('idle');
  const track=stream.getVideoTracks()[0];cameraDiagnostic=cameraInfo(track);configureFocus(track).then(applied=>{if(stream===acquired)cameraDiagnostic={...cameraInfo(track),continuousFocusRequested:applied};});track.addEventListener('ended',()=>{if(stream===acquired){stopCamera();status('Caméra interrompue. Appuie sur « Ouvrir la caméra » pour reprendre.');}});
  if(ready)await rpc('reset');schedule();status(ready?'Présente la carte entière : le scan se déclenchera automatiquement.':'Caméra ouverte. Le catalogue visuel finit de se préparer…');
 }catch(e){if(token!==cameraToken)return;stopCamera();const messages={NotAllowedError:'Accès caméra refusé. Autorise la caméra dans les réglages du site, puis réessaie.',NotFoundError:'Aucune caméra trouvée. Tu peux importer une photo.',NotReadableError:'Caméra occupée par une autre application. Ferme-la puis réessaie.'};status(messages[e.name]||e.message,true);}
}
function grab(maxEdge){const v=$('video');if(v.readyState<2||!v.videoWidth||!v.videoHeight)throw Error('La caméra n’est pas encore prête.');const scale=Math.min(1,maxEdge/Math.max(v.videoWidth,v.videoHeight));frameCanvas.width=Math.round(v.videoWidth*scale);frameCanvas.height=Math.round(v.videoHeight*scale);frameContext.drawImage(v,0,0,frameCanvas.width,frameCanvas.height);return frameContext.getImageData(0,0,frameCanvas.width,frameCanvas.height);}
function drawOutline(points,progress){
 const stage=$('stage'),v=$('video'),w=stage.clientWidth,h=stage.clientHeight,scale=Math.min(w/v.videoWidth,h/v.videoHeight),dw=v.videoWidth*scale,dh=v.videoHeight*scale;
 if(points)$('outline').setAttribute('points',points.map(p=>[(p.x*dw+(w-dw)/2)/w*100,(p.y*dh+(h-dh)/2)/h*100].join(',')).join(' '));
 $('outline').style.stroke=progress>=1?'#71e7a4':progress>0?'#f5bb58':'#f27568';$('meter').firstElementChild.style.width=(progress*100)+'%';
}
function schedule(){clearTimeout(timer);if(live&&!paused)timer=setTimeout(tick,nextDelay(tickStart,performance.now()));}
async function tick(){
 if(!live||paused)return;if(!ready||preparing||frameBusy||analysisBusy){$('liveHint').textContent=!ready?'Préparation du catalogue…':'Préparation en cours…';schedule();return;}
 if($('video').currentTime===lastVideoTime){schedule();return;}lastVideoTime=$('video').currentTime;
 frameBusy=true;tickStart=performance.now();const token=cameraToken;
 try{
  // Keep exactly the frame evaluated by the worker, without reading its large pixel buffer yet.
  const v=$('video'),scale=Math.min(1,1600/Math.max(v.videoWidth,v.videoHeight));
  frameCanvas.width=Math.round(v.videoWidth*scale);frameCanvas.height=Math.round(v.videoHeight*scale);frameContext.drawImage(v,0,0,frameCanvas.width,frameCanvas.height);
  const small=Math.min(1,640/Math.max(frameCanvas.width,frameCanvas.height));sampleCanvas.width=Math.round(frameCanvas.width*small);sampleCanvas.height=Math.round(frameCanvas.height*small);sampleContext.drawImage(frameCanvas,0,0,sampleCanvas.width,sampleCanvas.height);
  const image=sampleContext.getImageData(0,0,sampleCanvas.width,sampleCanvas.height),sampleTime=performance.now();
  const result=await rpc('frame',{image,now:sampleTime},[image.data.buffer]);if(!live||paused||token!==cameraToken)return;
  bestFrame.consider(result,sampleTime,()=>frameContext.getImageData(0,0,frameCanvas.width,frameCanvas.height));
  drawOutline(result.points,result.progress);$('liveHint').textContent=result.hint;
  if(result.ready){const best=bestFrame.take(performance.now());if(best)await analyseImage(best);else await analyseCamera();}
 }
 catch(e){if(token===cameraToken)status(e.message,true);}finally{frameBusy=false;schedule();}
}
async function analyseCamera(){if(!ready){status('Le catalogue est encore en préparation.');return;}if(analysisBusy||!live)return;try{const image=grab(1600);await analyseImage(image);}catch(e){status(e.message,true);}}
async function analyseImage(image,alreadyCropped=false){
 if(analysisBusy)return;bestFrame.reset();analysisBusy=true;$('again').hidden=true;paused=true;clearTimeout(timer);$('capture').disabled=true;$('import').disabled=true;$('results').hidden=true;$('selection').hidden=true;selected=null;
 const token=cameraToken;
 status('Comparaison visuelle locale…');$('liveHint').textContent='Analyse de la carte…';
 try{const result=await rpc('analyse',{image,alreadyCropped},[image.data.buffer]);if(token!==cameraToken)return;showResult(result);}
 catch(e){if(token===cameraToken){status(e.message,true);$('results').hidden=false;$('resultTitle').textContent='Analyse interrompue';$('resultReason').textContent='Réessaie ou importe une photo.';$('candidates').replaceChildren();}}
 finally{analysisBusy=false;if(token===cameraToken)$('again').hidden=false;$('capture').disabled=false;$('import').disabled=false;}
}
function showResult(result){
 $('results').hidden=false;$('resultTitle').textContent=result.kind==='strong'?'Carte reconnue':result.kind==='candidates'?'À toi de confirmer':'Réessaie le scan';$('resultReason').textContent=result.reason;
 $('liveHint').textContent=result.kind==='reject'?'Repositionne puis relance le scan.':'Scan terminé.';
 if(result.preview){const p=result.preview;$('cropPreview').getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(p.data),p.width,p.height),0,0);}
 lastDiagnostic={version:VERSION,camera:cameraDiagnostic,date:new Date().toISOString(),lang:$('lang').value,kind:result.kind,durationMs:result.ms,referenceCount:result.coverage,quality:result.quality,unavailableReferences:result.unavailable||0,candidates:result.candidates?.map(c=>({id:c.id,distance:c.distance,inliers:c.inliers,coverage:c.coverage,unverified:!!c.unverified}))};$('debug').textContent=JSON.stringify(lastDiagnostic,null,2);
 renderCandidates(result.kind==='reject'?[]:result.kind==='strong'?result.candidates.slice(0,1):result.candidates||[]);if(result.kind==='strong'&&result.candidates[0])choose(result.candidates[0]);
 status(result.reason,result.kind==='reject');$('results').scrollIntoView({behavior:'smooth',block:'nearest'});
}
function imageURL(c){return c.image?c.image+(c.image.match(/\.(png|jpg|webp)$/)?'':'/low.webp'):'';}
function candidateNode(c){
 const row=document.createElement('div');row.className='candidate'+(c.unverified?' unverified':'');const img=document.createElement('img');img.alt=c.name;img.loading='lazy';img.src=imageURL(c);img.onerror=()=>{img.hidden=true;};
 const info=document.createElement('div');info.className='info';const title=document.createElement('strong');title.textContent=c.name;const meta=document.createElement('p');meta.textContent=(c.setName||c.setId||'')+' · '+(c.printedNumber||c.localId||'')+' · '+(c.lang||$('lang').value).toUpperCase();const note=document.createElement('p');note.textContent=c.unverified?'Édition possible · référence non vérifiée':c.referenceLang&&c.referenceLang!==c.lang?'Image de référence en anglais · édition à confirmer':c.inliers!==undefined?c.inliers+' points visuels concordants':'';
 info.append(title,meta,note);const btn=document.createElement('button');btn.textContent='Choisir';btn.onclick=()=>choose(c);row.append(img,info,btn);return row;
}
function renderCandidates(candidates){$('candidates').replaceChildren(...candidates.map(candidateNode));}
function choose(c){selected=c;$('selection').hidden=false;$('selectionName').textContent=c.name;$('selectionMeta').textContent=[c.setName,c.printedNumber||c.localId,c.id].filter(Boolean).join(' · ');$('buy').value='';$('finish').value='';loadPrices(c,c.lang||$('lang').value);}
async function restart(){
 if(analysisBusy)return;
 // Safari can suspend a video preview while the results scroll it off screen.
 // Open a fresh stream, as on the first scan, and reset the worker stability gate.
 $('stage').scrollIntoView({behavior:'instant',block:'center'});
 await startCamera();
}
async function importPhoto(file){
 if(!file)return;if(analysisBusy){status('Attends la fin de l’analyse en cours.');return;}if(!ready){status('Attends la fin de préparation du catalogue avant d’importer.');return;}
 stopCamera();const url=URL.createObjectURL(file);const img=new Image();
 try{await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('Photo illisible. Utilise un fichier JPEG, PNG ou WebP.'));img.src=url;});const scale=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight));frameCanvas.width=Math.round(img.naturalWidth*scale);frameCanvas.height=Math.round(img.naturalHeight*scale);frameContext.drawImage(img,0,0,frameCanvas.width,frameCanvas.height);
  // A catalogue-like, tightly cropped image can bypass corner detection. Real photos use geometry.
  const ratio=img.naturalWidth/img.naturalHeight;const tight=Math.abs(ratio-63/88)<.018;
  await analyseImage(frameContext.getImageData(0,0,frameCanvas.width,frameCanvas.height),tight);
 }catch(e){status(e.message,true);}finally{URL.revokeObjectURL(url);$('photo').value='';}
}
function navigate(screen){if(screen!=='scan')stopCamera();$('scanScreen').hidden=screen!=='scan';$('portfolioScreen').hidden=screen!=='portfolio';$('catalogScreen').hidden=screen!=='catalog';$('scanNav').classList.toggle('active',screen==='scan');$('portfolioNav').classList.toggle('active',screen==='portfolio');$('catalogNav')?.classList.toggle('active',screen==='catalog');if(screen==='portfolio')renderPortfolio();if(screen==='catalog')renderSets();window.scrollTo(0,0);}
const catalog=createCatalog({rpc,choose,navigate,imageURL,getLang:()=>$('lang').value,changeLang:lang=>{$('lang').value=lang;$('lang').onchange();}});
function renderSets(){catalog.sync();if(!summary)return;const term=$('setFilter').value.toLowerCase();$('setList').replaceChildren(...summary.sets.filter(s=>s.name.toLowerCase().includes(term)||s.id.toLowerCase().includes(term)).map(s=>{
 const row=document.createElement('div');row.className='setItem';const info=document.createElement('div'),title=document.createElement('strong'),detail=document.createElement('p');title.textContent=s.name;detail.textContent=s.indexed+' cartes indexées · '+s.prepared+' références hors ligne / '+s.cardCount.total;info.append(title,detail);const actions=document.createElement('div');actions.className='catalogSetActions';const browse=document.createElement('button');browse.textContent='Voir les cartes';browse.onclick=()=>catalog.open(s);const button=document.createElement('button');button.className='text';button.textContent=s.prepared?'Compléter le scan hors ligne':'Préparer le scan hors ligne';button.disabled=preparing||s.prepared>=s.cardCount.total;button.onclick=async()=>{if(preparing)return;preparing=true;renderSets();try{summary=await rpc('prepare',{setId:s.id});updateCoverage();$('catalogState').textContent=summary.failures?'Préparation terminée · '+summary.failures+' image(s) indisponible(s).':$('coverage').textContent;}catch(e){$('catalogState').textContent=e.message;}finally{preparing=false;renderSets();}};actions.append(browse,button);row.append(info,actions);return row;
 }));}
function readCollection(){const raw=JSON.parse(localStorage.getItem('tcgCards')||'[]');if(!Array.isArray(raw))throw Error('Format du portfolio invalide.');return raw;}
function renderPortfolio(){try{collection=readCollection();}catch{status('Le portfolio local est illisible ; aucune donnée n’a été modifiée.',true);return;}$('count').textContent=collection.length+' carte(s) enregistrée(s)';$('portfolioList').replaceChildren(...collection.map((c,index)=>{const snapshot=JSON.stringify(collection);const row=document.createElement('div');row.className='portfolioItem';const img=document.createElement('img');img.src=c.image||'';img.alt=c.name;img.loading='lazy';img.onerror=()=>{img.hidden=true;};const info=document.createElement('div');info.className='info';const name=document.createElement('strong'),meta=document.createElement('p');name.textContent=c.name;meta.textContent=[c.meta,c.finish,c.buy?c.buy+' €':''].filter(Boolean).join(' · ');const quote=document.createElement('div');info.append(name,meta,quote);const price=document.createElement('div');const visual=document.createElement('div');visual.className='portfolioVisual';visual.append(img,price);queueMicrotask(()=>loadPortfolioPrice(quote,c,price));const remove=document.createElement('button');remove.type='button';remove.title='Supprimer cette carte';remove.setAttribute('aria-label','Supprimer '+c.name);remove.style.cssText='min-width:44px;min-height:44px;padding:10px;flex-shrink:0;color:#db645b';remove.innerHTML='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6"/></svg>';remove.onclick=()=>{try{const current=readCollection();if(JSON.stringify(current)!==snapshot){renderPortfolio();$('count').textContent+=' · Collection actualisée : sélectionne à nouveau la carte à supprimer.';return;}current.splice(index,1);localStorage.setItem('tcgCards',JSON.stringify(current));renderPortfolio();}catch{$('count').textContent='Suppression impossible. La carte a été conservée.';}};row.append(visual,info,remove);return row;}));}
$('start').onclick=startCamera;$('stop').onclick=stopCamera;$('capture').onclick=analyseCamera;$('again').onclick=restart;$('import').onclick=()=>$('photo').click();$('photo').onchange=e=>importPhoto(e.target.files[0]);
$('lang').onchange=()=>{catalog.reset();$('setList').replaceChildren();stopCamera();$('results').hidden=true;$('selection').hidden=true;selected=null;boot();};$('catalogBtn').onclick=()=>navigate('catalog');$('back').onclick=()=>navigate('scan');$('scanNav').onclick=()=>navigate('scan');$('portfolioNav').onclick=()=>navigate('portfolio');$('setFilter').oninput=renderSets;
$('search').onclick=async()=>{if(!ready)return;paused=true;clearTimeout(timer);try{const candidates=await rpc('search',{query:$('name').value,number:$('number').value});$('results').hidden=false;$('again').hidden=false;$('resultTitle').textContent='Recherche catalogue';$('resultReason').textContent=candidates.length?candidates.length+' résultat(s). Confirme l’édition.':'Aucun résultat.';$('selection').hidden=true;selected=null;renderCandidates(candidates);}catch(e){status(e.message,true);}};
$('add').onclick=()=>{if(!selected)return;try{const current=readCollection();current.unshift({id:selected.id,name:selected.name,meta:$('selectionMeta').textContent,image:imageURL(selected),buy:$('buy').value,finish:$('finish').value,lang:selected.lang||$('lang').value,date:new Date().toLocaleDateString('fr-FR')});localStorage.setItem('tcgCards',JSON.stringify(current));collection=current;selected=null;$('selection').hidden=true;navigate('portfolio');}catch{status('Impossible d’enregistrer le portfolio. Vérifie l’espace disponible ; les anciennes données sont conservées.',true);}};
$('copyDiagnostics').onclick=async()=>{try{await navigator.clipboard.writeText($('debug').textContent);$('copyDiagnostics').textContent='Diagnostic copié';}catch{status('Sélectionne et copie le texte du diagnostic ci-dessus.');}};
document.addEventListener('visibilitychange',()=>{if(document.hidden&&(stream||$('start').disabled)){stopCamera();status('Caméra mise en pause. Rouvre-la pour reprendre.');}});window.addEventListener('pagehide',stopCamera);
$('stage').classList.add('idle');boot();
