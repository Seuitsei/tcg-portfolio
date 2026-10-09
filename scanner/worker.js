'use strict';
importScripts('vision.js?v=20261009-4');
const V=ScannerVision;let engine=null,entries=[],allCards=[],sets=[],lang='fr',gate=new V.StabilityGate(),featuresCache=new Map(),prebuiltPacks=[],located=null,lastLocate=-Infinity;
let engineReady=new Promise((resolve,reject)=>{
 self.Module={onRuntimeInitialized:()=>resolve(),onAbort:()=>reject(Error('Le moteur visuel ne peut pas démarrer.'))};
 try{importScripts('vendor/opencv.js');engine=self.cv;if(engine.Mat)resolve();else engine.onRuntimeInitialized=()=>resolve();}catch(e){reject(e);}
});
const dbPromise=new Promise(resolve=>{
 try{const req=indexedDB.open('tcg-visual-cache-v1',1);req.onupgradeneeded=()=>req.result.createObjectStore('packs');req.onsuccess=()=>resolve(req.result);req.onerror=()=>resolve(null);req.onblocked=()=>resolve(null);}catch{resolve(null);}
});
async function cacheGet(key){const db=await dbPromise;if(!db)return null;return new Promise(resolve=>{try{const r=db.transaction('packs').objectStore('packs').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>resolve(null);}catch{resolve(null);}});}
async function cachePut(key,value){const db=await dbPromise;if(!db)return;return new Promise(resolve=>{try{const tx=db.transaction('packs','readwrite');tx.objectStore('packs').put(value,key);tx.oncomplete=tx.onerror=tx.onabort=()=>resolve();}catch{resolve();}});}
async function getJSON(url){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);try{const r=await fetch(url,{signal:controller.signal});if(!r.ok)throw Error('Chargement impossible ('+r.status+').');return await r.json();}finally{clearTimeout(timer);}}
function summary(){return {count:entries.length,sets:sets.map(s=>({...s,indexed:entries.filter(c=>c.setId===s.id).length,prepared:entries.filter(c=>c.setId===s.id&&c.orb).length})),lang};}
function addEntries(items){const seen=new Map(entries.map(c=>[c.id,c]));for(const e of items){if(seen.has(e.id)){if(e.orb)Object.assign(seen.get(e.id),{...e,v:Int8Array.from(e.v)});}else{e.v=Int8Array.from(e.v);entries.push(e);seen.set(e.id,e);}}}
function fromBase64(s){return Uint8Array.from(atob(s),c=>c.charCodeAt(0));}
function toBase64(bytes){let s='';for(let i=0;i<bytes.length;i++)s+=String.fromCharCode(bytes[i]);return btoa(s);}
async function referenceFeatures(entry){
 if(featuresCache.has(entry.id))return featuresCache.get(entry.id);
 if(!entry.orb){
  const key='orb-v1:'+lang+':'+entry.id;let f=await cacheGet(key);
  if(!f){const bytes=await fetchBytes(imageURL(entry));const bitmap=await createImageBitmap(new Blob([bytes]));let mat;try{const canvas=new OffscreenCanvas(bitmap.width,bitmap.height),ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);mat=engine.matFromImageData(ctx.getImageData(0,0,canvas.width,canvas.height));f=V.features(engine,mat);await cachePut(key,f);}finally{bitmap.close();V.dispose(mat);}}
  if(featuresCache.size>100)featuresCache.delete(featuresCache.keys().next().value);featuresCache.set(entry.id,f);return f;
 }
 const raw=fromBase64(entry.points),view=new DataView(raw.buffer),points=[];
 for(let i=0;i<raw.length;i+=4)points.push({x:view.getUint16(i,true)/16,y:view.getUint16(i+2,true)/16});
 const f={bytes:fromBase64(entry.orb),points};if(featuresCache.size>100)featuresCache.delete(featuresCache.keys().next().value);featuresCache.set(entry.id,f);return f;
}
function publicEntry(c){return {id:c.id,name:c.name,localId:c.localId,printedNumber:c.printedNumber,referenceLang:c.referenceLang,image:c.image,lang:c.lang||lang,setId:c.setId||c.id.slice(0,c.id.lastIndexOf('-')),setName:c.setName,total:c.total};}
function imageURL(c){return c.image+(/\.(png|jpg|webp)$/.test(c.image)?'':'/low.webp');}
async function fetchBytes(url){const ctrl=new AbortController(),t=setTimeout(()=>ctrl.abort(),15000);try{const r=await fetch(url,{signal:ctrl.signal});if(!r.ok)throw Error('Référence indisponible ('+r.status+').');return await r.arrayBuffer();}finally{clearTimeout(t);}}
async function init(data){
 lang=data.lang||'fr';entries=[];featuresCache.clear();gate.reset();located=null;lastLocate=-Infinity;
 const [catalog,allSets,manifest]=await Promise.all([getJSON(lang==='ja'?'data/catalog-ja.json':'data/catalog.json'),getJSON(lang==='ja'?'data/sets-ja.json':'data/sets.json'),getJSON('data/manifest.json')]);
 allCards=lang==='ja'?catalog:catalog[lang];sets=lang==='ja'?allSets:allSets[lang];
 postMessage({type:'progress',text:'Chargement de l’index visuel '+lang.toUpperCase()+'…'});
 const [global,blob]=await Promise.all([getJSON('data/vectors-'+lang+'.json'),fetchBytes('data/vectors-'+lang+'.bin')]);
 if(blob.byteLength!==global.cards.length*216)throw Error('Index visuel incomplet. Actualise la page.');
 const vectors=new Int8Array(blob),setMap=new Map(sets.map(s=>[s.id,s]));
 entries=global.cards.map((c,i)=>{const sid=c.id.slice(0,c.id.lastIndexOf('-')),set=setMap.get(sid);return {...c,lang,setId:sid,setName:set?.name,total:set?.cardCount.official,v:vectors.subarray(i*216,(i+1)*216)};});
 prebuiltPacks=manifest.packs.filter(p=>p.lang===lang);
 const packs=manifest.packs.filter(p=>p.lang===lang&&['base1','swsh4','swsh4.5','cel25cc'].includes(p.setId));let done=0;
 for(const pack of packs){
  const key=pack.file+':'+pack.sha256;let rows=await cacheGet(key);
  if(!rows){rows=await getJSON('data/'+pack.file);await cachePut(key,rows);}
  addEntries(rows);postMessage({type:'progress',text:'Préparation du catalogue '+lang.toUpperCase()+' · '+(++done)+'/'+packs.length,count:entries.length});
 }
 const custom=await cacheGet('custom:'+lang)||[];for(const sid of custom){const rows=await cacheGet('set:'+lang+':'+sid);if(rows)addEntries(rows);}
 await engineReady;return summary();
}
async function locateCard(src){
 const scene=V.features(engine,src,true);if(scene.points.length<40)return null;
 const samples=V.sceneSamples(engine,src),shortlist=V.rankVectors(samples.map(s=>s.v),entries,16);let best=null;
 const refs=new Map(),jobs=shortlist.slice(),deadline=performance.now()+8000;
 async function download(){while(jobs.length&&performance.now()<deadline){const rank=jobs.shift();try{refs.set(rank.index,await referenceFeatures(entries[rank.index]));}catch{}}}
 await Promise.all([download(),download(),download()]);
 for(const rank of shortlist){
  const ref=refs.get(rank.index);if(!ref)continue;
  const nearest=samples.map(s=>({s,d:V.vectorDistance(s.v,entries[rank.index].v)})).sort((a,b)=>a.d-b.d).slice(0,3);
  const attempts=[{f:scene,rect:{x:0,y:0,width:src.cols,height:src.rows}}];
  for(const {s} of nearest){if(!s.features){const roi=src.roi(new engine.Rect(s.rect.x,s.rect.y,s.rect.width,s.rect.height));try{s.features=V.features(engine,roi);}finally{roi.delete();}}attempts.push({f:s.features,rect:s.rect});}
  for(const {f,rect} of attempts){
   const match=V.verify(engine,f,ref);
   if(match.inliers<8||match.ratio<.5||match.referenceCoverage<.10||!match.corners)continue;
   const points=match.corners.map(p=>({x:(rect.x+p.x*rect.width)/src.cols,y:(rect.y+p.y*rect.height)/src.rows}));
   const full=V.capturePoints(points,src.cols,src.rows);if(!full)continue;
   const edges=full.map((p,i)=>Math.hypot(p.x-full[(i+1)%4].x,p.y-full[(i+1)%4].y));const ratio=(edges[0]+edges[2])/(edges[1]+edges[3]);
   if(ratio<.45||ratio>1.05||Math.max(edges[0]/edges[2],edges[2]/edges[0],edges[1]/edges[3],edges[3]/edges[1])>1.8)continue;
   const cx=points.reduce((n,p)=>n+p.x,0)/4,cy=points.reduce((n,p)=>n+p.y,0)/4;
   if(Math.abs(cx-.5)>.25||Math.abs(cy-.5)>.3)continue;
   const score=match.inliers*match.ratio*Math.min(1,match.referenceCoverage/.25);
   if(!best||score>best.score)best={points,score,id:entries[rank.index].id};
  }
 }
 return best;
}
async function frame(data){
 const src=engine.matFromImageData(data.image);let crop;
 try{
  let detection=V.detect(engine,src);let q=null,method='contours';
  if(!detection){
   if(data.now-lastLocate>1300){postMessage({type:'locating'});const start=performance.now();located=await locateCard(src);lastLocate=data.now+performance.now()-start;}
   if(located){const points=V.capturePoints(located.points,src.cols,src.rows);if(points){let area=0;points.forEach((p,i)=>{const b=points[(i+1)%4];area+=p.x*b.y-b.x*p.y;});detection={points,fraction:Math.abs(area)/2/src.cols/src.rows};method='details';}}
  }else located=null;
  if(detection){crop=V.warp(engine,src,detection.points);q=V.quality(engine,crop);}
  const state=gate.update(detection,q,src.cols,src.rows,data.now);
  if(method==='details'&&q&&(q.sharpness<55||q.brightness<45||q.glare>.2))located=null;
  return {...state,stableFrames:gate.frames,points:detection?.points.map(p=>({x:p.x/src.cols,y:p.y/src.rows}))||null,quality:q?{sharpness:q.sharpness,glare:q.glare,brightness:q.brightness}:null,method};
 }finally{V.dispose(src,crop);}
}
async function analyse(data){
 const t=performance.now(),src=engine.matFromImageData(data.image);let card,rotated;
 try{
  const captured=data.alreadyCropped?null:V.capturePoints(data.points,src.cols,src.rows);
  let detection=data.alreadyCropped?null:captured?{points:captured}:V.detect(engine,src);
  if(!data.alreadyCropped&&(data.manual||!detection)){const details=await locateCard(src);if(details)detection={points:V.capturePoints(details.points,src.cols,src.rows)};}
  if(data.alreadyCropped){card=new engine.Mat();engine.resize(src,card,new engine.Size(V.WIDTH,V.HEIGHT),0,0,engine.INTER_AREA);}
  else if(detection)card=V.warp(engine,src,detection.points);
  else return {kind:'reject',reason:'Carte non localisée. Centre une seule carte entière, puis reprends une photo.',candidates:[],ms:performance.now()-t};
  const q=V.quality(engine,card);
  if(q.sharpness<40||q.brightness<35||q.glare>.28)return {kind:'reject',reason:'Photo trop floue, sombre ou réfléchissante. Réessaie sous une lumière diffuse.',candidates:[],ms:performance.now()-t};
  const upright=V.descriptor(engine,card);rotated=new engine.Mat();engine.rotate(card,rotated,engine.ROTATE_180);const inverted=V.descriptor(engine,rotated);
  let shortlist=V.rankVectors([upright,inverted],entries,16);
  const top=entries[shortlist[0]?.index];if(!top)return {kind:'reject',reason:'Prépare au moins une extension dans le catalogue visuel.',candidates:[]};
  // Include same-name/number printings even if the artwork shortlist missed them.
  const siblings=entries.map((e,i)=>({e,i})).filter(({e})=>e.name===top.name&&V.normaliseNumber(e.localId)===V.normaliseNumber(top.localId));
  for(const {e,i} of siblings)if(!shortlist.some(s=>s.index===i))shortlist.push({index:i,distance:Math.min(V.vectorDistance(upright,e.v),V.vectorDistance(inverted,e.v))});
  const query=V.features(engine,card),ranks=[];let unavailable=0;
  // At most 16 normal candidates plus explicit reprints; three reference downloads at a time.
  const references=new Map(),queue=shortlist.slice();
  async function load(){while(queue.length){const s=queue.shift();try{references.set(s.index,await referenceFeatures(entries[s.index]));}catch{unavailable++;}}}
  await Promise.all([load(),load(),load()]);
  for(const s of shortlist){
   const e=entries[s.index],ref=references.get(s.index);if(!ref)continue;const verified=V.verify(engine,query,ref);
   // Geometric evidence carries more weight than coarse visual resemblance.
   const evidence=verified.inliers*Math.min(1,verified.coverage/.2)*verified.ratio/(1+s.distance);
   ranks.push({...publicEntry(e),...verified,distance:s.distance,evidence});
  }
  ranks.sort((a,b)=>b.evidence-a.evidence||a.distance-b.distance);
  if(!ranks.length)return {kind:'reject',reason:'Les références ne sont pas accessibles. Vérifie ta connexion pour ce premier scan ; les références déjà préparées restent locales.',candidates:[],ms:Math.round(performance.now()-t)};
  const winner=ranks[0];const indexedIds=new Set(entries.map(e=>e.id));const missing=allCards.filter(c=>c.name===winner?.name&&V.normaliseNumber(c.localId)===V.normaliseNumber(winner.localId)&&!indexedIds.has(c.id));
  const variantRivals=entries.filter(e=>e.id!==winner.id&&e.name===winner.name&&V.normaliseNumber(e.localId)===V.normaliseNumber(winner.localId));
  const kind=V.decision(ranks,missing.length>0||unavailable>0||variantRivals.length>0||winner.referenceLang&&winner.referenceLang!==lang);
  const candidates=ranks.filter((r,i)=>i===0||r.inliers>=8&&r.coverage>=.06).slice(0,3);
  for(const rival of variantRivals){if(!candidates.some(c=>c.id===rival.id)&&candidates.length<5)candidates.push(ranks.find(r=>r.id===rival.id)||{...publicEntry(rival),unverified:true});}
  // An unindexed reprint is never silently treated as excluded.
  for(const c of missing.slice(0,2)){const sid=c.id.slice(0,c.id.lastIndexOf('-')),s=sets.find(s=>s.id===sid);candidates.push({...publicEntry(c),setName:s?.name,unverified:true});}
  return {kind,candidates,reason:kind==='strong'?'Correspondance visuelle forte. Vérifie la finition avant ajout.':kind==='candidates'?(unavailable?'Correspondance à confirmer : certaines références n’ont pas pu être vérifiées.':variantRivals.length?'Plusieurs éditions restent possibles : compare la carte et son logo.':'Correspondance visuelle à confirmer.'):'Aucune correspondance suffisamment solide. Repositionne la carte ou prépare son extension.',ms:Math.round(performance.now()-t),quality:{sharpness:q.sharpness,glare:q.glare},preview:{data:card.data.slice(),width:card.cols,height:card.rows},coverage:entries.length,unavailable};
 }finally{V.dispose(src,card,rotated);}
}
async function prepareSet(data){
 const info=sets.find(s=>s.id===data.setId);if(!info)throw Error('Extension inconnue.');
 const builtPack=prebuiltPacks.find(p=>p.setId===info.id&&p.count>0);
 if(builtPack){const key=builtPack.file+':'+builtPack.sha256;const rows=await cacheGet(key)||await getJSON('data/'+builtPack.file);await cachePut(key,rows);addEntries(rows);await cachePut('set:'+lang+':'+info.id,rows);const custom=await cacheGet('custom:'+lang)||[];await cachePut('custom:'+lang,Array.from(new Set([...custom,info.id])));return {...summary(),failures:Math.max(0,info.cardCount.total-rows.length)};}
 const candidates=allCards.filter(c=>c.id.slice(0,c.id.lastIndexOf('-'))===info.id&&c.image&&!entries.some(e=>e.id===c.id&&e.orb));
 let done=0,failures=0;const built=[];
 async function run(){while(candidates.length){const c=candidates.shift();let bitmap,mat,canvas;
  try{
   const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),20000);let r;
   try{r=await fetch(imageURL(c),{signal:ctrl.signal});if(!r.ok)throw Error('Image indisponible');bitmap=await createImageBitmap(await r.blob());}finally{clearTimeout(timer);}
   canvas=new OffscreenCanvas(bitmap.width,bitmap.height);const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);mat=engine.matFromImageData(ctx.getImageData(0,0,canvas.width,canvas.height));
   const v=Array.from(V.descriptor(engine,mat)),f=V.features(engine,mat),pts=new Uint8Array(f.points.length*4),view=new DataView(pts.buffer);f.points.forEach((p,i)=>{view.setUint16(i*4,Math.round(p.x*16),true);view.setUint16(i*4+2,Math.round(p.y*16),true);});
   built.push({...c,lang,setId:info.id,setName:info.name,total:info.cardCount.official,v,orb:toBase64(f.bytes),points:toBase64(pts)});
  }catch{failures++;}finally{bitmap?.close();V.dispose(mat);done++;postMessage({type:'progress',text:'Préparation de '+info.name+' · '+done+' images traitées'+(failures?' · '+failures+' indisponible(s)':''),count:entries.length+built.length});}
 }}
 await Promise.all([run(),run(),run()]);addEntries(built);
 const saved=entries.filter(e=>e.setId===info.id).map(e=>({...e,v:Array.from(e.v)}));await cachePut('set:'+lang+':'+info.id,saved);
 const custom=await cacheGet('custom:'+lang)||[];await cachePut('custom:'+lang,Array.from(new Set([...custom,info.id])));
 return {...summary(),failures};
}
function search(data){
 const term=String(data.query||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const number=V.normaliseNumber(data.number||''),[numerator,denominator]=number.split('/');
 return allCards.filter(c=>{
  if(term&&!c.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(term))return false;
  if(numerator&&V.normaliseNumber(c.localId)!==numerator)return false;
  if(denominator){const sid=c.id.slice(0,c.id.lastIndexOf('-')),s=sets.find(s=>s.id===sid);if(String(s?.cardCount.official)!==denominator&&sid!=='cel25cc')return false;}
  return !!(term||number);
 }).slice(0,40).map(c=>{const sid=c.id.slice(0,c.id.lastIndexOf('-')),s=sets.find(s=>s.id===sid);return {...publicEntry(c),setName:s?.name};});
}
self.onmessage=async event=>{
 const {id,type,...data}=event.data;
 try{
  let result;if(type==='init')result=await init(data);else{await engineReady;
   if(type==='frame')result=await frame(data);else if(type==='analyse')result=await analyse(data);else if(type==='prepare')result=await prepareSet(data);else if(type==='search')result=search(data);else if(type==='setCards'){const set=sets.find(s=>s.id===data.setId);if(!set)throw Error('Extension inconnue.');result=allCards.filter(c=>(c.setId||c.id.slice(0,c.id.lastIndexOf('-')))===set.id).map(c=>({...publicEntry(c),setName:set.name})).sort((a,b)=>a.localId.localeCompare(b.localId,undefined,{numeric:true}));}else if(type==='reset'){gate.reset();located=null;lastLocate=-Infinity;result=true;}else throw Error('Commande inconnue.');
  }
  postMessage({id,type:'result',result});
 }catch(error){postMessage({id,type:'error',error:error.message||String(error)});}
};
