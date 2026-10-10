// Real user photos are supplied locally through TCG_JP_PHOTOS; never committed.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict'),crypto=require('crypto'),{execFile}=require('child_process'),{promisify}=require('util');
const sharp=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/sharp'),cv=require('../scanner/vendor/opencv.js'),V=require('../scanner/vision.js'),D=require('../scanner/detail-index.js'),P=require('../scanner/reference-packs.js');
const root=path.resolve(__dirname,'..'),cache=process.env.TCG_REFERENCE_CACHE||'/tmp/tcg-reference-cache';fs.mkdirSync(cache,{recursive:true});
const cases=[['WhatsApp Image 2026-10-10 at 18.48.41 (1).jpeg','S8b-252'],['WhatsApp Image 2026-10-10 at 18.48.41 (2).jpeg','S10b-011'],['WhatsApp Image 2026-10-10 at 18.48.41 (3).jpeg','S10b-049'],['WhatsApp Image 2026-10-10 at 18.48.41.jpeg','S12a-262']];
(async()=>{
 await new Promise(r=>cv.Mat?r():cv.then(()=>r()));let result;
 const inflight=new Map(),fetches=[];
 async function fetchSource(url){
  if(!/^https?:/.test(url))return new Response(fs.readFileSync(root+'/scanner/'+url.split('?')[0]));
  const file=path.join(cache,crypto.createHash('sha256').update(url).digest('hex'));
  if(!fs.existsSync(file)){
   if(!inflight.has(file))inflight.set(file,promisify(execFile)('curl',['-fLsS','--max-time','15','-o',file+'.part',url]).then(()=>fs.renameSync(file+'.part',file)).finally(()=>inflight.delete(file)));
   await inflight.get(file);
  }
  return new Response(fs.readFileSync(file));
 }
 const createImageBitmap=async blob=>{const {data,info}=await sharp(Buffer.from(await blob.arrayBuffer())).ensureAlpha().raw().toBuffer({resolveWithObject:true});return {data,width:info.width,height:info.height,close(){}};};
 class OffscreenCanvas{constructor(width,height){this.width=width;this.height=height;}getContext(){const canvas=this;return {drawImage(bitmap){canvas.bitmap=bitmap;},getImageData(){return {width:canvas.width,height:canvas.height,data:new Uint8ClampedArray(canvas.bitmap.data)};}};}}
 const ctx={createImageBitmap,OffscreenCanvas,ScannerVision:V,ScannerDetailIndex:D,ScannerReferencePacks:P,self:{cv},location:{search:'?jp=20261010'},URLSearchParams,importScripts(){},postMessage:r=>{if(r.id)result=r;},setTimeout,clearTimeout,performance,AbortController,Response,Blob,DecompressionStream,atob:s=>Buffer.from(s,'base64').toString('binary'),fetch:async url=>{fetches.push(url);return fetchSource(url);}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(root+'/scanner/worker.js','utf8'),ctx);
 await ctx.self.onmessage({data:{id:1,type:'init',lang:'ja'}});assert.equal(result.type,'result',result.error);console.log('INIT',result.result.count);
 const report=[];
 for(const [file,expected] of cases){
  if(process.env.TCG_TEST_ONLY&&!process.env.TCG_TEST_ONLY.split(',').includes(expected))continue;
  await ctx.self.onmessage({data:{id:2,type:'reset'}});
  const {data,info}=await sharp(path.join(process.env.TCG_JP_PHOTOS,file)).resize({width:1200,withoutEnlargement:true}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  if(process.env.TCG_DEBUG){
   ctx.debugImage={width:info.width,height:info.height,data:new Uint8ClampedArray(data)};ctx.debugExpected=expected;
   const points=expected==='S10b-011'?[[200,283],[954,288],[981,1387],[158,1391]]:expected==='S12a-262'?[[80,505],[675,496],[716,1351],[101,1369]]:null;
   ctx.debugPoints=points?.map(([x,y])=>({x,y}));
   const debug=await vm.runInContext('(async()=>{const src=engine.matFromImageData(debugImage),entry=entries.find(e=>e.id===debugExpected);if(!entry){src.delete();return {missing:true};}const scene=V.features(engine,src,true,true),index=await loadDetailIndex(),normal=await referenceFeatures(entry),foil=await referenceFeatures(entry,true);const rank=ScannerDetailIndex.rank(index,[scene],100);let cropInfo=null;if(debugPoints){const crop=V.warp(engine,src,debugPoints,2),q=V.features(engine,crop,false,true),v=V.descriptor(engine,crop);cropInfo={verify:V.verify(engine,q,foil),vectorRank:V.rankVectors([v],entries,entries.length).findIndex(r=>entries[r.index].id===entry.id)};crop.delete();}const r={detailRank:rank.findIndex(r=>r.id===entry.id),detailTop:rank.slice(0,8),sceneNormal:V.verify(engine,scene,normal),sceneFoil:V.verify(engine,scene,foil),contour:V.detect(engine,src),cropInfo};src.delete();return r;})()',ctx);console.log('DEBUG',expected,JSON.stringify(debug));
  }
  const t=performance.now();await ctx.self.onmessage({data:{id:3,type:'analyse',manual:true,image:{width:info.width,height:info.height,data:new Uint8ClampedArray(data)}}});assert.equal(result.type,'result',result.error);
  const r=result.result,row={expected,top:r.candidates?.[0]?.id,kind:r.kind,reason:r.reason,quality:r.quality,unavailable:r.unavailable,ms:Math.round(performance.now()-t),candidates:r.candidates?.map(c=>({id:c.id,inliers:c.inliers,coverage:c.coverage,ratio:c.ratio,distance:c.distance}))};report.push(row);console.log(JSON.stringify(row));
  if(process.env.TCG_REQUIRE_PASS){assert.equal(row.top,expected);assert.notEqual(row.kind,'reject');}
 }
 if(process.env.TCG_REQUIRE_PASS){
  const image={width:640,height:480,data:new Uint8ClampedArray(640*480*4).fill(255)};await ctx.self.onmessage({data:{id:4,type:'analyse',manual:true,image}});assert.equal(result.result.kind,'reject');console.log('PASS white no-card rejection');
  const fabric=await sharp(path.join(process.env.TCG_JP_PHOTOS,cases[2][0])).extract({left:0,top:300,width:120,height:220}).resize(640,480).ensureAlpha().raw().toBuffer({resolveWithObject:true});await ctx.self.onmessage({data:{id:5,type:'analyse',manual:true,image:{width:640,height:480,data:new Uint8ClampedArray(fabric.data)}}});assert.equal(result.result.kind,'reject');console.log('PASS binder-fabric no-card rejection');
 }
 if(process.env.TCG_REPORT)fs.writeFileSync(process.env.TCG_REPORT,JSON.stringify({report,externalFetches:[...new Set(fetches.filter(x=>/^https?:/.test(x)))]},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
