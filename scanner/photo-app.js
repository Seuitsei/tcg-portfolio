import {createCatalog} from './catalog.js?v=20261009-5';
import {loadPortfolioPrice,loadPortfolioVariants} from './portfolio-prices.js?v=20261009-6';
import {BestFrame,nextDelay,configureCamera,cameraInfo,cameraConstraints,refocusCamera,focusModes} from './camera.js?v=20261021-scan3';
import {createPricePanel} from './prices.js?v=20261009-5';
const $=id=>document.getElementById(id);
import {FocusGate} from './photo-quality.js?v=20261118-web117';
const focusGate=new FocusGate();
import {AutoRecognition,strongIdentity} from './auto-recognition.js?v=20261118-web117';
import {ScanDiagnostics,diagnosticExport} from './scan-diagnostics.js?v=20261118-web117';
const scanDiagnostics=new ScanDiagnostics();
let captureSequence=0,activeCaptureId=null,manualIntent=false,diagnosticsFrozen=false,pendingPress=null;
const recognition=new AutoRecognition();
let capturePending=false,previewRequest=null;
const VERSION='20261118-web117';
import {nativeCamera,decodeNativePhoto,nativeGuideImage} from './native-camera.js?v=20261118-web117';
if(nativeCamera)window.CraftDropNative={shareDiagnostic:payload=>nativeCamera.shareDiagnostic(payload)};
let nativeInfo=null,nativeFrameBusy=false,nativeCaptureSerial=0;
const bestFrame=new BestFrame();let lastVideoTime=-1,tickStart=0,cameraDiagnostic={};
const sampleCanvas=document.createElement('canvas'),sampleContext=sampleCanvas.getContext('2d',{willReadFrequently:true});
const loadPrices=createPricePanel($('priceContent'));
let autoScan=true,scanModeToken=0;
let worker,requestId=0,pending=new Map(),ready=false,preparing=false,summary=null,stream=null,cameraToken=0,live=false,paused=false,timer=null,frameBusy=false,analysisBusy=false,selected=null,lastDiagnostic=null;
let collection=[];try{const stored=JSON.parse(localStorage.getItem('tcgCards')||'[]');if(Array.isArray(stored))collection=stored;}catch{status('Le portfolio local ne peut pas être lu. Il ne sera pas écrasé.',true);}
recognition.onTrace=(event,data)=>trace(event,data);
function trace(event,data={}){scanDiagnostics.record(event,{session:cameraToken,jsNowMs:performance.now(),...data});}
window.addEventListener('craftdrop-banner',event=>trace('ad_'+event.detail.phase,event.detail));
function diagnosticSnapshot(){return scanDiagnostics.snapshot({build:'1.1.7',platform:'web',version:VERSION,session:cameraToken,live,paused,autoScan,engineReady:ready,analysisBusy,previewBusy:recognition.busy,confirmations:recognition.count,lastReset:recognition.lastReset,camera:cameraDiagnostic,lastScan:lastDiagnostic});}
function diagnosticText(){return JSON.stringify(diagnosticSnapshot(),null,2);}
setInterval(()=>{const debug=$('debug');if(debug&&$('diagnostics')?.open&&!diagnosticsFrozen)debug.textContent=diagnosticText();},1000);
function cancelAutomatic(reason='manual_priority'){recognition.reset(reason);if(ready)void rpc('cancelPreview').catch(e=>trace('cancel_error',{reason:e.message}));}
function frameQuality(q){
 trace('frame_quality',{ready:q.ready,scanReady:q.scanReady??q.ready,refusals:q.refusals||[],zones:q.zones,motion:q.motion,rawMotion:q.rawMotion,anchorMotion:q.anchorMotion,lightCompensation:q.lightCompensation,lightGain:q.lightGain,adjacentMotion:q.adjacentMotion,anchorShift:q.anchorShift,exposure:q.exposure,contrast:q.contrast,stableMs:q.stableMs,motionMethod:q.motionMethod,brightness:q.brightness,glare:q.glare});
 recognition.observe(q.scanReady??q.ready,performance.now(),q.refusals?.filter(r=>r!=='text_bands').join(',')||'stabilizing');
}
function captureFeedback(){
 $('capture').classList.remove('capture-started');$('capture').classList.add('capture-started');const label=$('capture').querySelector('.shutterLabel');if(label)label.textContent='Capture signalée';
 setTimeout(()=>$('capture').classList.remove('capture-started'),250);
}
const frameCanvas=document.createElement('canvas'),frameContext=frameCanvas.getContext('2d',{willReadFrequently:true});
function status(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);}
function rpc(type,data={},transfer=[]){
 return new Promise((resolve,reject)=>{const id=++requestId;const timeout=type==='prepare'?600000:type==='init'?180000:(type==='analyse'||type==='frame')?60000:30000;const t=setTimeout(()=>{pending.delete(id);reject(Error(type==='analyse'?'L’analyse a pris trop de temps. Réessaie.':'Chargement trop long. Vérifie la connexion puis actualise la page.'));},timeout);pending.set(id,{resolve,reject,t,started:performance.now(),requestType:type,captureId:data.captureId,manual:data.manual});if(type==='analyse')trace('worker_request',{requestId:id,captureId:data.captureId,manual:!!data.manual});worker.postMessage({id,type,...data},transfer);});
}
async function boot(){
 ready=false;summary=null;$('search').disabled=true;
 if(worker)worker.terminate();for(const p of pending.values()){clearTimeout(p.t);p.reject(Error('Changement de langue.'));}pending.clear();
 worker=new Worker('scanner/worker.js?v='+VERSION+'&jp=20261010');
 worker.onmessage=e=>{const m=e.data;if(m.type==='locating'){if(live&&!paused)$('liveHint').textContent='Recherche des détails de la carte…';return;}if(m.type==='progress'){if(!$('status').classList.contains('error'))status(m.text);$('catalogState').textContent=m.text;return;}const p=pending.get(m.id);if(!p)return;clearTimeout(p.t);pending.delete(m.id);if(m.timing)trace('worker_timing',{requestId:m.id,captureId:p.captureId,manual:p.manual,totalMs:performance.now()-p.started,...m.timing});if(m.type==='error'){trace('worker_error',{requestId:m.id,captureId:p.captureId,reason:m.error,referenceFailures:m.referenceFailures||[]});p.reject(Error(m.error));}else p.resolve(m.result);};
 worker.onerror=()=>{ready=false;status('Le moteur visuel n’a pas démarré. La caméra et la version stable restent accessibles. Actualise pour réessayer.',true);};
 try{summary=await rpc('init',{lang:$('lang').value});ready=true;$('search').disabled=false;updateCoverage();if(!$('status').classList.contains('error'))status(live?'Centre la carte puis appuie sur Scanner.':'Scanner prêt. Ouvre la caméra et présente une carte entière.');renderSets();if(live)schedule();}
 catch(e){status(e.message,true);}
}
function updateCoverage(){if(!summary)return;$('coverage').textContent=summary.count.toLocaleString('fr-FR')+' références visuelles · '+summary.lang.toUpperCase()+' · traitement sur cet appareil'+(summary.lang==='ja'?' · couverture japonaise partielle : seules les cartes illustrées du catalogue sont reconnues.':'');$('catalogState').textContent=$('coverage').textContent;}
let selectedCamera='';
function stopCamera(){if(nativeCamera){nativeCaptureSerial++;if(!analysisBusy)$('import').disabled=false;nativeCamera.stop().catch(()=>{});nativeInfo=null;}if(ready)void rpc('cancelPreview').catch(()=>{});manualIntent=false;trace('camera_stop');recognition.reset('session_stop');capturePending=false; $('cameraControls').hidden=true;$('again').hidden=true;bestFrame.reset();focusGate.reset();lastVideoTime=-1;$('scanScreen').classList.remove('camera-open');cameraToken++;live=false;paused=false;clearTimeout(timer);timer=null;stream?.getTracks().forEach(t=>t.stop());stream=null;$('video').srcObject=null;$('frozenPreview').hidden=true;$('capture').classList.remove('photo-ready');$('video').hidden=true;$('cameraPlaceholder').hidden=false;$('liveHint').hidden=true;$('meter').hidden=true;$('stop').hidden=true;$('capture').hidden=true;$('autoScan').hidden=true;$('start').disabled=false;$('capture').disabled=false;$('stage').classList.add('idle');$('outline').setAttribute('points','12,10 88,10 88,90 12,90');$('outline').style.stroke='#f27568';}
function showCameraState(message=''){
 if(nativeCamera&&nativeInfo){
  $('refocus').disabled=analysisBusy||!nativeCamera.active;
  $('cameraState').textContent=['CameraX · caméra native',nativeInfo.width&&nativeInfo.height?nativeInfo.width+' × '+nativeInfo.height+' (capture)':'', 'Touche l’aperçu pour faire le point',message].filter(Boolean).join(' · ');return;
 }

 const track=stream?.getVideoTracks()[0];if(!track)return;
 const info=cameraInfo(track),modes=focusModes(track);
 cameraDiagnostic={...cameraDiagnostic,...info};
 $('refocus').disabled=analysisBusy||!modes.some(m=>m==='continuous'||m==='single-shot');
 const focus=cameraDiagnostic.automaticControls?.focusMode;
 $('cameraState').textContent=[info.label||'Caméra',info.width&&info.height?`${info.width} × ${info.height}`:'Résolution non communiquée',focus?`Mise au point demandée : ${focus==='continuous'?'continue':'ponctuelle'}`:'Autofocus non contrôlable ici',message].filter(Boolean).join(' · ');
}
async function listCameras(token){
 if(nativeCamera&&nativeInfo){if(token!==cameraToken)return;const devices=nativeInfo.devices||[];$('cameraSelect').replaceChildren(new Option('Caméra arrière automatique',''),...devices.map(d=>new Option(d.label,d.deviceId)));$('cameraSelect').value=selectedCamera;$('cameraSelect').disabled=devices.length<2;return;}

 try{
  const devices=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput');
  if(token!==cameraToken)return;
  $('cameraSelect').replaceChildren(new Option('Caméra arrière automatique',''),...devices.map((d,i)=>new Option(d.label||`Caméra ${i+1}`,d.deviceId)));
  $('cameraSelect').value=selectedCamera;
  $('cameraSelect').disabled=devices.length<2;
 }catch{if(token===cameraToken)$('cameraSelect').disabled=true;}
}
async function startCamera(){
 stopCamera();const token=++cameraToken;$('start').disabled=true;selected=null;$('selection').hidden=true;$('results').hidden=true;
 try{
  if(nativeCamera){await startNativeCamera(token);return;}
  if(!navigator.mediaDevices?.getUserMedia)throw Error('Caméra indisponible dans ce navigateur. Ouvre le lien HTTPS dans Chrome ou Safari, ou importe une photo.');
  // Keep the automatic rear camera by default; only pin a lens chosen by the user.
  const acquired=await navigator.mediaDevices.getUserMedia(cameraConstraints(selectedCamera));
  if(token!==cameraToken){acquired.getTracks().forEach(t=>t.stop());return;}
  stream=acquired;$('video').srcObject=stream;$('video').hidden=false;$('cameraPlaceholder').hidden=true;await $('video').play();
  if(token!==cameraToken){acquired.getTracks().forEach(t=>t.stop());return;}
  live=true;paused=false;$('scanScreen').classList.add('camera-open');$('stop').hidden=false;$('capture').hidden=false;$('autoScan').hidden=false;$('liveHint').hidden=false;$('meter').hidden=false;$('stage').classList.remove('idle');
  const track=stream.getVideoTracks()[0];cameraDiagnostic=cameraInfo(track);$('capture').disabled=true;const applied=await configureCamera(track,()=>stream===acquired);if(token!==cameraToken)return;cameraDiagnostic={...cameraInfo(track),automaticControls:applied};$('capture').disabled=false;$('cameraControls').hidden=false;showCameraState();await listCameras(token);if(token!==cameraToken)return;track.addEventListener('ended',()=>{if(stream===acquired){stopCamera();status('Caméra interrompue. Appuie sur « Ouvrir la caméra » pour reprendre.');}});
  if(ready)await rpc('reset');schedule();status(ready?'Centre la carte. Le vert indique une image prête à photographier.':'Caméra ouverte. Le catalogue visuel finit de se préparer…');
 }catch(e){if(token!==cameraToken)return;stopCamera();const messages={NotAllowedError:'Accès caméra refusé. Autorise la caméra dans les réglages du site, puis réessaie.',NotFoundError:'Aucune caméra trouvée. Tu peux importer une photo.',NotReadableError:'Caméra occupée par une autre application. Ferme-la puis réessaie.'};status(messages[e.name]||e.message,true);if(selectedCamera){$('cameraControls').hidden=false;$('cameraSelect').disabled=false;$('refocus').disabled=true;$('cameraState').textContent='Cette caméra ne peut pas être ouverte. Sélectionne une autre caméra ou le mode automatique.';}}
}
function grab(maxEdge){const v=$('video');if(v.readyState<2||!v.videoWidth||!v.videoHeight)throw Error('La caméra n’est pas encore prête.');const scale=Math.min(1,maxEdge/Math.max(v.videoWidth,v.videoHeight));frameCanvas.width=Math.round(v.videoWidth*scale);frameCanvas.height=Math.round(v.videoHeight*scale);frameContext.drawImage(v,0,0,frameCanvas.width,frameCanvas.height);return frameContext.getImageData(0,0,frameCanvas.width,frameCanvas.height);}
let guideProgress=0;
function guideBounds(width,height){
 const h=Math.min(height*.76,width*.82*88/63),w=h*63/88;
 return {x:(width-w)/2,y:(height-h)/2,width:w,height:h};
}
function drawOutline(points,progress){
 // One fixed card-shaped guide; recognition never moves its visible bounds.
 guideProgress=progress;
 const stage=$('stage').getBoundingClientRect(),g=guideBounds(stage.width,stage.height);
 $('overlay').setAttribute('viewBox',`0 0 ${stage.width} ${stage.height}`);
 for(const [key,value] of Object.entries(g))$('outline').setAttribute(key,value);
 $('outline').style.stroke=progress>=1?'#71e7a4':progress>0?'#f5bb58':'#f27568';
 $('meter').firstElementChild.style.width=(progress*100)+'%';
}
new ResizeObserver(()=>drawOutline(null,guideProgress)).observe($('stage'));
function schedule(){clearTimeout(timer);if(live&&!paused&&!nativeCamera)timer=setTimeout(tick,nextDelay(tickStart,performance.now()));}
async function tick(){
 if(!live||paused)return;
 if($('video').currentTime===lastVideoTime){schedule();return;}
 lastVideoTime=$('video').currentTime;tickStart=performance.now();
 try{
  const v=$('video'),stage=$('stage').getBoundingClientRect();
  if(!v.videoWidth||!stage.width){schedule();return;}
  // Map the fixed guide through object-fit:cover to the original video pixels.
  const scale=Math.max(stage.width/v.videoWidth,stage.height/v.videoHeight);
  const ox=(v.videoWidth*scale-stage.width)/2,oy=(v.videoHeight*scale-stage.height)/2;
  const g=guideBounds(stage.width,stage.height);
  const sx=(g.x+ox)/scale,sy=(g.y+oy)/scale;
  const sw=g.width/scale,sh=g.height/scale;
  sampleCanvas.width=504;sampleCanvas.height=704;
  sampleContext.drawImage(v,sx,sy,sw,sh,0,0,504,704);
  const q=focusGate.evaluate(sampleContext.getImageData(0,0,504,704),performance.now());
  cameraDiagnostic={...cameraDiagnostic,focus:q};
  drawOutline(null,q.progress);$('liveHint').textContent=q.hint;
  frameQuality(q);if(q.scanReady??q.ready)void analysePreview(()=>grab(960));
  $('capture').classList.toggle('photo-ready',q.ready);
 }catch(e){recognition.reset('refocus');focusGate.reset();drawOutline(null,0);$('liveHint').textContent='Place la carte dans le cadre.';}
 schedule();
}
async function analysePreview(getImage,alreadyCropped=false){
 if(!autoScan||!ready||!live||paused||analysisBusy||capturePending||manualIntent){trace('analysis_skipped',{reason:!autoScan?'disabled':!ready?'engine_not_ready':!live?'not_live':paused?'paused':analysisBusy?'photo_analysis':capturePending?'capture':'manual_intent'});return;}
 const job=recognition.begin(performance.now());if(!job)return;
 const token=cameraToken,mode=scanModeToken;
 try{
  const image=getImage();trace('preview_analysis_start',{epoch:job.epoch,width:image.width,height:image.height});
  previewRequest=rpc('analyse',{image,alreadyCropped,manual:false,independent:true},[image.data.buffer]);
  const result=await previewRequest;trace('preview_analysis_result',{durationMs:performance.now()-job.started,workerMs:result.ms,kind:result.kind,id:result.candidates?.[0]?.id,unavailable:result.unavailable||0,reason:result.reason,referenceFailures:result.referenceFailures||[],scores:result.candidates?.slice(0,3).map(c=>({id:c.id,distance:c.distance,inliers:c.inliers,coverage:c.coverage}))});
  if(token!==cameraToken||mode!==scanModeToken||!live||paused||analysisBusy||capturePending){recognition.busy=false;recognition.reset('stale_session_or_mode');return;}
  const id=recognition.finish(job,result,performance.now());
  if(id)await analyseCamera(id);
 }catch(e){trace('preview_analysis_error',{reason:e.message,durationMs:performance.now()-job.started});recognition.busy=false;recognition.reset('analysis_error');}
}
function resumeAutomatic(){if(nativeCamera)void nativeCamera.preview(false);
 recognition.reset('verification_retry');focusGate.reset();paused=false;$('frozenPreview').hidden=true;$('results').hidden=true;$('selection').hidden=true;selected=null;$('again').hidden=true;
 status('Confirmation insuffisante. Garde la carte immobile ou utilise le déclencheur manuel.');schedule();
}
async function analyseCamera(expectedId=null){if(nativeCamera){await analyseNativeCamera(expectedId);return;}if(!ready){status('Le catalogue est encore en préparation.');return;}if(analysisBusy||capturePending||!live||paused)return;recognition.reset();try{const image=grab(Infinity);$('frozenPreview').width=image.width;$('frozenPreview').height=image.height;$('frozenPreview').getContext('2d').putImageData(image,0,0);$('frozenPreview').hidden=false;await analyseImage(image,false,null,true,expectedId);}catch(e){status(e.message,true);}}
async function analyseImage(image,alreadyCropped=false,points=null,manual=false,expectedId=null){
 if(analysisBusy)return;if(manual)cancelAutomatic('final_photo');recognition.reset('photo_analysis');bestFrame.reset();analysisBusy=true;$('again').hidden=true;paused=true;clearTimeout(timer);$('capture').disabled=true;$('cameraSelect').disabled=true;$('refocus').disabled=true;$('import').disabled=true;$('results').hidden=true;$('selection').hidden=true;selected=null;
 const token=cameraToken;
 status('Photo prise. Recherche de la carte… Cela peut prendre quelques secondes.');$('liveHint').textContent='Analyse de la carte…';
 try{if(token!==cameraToken)return;trace('photo_analysis_queued',{captureId:activeCaptureId});const result=await rpc('analyse',{image,alreadyCropped,points,manual,independent:true,captureId:activeCaptureId},[image.data.buffer]);if(token!==cameraToken)return;trace('photo_analysis_result',{captureId:activeCaptureId,kind:result.kind,id:result.candidates?.[0]?.id,unavailable:result.unavailable||0,workerMs:result.ms,referenceFailures:result.referenceFailures||[]});if(expectedId&&strongIdentity(result)!==expectedId){trace('verification_failed',{expectedId,actualId:result.candidates?.[0]?.id,kind:result.kind});resumeAutomatic();return;}showResult(result);}
 catch(e){if(token===cameraToken){if(expectedId){resumeAutomatic();return;}status(e.message,true);$('results').hidden=false;$('resultTitle').textContent='Analyse interrompue';$('resultReason').textContent='Réessaie ou importe une photo.';$('candidates').replaceChildren();}}
 finally{analysisBusy=false;if(token===cameraToken)$('again').hidden=!paused;$('capture').disabled=false;$('import').disabled=false;if(stream||nativeInfo){showCameraState();listCameras(token);}if(nativeCamera&&!nativeCamera.active)$('capture').disabled=true;}
}
function showResult(result){
 $('results').hidden=false;$('resultTitle').textContent=result.kind==='strong'?'Carte reconnue':result.kind==='candidates'?'À toi de confirmer':'Réessaie le scan';$('resultReason').textContent=result.reason;
 $('liveHint').textContent=result.kind==='reject'?'Repositionne puis relance le scan.':'Scan terminé.';
 if(result.preview){const p=result.preview;$('cropPreview').getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(p.data),p.width,p.height),0,0);}
 lastDiagnostic={version:VERSION,camera:cameraDiagnostic,date:new Date().toISOString(),lang:$('lang').value,kind:result.kind,durationMs:result.ms,referenceCount:result.coverage,quality:result.quality,unavailableReferences:result.unavailable||0,referenceFailures:result.referenceFailures||[],candidates:result.candidates?.map(c=>({id:c.id,distance:c.distance,inliers:c.inliers,coverage:c.coverage,unverified:!!c.unverified}))};$('debug').textContent=diagnosticText();
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
 stopCamera();cameraDiagnostic={engine:'import'};const url=URL.createObjectURL(file);const img=new Image();
 try{await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('Photo illisible. Utilise un fichier JPEG, PNG ou WebP.'));img.src=url;});const scale=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight));frameCanvas.width=Math.round(img.naturalWidth*scale);frameCanvas.height=Math.round(img.naturalHeight*scale);frameContext.drawImage(img,0,0,frameCanvas.width,frameCanvas.height);
  // A catalogue-like, tightly cropped image can bypass corner detection. Real photos use geometry.
  const ratio=img.naturalWidth/img.naturalHeight;const tight=Math.abs(ratio-63/88)<.018;
  await analyseImage(frameContext.getImageData(0,0,frameCanvas.width,frameCanvas.height),tight,null,true);
 }catch(e){status(e.message,true);}finally{URL.revokeObjectURL(url);$('photo').value='';}
}
function navigate(screen){if(screen!=='scan')stopCamera();$('scanScreen').hidden=screen!=='scan';$('portfolioScreen').hidden=screen!=='portfolio';$('catalogScreen').hidden=screen!=='catalog';$('scanNav').classList.toggle('active',screen==='scan');$('portfolioNav').classList.toggle('active',screen==='portfolio');$('catalogNav')?.classList.toggle('active',screen==='catalog');if(screen==='portfolio')renderPortfolio();if(screen==='catalog')renderSets();(document.getElementById('appScroll')||window).scrollTo(0,0);}
const catalog=createCatalog({rpc,choose,navigate,imageURL,getLang:()=>$('lang').value,changeLang:lang=>{$('lang').value=lang;$('lang').onchange();}});
function renderSets(){catalog.sync();if(!summary)return;const term=$('setFilter').value.toLowerCase();$('setList').replaceChildren(...summary.sets.filter(s=>s.name.toLowerCase().includes(term)||s.id.toLowerCase().includes(term)).map(s=>{
 const row=document.createElement('div');row.className='setItem';const info=document.createElement('div'),title=document.createElement('strong'),detail=document.createElement('p');title.textContent=s.name;detail.textContent=s.indexed+' cartes indexées · '+s.prepared+' références hors ligne / '+s.cardCount.total;info.append(title,detail);const actions=document.createElement('div');actions.className='catalogSetActions';const browse=document.createElement('button');browse.textContent='Voir les cartes';browse.onclick=()=>catalog.open(s);const button=document.createElement('button');button.className='text';button.textContent=s.prepared?'Compléter le scan hors ligne':'Préparer le scan hors ligne';button.disabled=preparing||s.prepared>=s.cardCount.total;button.onclick=async()=>{if(preparing)return;preparing=true;renderSets();try{summary=await rpc('prepare',{setId:s.id});updateCoverage();$('catalogState').textContent=summary.failures?'Préparation terminée · '+summary.failures+' image(s) indisponible(s).':$('coverage').textContent;}catch(e){$('catalogState').textContent=e.message;}finally{preparing=false;renderSets();}};actions.append(browse,button);row.append(info,actions);return row;
 }));}
function readCollection(){const raw=JSON.parse(localStorage.getItem('tcgCards')||'[]');if(!Array.isArray(raw))throw Error('Format du portfolio invalide.');return raw;}
const collectionKey=()=>crypto.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
function renderPortfolio(){try{collection=readCollection();const seen=new Set();let changed=false;for(const c of collection){if(!c.collectionId||seen.has(c.collectionId)){c.collectionId=collectionKey();changed=true;}seen.add(c.collectionId);}if(changed)localStorage.setItem('tcgCards',JSON.stringify(collection));}catch{status('Le portfolio local est illisible ; aucune donnée n’a été modifiée.',true);return;}$('count').textContent=collection.length+' carte(s) enregistrée(s)';$('portfolioList').replaceChildren(...collection.map((c,index)=>{const snapshot=JSON.stringify(collection);const row=document.createElement('div');row.className='portfolioItem';const img=document.createElement('img');img.src=c.image||'';img.alt=c.name;img.loading='lazy';img.onerror=()=>{img.hidden=true;};const info=document.createElement('div');info.className='info';const name=document.createElement('strong'),meta=document.createElement('p');name.textContent=c.name;meta.textContent=[c.meta,c.finish,c.buy?c.buy+' €':''].filter(Boolean).join(' · ');const quote=document.createElement('div');info.append(name,meta,quote);const price=document.createElement('div');const visual=document.createElement('div');visual.className='portfolioVisual';visual.append(img,price);queueMicrotask(()=>loadPortfolioPrice(quote,c,price,key=>{try{const current=readCollection(),record=current.find(x=>x.collectionId===c.collectionId);if(!record)throw Error();record.marketVariant=key;localStorage.setItem('tcgCards',JSON.stringify(current));renderPortfolio();return true;}catch{$('count').textContent='Choix non enregistré. Réouvre le classeur puis réessaie.';return false;}}));const remove=document.createElement('button');remove.type='button';remove.title='Supprimer cette carte';remove.setAttribute('aria-label','Supprimer '+c.name);remove.style.cssText='min-width:44px;min-height:44px;padding:10px;flex-shrink:0;color:#db645b';remove.innerHTML='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6"/></svg>';remove.onclick=()=>{try{const current=readCollection();if(JSON.stringify(current)!==snapshot){renderPortfolio();$('count').textContent+=' · Collection actualisée : sélectionne à nouveau la carte à supprimer.';return;}current.splice(index,1);localStorage.setItem('tcgCards',JSON.stringify(current));renderPortfolio();}catch{$('count').textContent='Suppression impossible. La carte a été conservée.';}};const actions=document.createElement('div');actions.className='portfolioActions';const edit=document.createElement('button');edit.type='button';edit.title='Modifier cette carte';edit.setAttribute('aria-label','Modifier '+c.name);edit.innerHTML='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m16 3 5 5-12 12-6 1 1-6L16 3ZM14 5l5 5"/></svg>';edit.onclick=()=>editPortfolioCard(c);actions.append(edit,remove);row.append(visual,info,actions);return row;}));}
function editPortfolioCard(card){
 const dialog=document.createElement('dialog');dialog.className='portfolioEditor';dialog.setAttribute('aria-label','Modifier '+card.name);
 const form=document.createElement('form'),title=document.createElement('h2');title.textContent=card.name;
 const label=document.createElement('label');label.textContent='Prix d’achat (€)';const buy=document.createElement('input');buy.name='buy';buy.inputMode='decimal';buy.placeholder='Facultatif';buy.value=card.buy??'';label.append(buy);
 const variant=document.createElement('label');variant.textContent='Version de la carte';const select=document.createElement('select');select.disabled=true;variant.append(select);
 const message=document.createElement('p');message.setAttribute('role','status');message.textContent='Chargement des versions…';
 const buttons=document.createElement('div');buttons.className='editorActions';const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Annuler';cancel.onclick=()=>dialog.close();const save=document.createElement('button');save.type='submit';save.className='primary';save.textContent='Enregistrer';buttons.append(cancel,save);form.append(title,label,variant,message,buttons);dialog.append(form);document.body.append(dialog);dialog.onclose=()=>dialog.remove();dialog.showModal();buy.focus();
 let versionLoaded=false;
 loadPortfolioVariants(card).then(choices=>{if(!dialog.isConnected)return;select.replaceChildren();const empty=document.createElement('option');empty.value='';empty.textContent='À confirmer';select.append(empty);for(const c of choices){const option=document.createElement('option');option.value=c.key;option.textContent=c.label;select.append(option);}if(choices.filter(c=>c.key===card.marketVariant).length===1)select.value=card.marketVariant;else if(choices.length===1)select.value=choices[0].key;select.disabled=choices.length<2;versionLoaded=true;message.textContent=choices.length<2?'Une seule version disponible dans la source.':'';}).catch(()=>{if(dialog.isConnected)message.textContent='Versions indisponibles. Tu peux modifier le prix d’achat ; la version enregistrée sera conservée.';});
 form.onsubmit=event=>{event.preventDefault();const value=buy.value.trim();if(value&&(!/^\d+(?:[.,]\d{1,2})?$/.test(value)||!Number.isFinite(Number(value.replace(',','.'))))){message.textContent='Saisis un prix positif avec au maximum deux décimales, ou laisse le champ vide.';buy.focus();return;}
 try{const current=readCollection(),record=current.find(c=>c.collectionId===card.collectionId);if(!record)throw Error('Cette carte a été supprimée.');if((record.buy??'')!==(card.buy??'')||record.marketVariant!==card.marketVariant)throw Error('Cette carte a changé. Ferme cette fenêtre puis réouvre-la.');record.buy=value.replace(',','.');if(versionLoaded)record.marketVariant=select.value||null;localStorage.setItem('tcgCards',JSON.stringify(current));dialog.close();renderPortfolio();}catch(e){message.textContent=e.message||'Enregistrement impossible. Les données ont été conservées.';}
 };
}
$('autoScan').onclick=async()=>{if(analysisBusy||capturePending)return;autoScan=!autoScan;scanModeToken++;recognition.reset('mode_change');bestFrame.reset();$('autoScan').textContent='Scan automatique : '+(autoScan?'activé':'désactivé');$('autoScan').setAttribute('aria-pressed',String(autoScan));if(ready)try{await rpc('reset');}catch(e){status(e.message,true);}};
$('cameraSelect').onchange=async()=>{if(analysisBusy)return;selectedCamera=$('cameraSelect').value;await startCamera();};
$('refocus').onclick=async()=>{if(nativeCamera){if(analysisBusy||capturePending)return;recognition.reset('refocus');focusGate.reset();$('refocus').disabled=true;try{const result=await nativeCamera.focus();cameraDiagnostic.focusSuccessful=result.success;recognition.reset('refocus');focusGate.reset();drawOutline(null,0);showCameraState(result.success?'Mise au point effectuée.':'Mise au point non confirmée : éloigne un peu la carte.');}catch(e){showCameraState(e.message);}return;}const active=stream,track=active?.getVideoTracks()[0];if(!track||analysisBusy)return;recognition.reset('refocus');focusGate.reset();$('refocus').disabled=true;const mode=await refocusCamera(track);if(stream!==active)return;if(mode){cameraDiagnostic.automaticControls={...cameraDiagnostic.automaticControls,focusMode:mode};recognition.reset();focusGate.reset();drawOutline(null,0);}showCameraState(mode?'Demande envoyée : attends que l’image soit nette.':'Mise au point non disponible. Essaie une autre caméra ou importe une photo.');};
$('capture').addEventListener('pointerdown',event=>{if(!live||paused||analysisBusy||capturePending)return;activeCaptureId='capture-'+(++captureSequence);pendingPress={id:activeCaptureId,at:performance.now()};manualIntent=true;trace('press',{captureId:activeCaptureId,eventTimeMs:event.timeStamp,inputDispatchDelayMs:Math.max(0,performance.now()-event.timeStamp)});const label=$('capture').querySelector('.shutterLabel');if(label)label.textContent='Photo demandée…';const feedbackId=activeCaptureId;requestAnimationFrame(()=>requestAnimationFrame(()=>trace('request_feedback_after_raf',{captureId:feedbackId,estimate:true})));$('capture').classList.add('capture-pressed');$('liveHint').textContent='Demande de photo reçue';cancelAutomatic('manual_press');if(nativeCamera)void nativeCamera.preview(true);});
function releaseCaptureIntent(){setTimeout(()=>{manualIntent=false;$('capture').classList.remove('capture-pressed');if(nativeCamera&&!paused&&!capturePending)void nativeCamera.preview(false);if(!capturePending){const label=$('capture').querySelector('.shutterLabel');if(label)label.textContent='Scanner';}},0);}
document.addEventListener('pointerup',releaseCaptureIntent);document.addEventListener('pointercancel',()=>{pendingPress=null;releaseCaptureIntent();});
$('start').onclick=startCamera;$('stop').onclick=stopCamera;$('capture').onclick=()=>{activeCaptureId=pendingPress&&performance.now()-pendingPress.at<2000?pendingPress.id:'capture-'+(++captureSequence);pendingPress=null;trace('click',{captureId:activeCaptureId});void analyseCamera();};$('again').onclick=restart;$('import').onclick=()=>$('photo').click();$('photo').onchange=e=>importPhoto(e.target.files[0]);
$('lang').onchange=()=>{catalog.reset();$('setList').replaceChildren();stopCamera();$('results').hidden=true;$('selection').hidden=true;selected=null;boot();};$('catalogBtn').onclick=()=>navigate('catalog');$('back').onclick=()=>navigate('scan');$('scanNav').onclick=()=>navigate('scan');$('portfolioNav').onclick=()=>navigate('portfolio');$('setFilter').oninput=renderSets;
$('search').onclick=async()=>{if(!ready||analysisBusy||capturePending)return;recognition.reset();paused=true;clearTimeout(timer);try{const candidates=await rpc('search',{query:$('name').value,number:$('number').value});$('results').hidden=false;$('again').hidden=false;$('resultTitle').textContent='Recherche catalogue';$('resultReason').textContent=candidates.length?candidates.length+' résultat(s). Confirme l’édition.':'Aucun résultat.';$('selection').hidden=true;selected=null;renderCandidates(candidates);}catch(e){status(e.message,true);}};
$('add').onclick=()=>{if(!selected)return;try{const current=readCollection();current.unshift({collectionId:collectionKey(),id:selected.id,name:selected.name,meta:$('selectionMeta').textContent,image:imageURL(selected),buy:$('buy').value,finish:$('finish').value,lang:selected.lang||$('lang').value,date:new Date().toLocaleDateString('fr-FR')});localStorage.setItem('tcgCards',JSON.stringify(current));collection=current;selected=null;$('selection').hidden=true;navigate('portfolio');}catch{status('Impossible d’enregistrer le portfolio. Vérifie l’espace disponible ; les anciennes données sont conservées.',true);}};
$('copyDiagnostics').onclick=async()=>{try{const report=diagnosticText();diagnosticsFrozen=true;$('debug').textContent=report;await navigator.clipboard.writeText(report);$('copyDiagnostics').textContent='Diagnostic copié';}catch{status('Sélectionne et copie le texte du diagnostic ci-dessus.');}};
document.addEventListener('visibilitychange',()=>{if(document.hidden&&(stream||nativeCamera?.active||$('start').disabled)){stopCamera();status('Caméra mise en pause. Rouvre-la pour reprendre.');}});window.addEventListener('pagehide',stopCamera);
 $('exportDiagnostics').onclick=async()=>{
 const button=$('exportDiagnostics');button.disabled=true;
 try{
  diagnosticsFrozen=true;
  const {filename,json}=diagnosticExport(diagnosticSnapshot(),'1.1.7');$('debug').textContent=json;
  if(typeof window.CraftDropNative?.shareDiagnostic==='function')await window.CraftDropNative.shareDiagnostic({filename,json});
  else{const blob=new Blob([json],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename;link.hidden=true;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
  status('Diagnostic exporté.');
 }catch(error){status('Export du diagnostic impossible : '+(error?.message||'vérifie le stockage disponible puis réessaie.'),true);}
 finally{button.disabled=false;}
};
$('stage').classList.add('idle');boot();


async function startNativeCamera(token){
 $('stage').scrollIntoView({behavior:'instant',block:'center'});
 nativeInfo=await nativeCamera.start(selectedCamera,
  async frame=>{
   trace('frame_received',{sequence:frame.sequence,native:frame.timing});
   if(token!==cameraToken||!live||paused||manualIntent||nativeFrameBusy){trace('frame_ignored',{reason:token!==cameraToken?'session':paused?'paused':manualIntent?'manual_intent':nativeFrameBusy?'decode_busy':'not_live'});return;}
   nativeFrameBusy=true;const started=performance.now();
   try{
    const image=await decodeNativePhoto(frame);if(token!==cameraToken||paused||manualIntent)return;
    trace('frame_decoded',{durationMs:performance.now()-started,width:image.width,height:image.height,guide:frame.guide,engineAlreadyCropped:false});
    const qualityStarted=performance.now(),q=focusGate.evaluate(nativeGuideImage(image,frame.guide),performance.now());trace('frame_quality_timing',{durationMs:performance.now()-qualityStarted});
    cameraDiagnostic={...cameraDiagnostic,focus:q};drawOutline(null,q.progress);$('liveHint').textContent=q.hint;
    $('capture').classList.toggle('photo-ready',q.ready);nativeCamera.quality(q);frameQuality(q);
    if(q.scanReady??q.ready)void analysePreview(()=>image,false);
   }catch(e){if(token===cameraToken&&!paused){trace('frame_error',{reason:e.message});recognition.reset('frame_error');focusGate.reset();nativeCamera.quality({progress:0,hint:'Place la carte dans le cadre.'});}}
   finally{nativeFrameBusy=false;}
  },()=>{if(token===cameraToken){stopCamera();status('Caméra mise en pause. Rouvre-la pour reprendre.');}},
  result=>{if(token===cameraToken){trace('focus_result',{success:result.success});recognition.reset('focus');focusGate.reset();cameraDiagnostic.focusSuccessful=result.success;}},
  event=>{if(token!==cameraToken)return;trace('native_'+event.phase,event);if(event.phase==='capture_started_callback'&&event.captureId===activeCaptureId){captureFeedback();$('liveHint').textContent='Début de capture signalé par la caméra';}}
 );
 if(token!==cameraToken)return;
 cameraDiagnostic={engine:'CameraX',label:nativeInfo.label,width:nativeInfo.width,height:nativeInfo.height,focusMode:'native',captureMode:nativeInfo.captureMode,jpegQuality:nativeInfo.jpegQuality,maxPhotoEdge:nativeInfo.maxPhotoEdge};
 trace('camera_started',cameraDiagnostic);
 live=true;paused=false;$('scanScreen').classList.add('camera-open');$('cameraPlaceholder').hidden=true;$('video').hidden=true;$('frozenPreview').hidden=true;$('stop').hidden=false;$('capture').hidden=false;$('autoScan').hidden=false;$('capture').disabled=false;$('liveHint').hidden=false;$('meter').hidden=false;$('stage').classList.remove('idle');$('cameraControls').hidden=false;showCameraState();await listCameras(token);
 if(ready)await rpc('reset');if(token===cameraToken)status('Caméra prête. Garde la carte stable, ou utilise le déclencheur.');
}
async function analyseNativeCamera(expectedId=null){
 if(!ready){status('Le catalogue est encore en préparation.');return;}
 if(analysisBusy||capturePending||!live||paused||!nativeCamera.active)return;
 if(expectedId||!activeCaptureId)activeCaptureId='capture-'+(++captureSequence);
 const captureId=activeCaptureId,token=cameraToken,job=++nativeCaptureSerial;
 cancelAutomatic(expectedId?'automatic_still':'manual_capture');capturePending=true;paused=true;
 $('capture').disabled=true;$('cameraSelect').disabled=true;$('refocus').disabled=true;$('import').disabled=true;
 status('Demande de photo envoyée…');trace('capture_bridge_send',{captureId,automatic:!!expectedId});
 let photo;
 try{
  photo=await nativeCamera.capture({captureId});if(token!==cameraToken)return;
  trace('jpeg_return',{captureId,native:photo.timing,sensorExposureMeasured:false});
  const decodeStart=performance.now(),image=await decodeNativePhoto(photo,(event,data)=>trace(event,{captureId,...data}),$('frozenPreview'));if(token!==cameraToken)return;
  trace('photo_decoded',{captureId,durationMs:performance.now()-decodeStart});
  cameraDiagnostic={...cameraDiagnostic,captureWidth:image.width,captureHeight:image.height};
  $('frozenPreview').hidden=false;
  await nativeCamera.hidePreview();if(token!==cameraToken)return;
  trace('photo_display_requested',{captureId});
  requestAnimationFrame(()=>requestAnimationFrame(()=>{if(token===cameraToken)trace('photo_display_after_raf',{captureId,estimate:true});}));
  // The photo is visible before teardown; do not wait for stop to identify it.
  if(!expectedId)void nativeCamera.stop().then(()=>trace('camera_teardown_done',{captureId})).catch(e=>trace('camera_teardown_error',{captureId,reason:e.message}));
  await analyseImage(image,false,null,true,expectedId);
 }catch(e){if(token===cameraToken){trace('capture_error',{captureId,reason:e.message});if(expectedId)resumeAutomatic();else{paused=false;void nativeCamera.preview(false);}status(e.message,true);}}
 finally{const label=$('capture').querySelector?.('.shutterLabel');if(label)label.textContent='Scanner';if(nativeCamera.release)void nativeCamera.release(photo).catch(e=>trace('photo_release_error',{captureId,reason:e.message}));if(job===nativeCaptureSerial){capturePending=false;$('import').disabled=false;}if(token===cameraToken){$('capture').disabled=!nativeCamera.active;if(nativeInfo){showCameraState();listCameras(token);}}}
}
