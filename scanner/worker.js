'use strict';
importScripts('vision.js?v=20261009-10','reference-packs.js?v=20261009-10','detail-index.js?v=20261009-10');
const DATA_VERSION='20261009-10',packedReferences=new Map(),packedLoads=new Map(),packedSizes=new Map();let referencePacks=new Map(),packedBytes=0;
let preparedRecovered=new Set();
let detailSpec=null,detailIndex=null,detailLoad=null;
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
function summary(){return {count:entries.length,sets:sets.map(s=>({...s,indexed:entries.filter(c=>c.setId===s.id).length,prepared:entries.filter(c=>c.setId===s.id&&(c.orb||c.referencePack&&preparedRecovered.has(c.referencePack))).length})),lang};}
function addEntries(items){const seen=new Map(entries.map(c=>[c.id,c]));for(const e of items){if(seen.has(e.id)){if(e.orb)Object.assign(seen.get(e.id),{...e,v:Int8Array.from(e.v)});}else{e.v=Int8Array.from(e.v);entries.push(e);seen.set(e.id,e);}}}
function fromBase64(s){return Uint8Array.from(atob(s),c=>c.charCodeAt(0));}
function toBase64(bytes){let s='';for(let i=0;i<bytes.length;i++)s+=String.fromCharCode(bytes[i]);return btoa(s);}
async function referenceFeatures(entry,enhance=false){
 if(entry.referencePack){
  const pack=referencePacks.get(entry.referencePack),asset=pack?.[enhance?'foil':'normal'];
  if(!asset)throw Error('Référence préparée indisponible.');
  const key='recovered:'+asset.sha256;
  let rows=packedReferences.get(key);
  if(!rows){
   if(!packedLoads.has(key))packedLoads.set(key,(async()=>{
    let bytes=await cacheGet(key);
    if(!bytes){bytes=await fetchBytes('data/'+asset.file);if(bytes.byteLength!==asset.bytes)throw Error('Pack de références incomplet.');if(asset.file.endsWith('.gz'))bytes=await unpackGzip(bytes);if(bytes.byteLength!==(asset.rawBytes||asset.bytes))throw Error('Pack de références incomplet.');ScannerReferencePacks.decodeReferencePack(bytes);await cachePut(key,bytes);}
    const rows=ScannerReferencePacks.decodeReferencePack(bytes);if(Object.keys(rows).length!==pack.count)throw Error('Pack de références incohérent.');
    // Keep a bounded number of decoded packs; the on-device cache retains downloaded bytes.
    while(packedReferences.size&&(packedReferences.size>=8||packedBytes+bytes.byteLength>16*1024*1024)){const old=packedReferences.keys().next().value;packedBytes-=packedSizes.get(old);packedSizes.delete(old);packedReferences.delete(old);}
    packedReferences.set(key,rows);packedSizes.set(key,bytes.byteLength);packedBytes+=bytes.byteLength;return rows;
   })().finally(()=>packedLoads.delete(key)));
   rows=await packedLoads.get(key);
  }
  const f=rows?.[entry.id];if(!f)throw Error('Référence absente du pack.');return f;
 }
 if(enhance&&entry.foil)return {...entry.foil,bytes:Uint8Array.from(entry.foil.bytes)};
 if(enhance){const key="orb-foil-v1:"+lang+":"+entry.id;if(featuresCache.has(key))return featuresCache.get(key);let f=await cacheGet(key);if(!f){const bytes=await fetchBytes(imageURL(entry)),bitmap=await createImageBitmap(new Blob([bytes]));let mat;try{const canvas=new OffscreenCanvas(bitmap.width,bitmap.height),ctx=canvas.getContext("2d");ctx.drawImage(bitmap,0,0);mat=engine.matFromImageData(ctx.getImageData(0,0,canvas.width,canvas.height));f=V.features(engine,mat,false,true);await cachePut(key,f);}finally{bitmap.close();V.dispose(mat);}}if(featuresCache.size>100)featuresCache.delete(featuresCache.keys().next().value);featuresCache.set(key,f);return f;}
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
async function fetchBytes(url,timeout=15000){const ctrl=new AbortController(),t=setTimeout(()=>ctrl.abort(),timeout);try{const r=await fetch(url,{signal:ctrl.signal});if(!r.ok)throw Error('Référence indisponible ('+r.status+').');return await r.arrayBuffer();}finally{clearTimeout(t);}}
async function unpackGzip(bytes){if(typeof DecompressionStream==='undefined')throw Error('La décompression des références nécessite un navigateur à jour.');return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();}
async function loadDetailIndex(){
 if(detailIndex)return detailIndex;if(!detailSpec||typeof DecompressionStream==='undefined')return null;
 if(!detailLoad){const spec=detailSpec;detailLoad=(async()=>{const key='detail:'+spec.sha256;let bytes=await cacheGet(key);if(!bytes){const parts=await Promise.all(spec.files.map(async part=>{const bytes=await fetchBytes('data/'+part.file,45000);if(bytes.byteLength!==part.bytes)throw Error('Index de détails incomplet.');return bytes;}));const joined=new Uint8Array(spec.bytes);let offset=0;for(const part of parts){joined.set(new Uint8Array(part),offset);offset+=part.byteLength;}const packed=joined.buffer;if(packed.byteLength!==spec.bytes)throw Error('Index de détails incomplet.');bytes=await unpackGzip(packed);if(bytes.byteLength!==spec.rawBytes)throw Error('Index de détails incomplet.');await cachePut(key,bytes);}const parsed=ScannerDetailIndex.decode(bytes,spec.ids);if(detailSpec===spec)detailIndex=parsed;return parsed;})().finally(()=>detailLoad=null);}
 try{return await detailLoad;}catch{return null;}
}
async function init(data){
 lang=data.lang||'fr';entries=[];featuresCache.clear();packedReferences.clear();packedLoads.clear();packedSizes.clear();packedBytes=0;gate.reset();located=null;lastLocate=-Infinity;
 detailSpec=null;detailIndex=null;detailLoad=null;
 const [catalog,allSets,manifest]=await Promise.all([getJSON((lang==='ja'?'data/catalog-ja.json':'data/catalog.json')+'?v='+DATA_VERSION),getJSON(lang==='ja'?'data/sets-ja.json':'data/sets.json'),getJSON('data/manifest.json')]);
 allCards=lang==='ja'?catalog:catalog[lang];sets=lang==='ja'?allSets:allSets[lang];
 postMessage({type:'progress',text:'Chargement de l’index visuel '+lang.toUpperCase()+'…'});
 const [global,blob,recovered,details]=await Promise.all([getJSON('data/vectors-'+lang+'.json?v='+DATA_VERSION),fetchBytes('data/vectors-'+lang+'.bin?v='+DATA_VERSION),getJSON('data/recovered-references.json?v='+DATA_VERSION),getJSON('data/detail-index.json?v='+DATA_VERSION)]);
 referencePacks=new Map(recovered.packs.filter(p=>p.lang===lang).map(p=>[p.key,p]));
 preparedRecovered=new Set((await cacheGet('prepared-recovered:'+lang+':'+DATA_VERSION)||[]).filter(key=>referencePacks.has(key)));
 detailSpec=details.packs.find(p=>p.lang===lang)||null;
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
 if(lang==='fr'){const extra=await getJSON('data/fr-cel25-extra.json');addEntries(extra);for(const e of extra){const card=allCards.find(c=>c.id===e.id);if(card)Object.assign(card,publicEntry(e));}}
 await engineReady;if(detailSpec){postMessage({type:'progress',text:'Préparation du scanner '+lang.toUpperCase()+'…'});await loadDetailIndex();}return summary();
}
function localisationFeatures(f){
 const limit=700;if(f.points.length<=limit)return f;
 const points=[],bytes=new Uint8Array(limit*32);
 for(let i=0;i<limit;i++){const j=Math.floor(i*f.points.length/limit);points.push(f.points[j]);bytes.set(f.bytes.subarray(j*32,j*32+32),i*32);}
 return {...f,points,bytes};
}
async function locateCard(src,enhance=false,normalScene=null){
 const compact=f=>Math.max(src.cols,src.rows)>900?localisationFeatures(f):f;
 const scene=compact(V.features(engine,src,true,enhance));if(scene.points.length<40)return null;
 const samples=V.sceneSamples(engine,src,enhance);let shortlist=V.rankVectors(samples.filter(s=>!s.additional).map(s=>s.v),entries,enhance?40:16),best=null;
 if(enhance){
  const extra=[],regional=[],index=await loadDetailIndex();
  if(index){const queries=normalScene?[normalScene,scene]:[scene];for(const s of samples){const roi=src.roi(new engine.Rect(s.rect.x,s.rect.y,s.rect.width,s.rect.height));try{queries.push(V.features(engine,roi));}finally{roi.delete();}}
   const nominated=ScannerDetailIndex.rank(index,queries,3),positions=new Map(entries.map((e,i)=>[e.id,i]));for(const item of nominated){const i=positions.get(item.id);if(i!==undefined)extra.push({index:i,distance:Math.min(...samples.map(s=>V.vectorDistance(s.v,entries[i].v)))});}
  }
  // Separate regional retrieval avoids eliminating a good card because another
  // window contains a neighbouring card or the black binder fabric.
  for(const s of samples.filter(s=>s.additional))for(const candidate of V.rankVectors([s.v],entries,4))if(!regional.some(e=>e.index===candidate.index))regional.push(candidate);
  const mixed=[];for(let i=0;i<Math.max(extra.length,Math.min(4,regional.length));i++)for(const candidate of [extra[i],regional[i<4?i:-1]])if(candidate&&!mixed.some(e=>e.index===candidate.index))mixed.push(candidate);
  const legacy=entries.map((e,index)=>({...e,index})).filter(e=>!e.referencePack);
  const baseline=V.rankVectors(samples.filter(s=>!s.additional).map(s=>s.v),legacy,40).map(s=>({...s,index:legacy[s.index].index}));
  shortlist=[...mixed.map(s=>({...s,detail:true})),...baseline.filter(s=>!mixed.some(e=>e.index===s.index))];
 }
 const pending=new Map();let referenceWait=0;
 const prefetch=i=>{if(i<shortlist.length&&!pending.has(i)&&referenceWait<8000)pending.set(i,referenceFeatures(entries[shortlist[i].index],enhance).catch(()=>null));};
 prefetch(0);prefetch(1);prefetch(2);
 for(let i=0;i<shortlist.length;i++){
  const rank=shortlist[i],waiting=performance.now(),loaded=await pending.get(i),ref=loaded&&compact(loaded);referenceWait+=performance.now()-waiting;pending.delete(i);prefetch(i+3);if(!ref)continue;
  const nearest=samples.filter(s=>rank.detail||!s.additional).map(s=>({s,d:V.vectorDistance(s.v,entries[rank.index].v)})).sort((a,b)=>a.d-b.d).slice(0,enhance?2:3);
  const attempts=[{f:scene,rect:{x:0,y:0,width:src.cols,height:src.rows}}];
  for(const {s} of nearest){if(!s.features){const roi=src.roi(new engine.Rect(s.rect.x,s.rect.y,s.rect.width,s.rect.height));try{s.features=compact(V.features(engine,roi,false,enhance));}finally{roi.delete();}}attempts.push({f:s.features,rect:s.rect});}
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
  if(best?.score>=24)break;
 }
 return best||(!enhance?await locateCard(src,true,scene):null);
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
  let detailed=null;
  let detection=data.alreadyCropped?null:captured?{points:captured}:V.detect(engine,src);
  if(!data.alreadyCropped&&(data.manual||!detection)){const details=await locateCard(src);if(details){detailed=details;detection={points:V.capturePoints(details.points,src.cols,src.rows)};}}
  if(data.alreadyCropped){card=new engine.Mat();engine.resize(src,card,new engine.Size(V.WIDTH,V.HEIGHT),0,0,engine.INTER_AREA);}
  else if(detection)card=V.warp(engine,src,detection.points);
  else return {kind:'reject',reason:'Carte non localisée. Centre une seule carte entière, puis reprends une photo.',candidates:[],ms:performance.now()-t};
  const q=V.quality(engine,card);
  if(q.sharpness<40||q.brightness<35||q.glare>.28)return {kind:'reject',reason:'Photo trop floue, sombre ou réfléchissante. Réessaie sous une lumière diffuse.',candidates:[],ms:performance.now()-t};
  const upright=V.descriptor(engine,card);rotated=new engine.Mat();engine.rotate(card,rotated,engine.ROTATE_180);const inverted=V.descriptor(engine,rotated);
  let shortlist=V.rankVectors([upright,inverted],entries,16);
  const query=V.features(engine,card);
  if(!detailed&&!located){const index=await loadDetailIndex();if(index){const positions=new Map(entries.map((e,i)=>[e.id,i]));for(const candidate of ScannerDetailIndex.rank(index,[query],8)){const i=positions.get(candidate.id);if(i!==undefined&&!shortlist.some(s=>s.index===i))shortlist.push({index:i,distance:Math.min(V.vectorDistance(upright,entries[i].v),V.vectorDistance(inverted,entries[i].v))});}}}
  const locatedIndex=entries.findIndex(e=>e.id===(detailed?.id||located?.id));
  if(locatedIndex>=0&&!shortlist.some(s=>s.index===locatedIndex))shortlist.push({index:locatedIndex,distance:Math.min(V.vectorDistance(upright,entries[locatedIndex].v),V.vectorDistance(inverted,entries[locatedIndex].v))});
  const top=entries[shortlist[0]?.index];if(!top)return {kind:'reject',reason:'Prépare au moins une extension dans le catalogue visuel.',candidates:[]};
  // Include same-name/number printings even if the artwork shortlist missed them.
  const siblings=entries.map((e,i)=>({e,i})).filter(({e})=>e.name===top.name&&V.normaliseNumber(e.localId)===V.normaliseNumber(top.localId));
  for(const {e,i} of siblings)if(!shortlist.some(s=>s.index===i))shortlist.push({index:i,distance:Math.min(V.vectorDistance(upright,e.v),V.vectorDistance(inverted,e.v))});
  const ranks=[];let unavailable=0;
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
  // Recheck weak geometry at higher detail; retain the existing confidence rules.
  if(!ranks.some(r=>r.inliers>=24&&r.coverage>=.22&&r.ratio>=.65)){
   const detailCard=data.alreadyCropped?src:V.warp(engine,src,detection.points,2);
   try{const detailQuery=V.features(engine,detailCard,false,true);
    const extra=V.rankVectors([upright,inverted],entries,detailed||located?16:40);for(const s of shortlist)if(!extra.some(x=>x.index===s.index))extra.push(s);
    const detailRefs=new Map(),jobs=extra.slice(),deadline=performance.now()+8000;async function detailLoad(){while(jobs.length&&performance.now()<deadline){const s=jobs.shift();try{detailRefs.set(s.index,await referenceFeatures(entries[s.index],true));}catch{unavailable++;}}}await Promise.all([detailLoad(),detailLoad(),detailLoad()]);unavailable+=jobs.length;
    for(const s of extra){const ref=detailRefs.get(s.index);if(!ref)continue;const verified=V.verify(engine,detailQuery,ref);if(verified.inliers<12||verified.ratio<.55||verified.referenceCoverage<.15)continue;const e=entries[s.index],evidence=verified.inliers*Math.min(1,verified.coverage/.2)*verified.ratio/(1+s.distance),old=ranks.find(r=>r.id===e.id);if(!old||evidence>old.evidence){if(old)ranks.splice(ranks.indexOf(old),1);ranks.push({...publicEntry(e),...verified,distance:s.distance,evidence});}}
   }finally{if(detailCard!==src)detailCard.delete();}
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
 let recoveredFailures=0;
 for(const pack of referencePacks.values())if(pack.setId===info.id){
  const entry=entries.find(e=>e.referencePack===pack.key);
  try{postMessage({type:'progress',text:'Préparation des références de '+info.name+'…'});await referenceFeatures(entry);await referenceFeatures(entry,true);preparedRecovered.add(pack.key);await cachePut('prepared-recovered:'+lang+':'+DATA_VERSION,Array.from(preparedRecovered));}catch{recoveredFailures+=pack.count;}
 }
 const candidates=allCards.filter(c=>c.id.slice(0,c.id.lastIndexOf('-'))===info.id&&c.image&&!entries.some(e=>e.id===c.id&&(e.orb||e.referencePack)));
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
 return {...summary(),failures:failures+recoveredFailures};
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
