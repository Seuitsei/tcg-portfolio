/* Actual worker with locally routed prepared data. Synthetic distortions, no phone accuracy claim. */
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),vm=require('vm'),zlib=require('zlib'),crypto=require('crypto');
const sharp=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/sharp');
const cv=require('../scanner/vendor/opencv.js'),V=require('../scanner/vision.js'),D=require('../scanner/detail-index.js'),P=require('../scanner/reference-packs.js');
const root=path.resolve(__dirname,'..'),data=root+'/scanner/data',target=data+'/japanese-test';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
 await new Promise(r=>cv.Mat?r():cv.then(()=>r()));
 const meta=JSON.parse(fs.readFileSync(target+'/vectors-ja.json')),old=JSON.parse(fs.readFileSync(data+'/vectors-ja.json')),vectors=fs.readFileSync(target+'/vectors-ja.bin'),original=fs.readFileSync(data+'/vectors-ja.bin');
 assert.equal(meta.cards.length,9986);assert.equal(vectors.length,meta.cards.length*216);assert(vectors.subarray(0,original.length).equals(original));assert.deepEqual(meta.cards.slice(0,old.cards.length),old.cards);
 const packs=JSON.parse(fs.readFileSync(target+'/recovered-references.json')).packs,oldPacks=JSON.parse(fs.readFileSync(data+'/recovered-references.json')).packs;
 assert.deepEqual(packs.filter(p=>p.lang!=='ja'),oldPacks.filter(p=>p.lang!=='ja'));
 const ids=new Set();let points=0;
 for(const p of packs.filter(p=>p.lang==='ja'))for(const mode of ['normal','foil']){
  const b=fs.readFileSync(data+'/'+p[mode].file);assert.equal(b.length,p[mode].bytes);assert.equal(hash(b),p[mode].sha256);
  const raw=zlib.gunzipSync(b);assert.equal(raw.length,p[mode].rawBytes);const decoded=P.decodeReferencePack(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.length));assert.equal(Object.keys(decoded).length,p.count);
  for(const [id,f] of Object.entries(decoded)){assert(meta.cards.some(c=>c.id===id&&c.referencePack===p.key));if(mode==='normal'){assert(!ids.has(id));ids.add(id);}assert.equal(f.bytes.length,f.points.length*32);points+=f.points.length;}
 }
 assert.equal(ids.size,6108);
 const spec=JSON.parse(fs.readFileSync(target+'/detail-index.json')).packs.find(p=>p.lang==='ja');assert.equal(spec.cards,6108);assert.deepEqual(new Set(spec.ids),ids);
 const blob=Buffer.concat(spec.files.map(p=>fs.readFileSync(data+'/'+p.file)));assert.equal(hash(blob),spec.sha256);const raw=zlib.gunzipSync(blob);assert.equal(raw.length,spec.rawBytes);D.decode(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.length),spec.ids);
 let result;const fetched=[];
 const legacyImages=new Map(['SV7-001','SV2a-006'].map(id=>[old.cards.find(c=>c.id===id).image+'/low.webp',path.resolve(root,'tests/fixtures/japanese',id+'.webp')]));
 const createImageBitmap=async blob=>{const {data,info}=await sharp(Buffer.from(await blob.arrayBuffer())).ensureAlpha().raw().toBuffer({resolveWithObject:true});return {data,width:info.width,height:info.height,close(){}};};
 class OffscreenCanvas{constructor(width,height){this.width=width;this.height=height;}getContext(){const canvas=this;return {drawImage(bitmap){canvas.bitmap=bitmap;},getImageData(){return {width:canvas.width,height:canvas.height,data:new Uint8ClampedArray(canvas.bitmap.data)};}};}}
 const ctx={createImageBitmap,OffscreenCanvas,ScannerVision:V,ScannerDetailIndex:D,ScannerReferencePacks:P,self:{cv},location:{search:'?jp=20261010'},URLSearchParams,importScripts(){},postMessage:r=>result=r,setTimeout,clearTimeout,performance,AbortController,Response,Blob,DecompressionStream,atob:s=>Buffer.from(s,'base64').toString('binary'),fetch:async url=>{
  fetched.push(url);if(/^https?:/.test(url)){if(legacyImages.has(url))return new Response(fs.readFileSync(legacyImages.get(url)));throw Error('External reference unavailable in offline test');}const file=root+'/scanner/'+url.split('?')[0];return new Response(fs.readFileSync(file));
 }};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(root+'/scanner/worker.js','utf8'),ctx);
 await ctx.self.onmessage({data:{id:1,type:'init',lang:'ja'}});assert.equal(result.type,'result',result.error);assert.equal(result.result.count,9986);assert(fetched.some(u=>u.includes('japanese-test/vectors-ja.json')));
 const audit=JSON.parse(zlib.gunzipSync(fs.readFileSync(root+'/docs/japanese-reference-research.json.gz'))),verified=audit.cards.filter(c=>c.status==='verified');
 const sample=[];const series=new Set();for(const c of (process.env.JAPANESE_LEGACY_ONLY?[]:verified)){if(series.has(c.setId))continue;sample.push(c);series.add(c.setId);if(sample.length===24)break;}
 if(!process.env.JAPANESE_LEGACY_ONLY)for(const sid of ['M2a','SV11B','SV11W','S8b','SM12a','SV-P','MC','M6']){const card=verified.find(c=>c.setId===sid);if(card&&!sample.some(c=>c.id===card.id))sample.push(card);}
 const report={kind:'synthetic-reference-distortions-actual-worker',references:9986,newReferences:6108,checkedPacks:packs.filter(p=>p.lang==='ja').length,orbPoints:points,trials:[],negatives:[],externalReferences:'Old TCGdex refs deliberately unavailable; confidence remains conservative when a rival cannot be checked.'};
 for(const c of sample){
  const file=path.resolve(root,'../jp-reference-cache',c.reference.file);
  for(const mode of ['clean','camera','glare']){
   let image=sharp(file).resize(504,704);
   if(mode!=='clean')image=image.blur(.5).modulate({brightness:.90,saturation:.85});
   if(mode==='glare')image=image.composite([{input:Buffer.from('<svg width="504" height="704"><circle cx="340" cy="280" r="42" fill="white"/></svg>')}]);
   const {data:bytes,info}=await image.ensureAlpha().raw().toBuffer({resolveWithObject:true});
   await ctx.self.onmessage({data:{id:2,type:'analyse',alreadyCropped:true,image:{width:info.width,height:info.height,data:new Uint8ClampedArray(bytes)}}});
   assert.equal(result.type,'result',result.error);const r=result.result;report.trials.push({id:c.id,mode,top:r.candidates[0]?.id,kind:r.kind,ms:r.ms,unavailable:r.unavailable,inliers:r.candidates[0]?.inliers});
   assert(!(r.kind==='strong'&&r.candidates[0]?.id!==c.id),'False confident identity '+c.id);
   if(mode==='clean')assert.equal(r.candidates[0]?.id,c.id,'Clean identity '+c.id);
  }
  console.log('tested',c.id);
 }
 // Full-photo path: a centred reference in a binder-like dark background.
 report.manualScenes=[];
 for(const c of sample.slice(0,3)){
  const {data:bytes,info}=await sharp(path.resolve(root,'../jp-reference-cache',c.reference.file)).resize(378,528).extend({left:131,right:131,top:186,bottom:186,background:{r:36,g:41,b:39,alpha:1}}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  await ctx.self.onmessage({data:{id:5,type:'analyse',manual:true,points:[{x:131/640,y:186/900},{x:509/640,y:186/900},{x:509/640,y:714/900},{x:131/640,y:714/900}],image:{width:info.width,height:info.height,data:new Uint8ClampedArray(bytes)}}});
  assert.equal(result.type,'result',result.error);assert.equal(result.result.candidates[0]?.id,c.id);assert.notEqual(result.result.kind,'reject');
  report.manualScenes.push({id:c.id,top:result.result.candidates[0]?.id,kind:result.result.kind,ms:result.result.ms});console.log('manual',c.id);
 }
 report.legacyControls=[];
 // For these controls, unavailable unrelated old refs are simulated as nonmatches.
 // This removes the unavailable-reference guard and tests the reprint guard alone.
 ctx.originalRef=vm.runInContext('referenceFeatures',ctx);ctx.emptyRef={points:[],bytes:new Uint8Array()};vm.runInContext('referenceFeatures=async(...args)=>{try{return await originalRef(...args);}catch{return emptyRef;}};',ctx);
 for(const cid of ['SV7-001','SV2a-006']){
  const sid=cid.slice(0,cid.lastIndexOf('-'));await ctx.self.onmessage({data:{id:6,type:'prepare',setId:sid}});assert.equal(result.type,'result',result.error);
  const {data:bytes,info}=await sharp(path.resolve(root,'tests/fixtures/japanese',cid+'.webp')).resize(504,704).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  await ctx.self.onmessage({data:{id:7,type:'analyse',alreadyCropped:true,image:{width:info.width,height:info.height,data:new Uint8ClampedArray(bytes)}}});assert.equal(result.type,'result',result.error);console.log('LEGACY RESULT',cid,JSON.stringify({kind:result.result.kind,unavailable:result.result.unavailable,candidates:result.result.candidates?.map(c=>({id:c.id,name:c.name,inliers:c.inliers,ratio:c.ratio,coverage:c.coverage,distance:c.distance,evidence:c.evidence}))}));assert(result.result.candidates.some(c=>c.id===cid),'Legacy edition must remain visible');assert(!(result.result.kind==='strong'&&result.result.candidates[0]?.id!==cid),'Do not certify another printing');assert.notEqual(result.result.kind,'reject');report.legacyControls.push({id:cid,top:result.result.candidates[0]?.id,kind:result.result.kind});console.log('legacy',cid);
 }
 for(const value of [0,50,128,255]){
  const bytes=Buffer.alloc(640*480*4);for(let i=0;i<bytes.length;i+=4){bytes[i]=bytes[i+1]=bytes[i+2]=value;bytes[i+3]=255;}
  await ctx.self.onmessage({data:{id:3,type:'analyse',alreadyCropped:true,image:{width:640,height:480,data:new Uint8ClampedArray(bytes)}}});assert.equal(result.result.kind,'reject');report.negatives.push({uniform:value,rejected:true});
 }
 // Stable mode and FR/EN must continue to use the original dataset paths.
 for(const [query,language,expected] of [['','ja',old.cards.length],['?jp=20261010','fr',JSON.parse(fs.readFileSync(data+'/vectors-fr.json')).cards.length+JSON.parse(fs.readFileSync(data+'/fr-cel25-extra.json')).length],['?jp=20261010','en',JSON.parse(fs.readFileSync(data+'/vectors-en.json')).cards.length]]){
  const calls=[];const other={...ctx,self:{cv},location:{search:query},postMessage:r=>result=r,fetch:async url=>{calls.push(url);return new Response(fs.readFileSync(root+'/scanner/'+url.split('?')[0]));}};
  vm.createContext(other);vm.runInContext(fs.readFileSync(root+'/scanner/worker.js','utf8'),other);await other.self.onmessage({data:{id:4,type:'init',lang:language}});assert.equal(result.type,'result',result.error);
  // Seeded FR/EN packs may add entries; initial coverage must at least preserve vector count.
  assert(result.result.count>=expected);assert(!calls.some(u=>u.includes('japanese-test/')));report[language+'LegacyCoverage']=result.result.count;
 }
 report.summary={trials:report.trials.length,correct:report.trials.filter(t=>t.top===t.id).length,falseStrong:report.trials.filter(t=>t.kind==='strong'&&t.top!==t.id).length};
 fs.writeFileSync(root+'/tests/japanese-integration-results.json',JSON.stringify(report,null,2)+'\n');console.log('PASS',JSON.stringify(report.summary));
})().catch(e=>{console.error(e);process.exitCode=1;});
