/* Reference-image distortion tests, NOT physical-phone accuracy. */
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const sharp=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/sharp');
const V=require('../scanner/vision.js');const cv=require('../scanner/vendor/opencv.js');
const root=path.resolve(__dirname,'..');
const loadCV=()=>new Promise(r=>{if(cv.Mat)r();else cv.onRuntimeInitialized=()=>r();});
async function mat(file){const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});return cv.matFromArray(info.height,info.width,cv.CV_8UC4,data);}
function unpack(c){let raw=Buffer.from(c.points,'base64');return {bytes:Buffer.from(c.orb,'base64'),points:Array.from({length:raw.length/4},(_,i)=>({x:raw.readUInt16LE(i*4)/16,y:raw.readUInt16LE(i*4+2)/16}))};}
async function main(){
 await loadCV();const manifest=JSON.parse(fs.readFileSync(path.join(root,'scanner/data/manifest.json')));const seeded=manifest.packs.filter(p=>p.lang==='fr').flatMap(p=>JSON.parse(fs.readFileSync(path.join(root,'scanner/data',p.file))));
 const global=JSON.parse(fs.readFileSync(path.join(root,'scanner/data/vectors-fr.json'))),vectors=new Int8Array(fs.readFileSync(path.join(root,'scanner/data/vectors-fr.bin')));const merged=new Map(global.cards.map((c,i)=>[c.id,{...c,v:vectors.subarray(i*216,(i+1)*216)}]));for(const c of seeded)merged.set(c.id,c);const entries=Array.from(merged.values());
 const featureCache=new Map();async function getRef(c){if(c.orb)return unpack(c);if(featureCache.has(c.id))return featureCache.get(c.id);let image=await mat(path.join(root,'../analysis/images/fr-'+c.id+'.webp'));let f=V.features(cv,image);image.delete();featureCache.set(c.id,f);return f;}
 const wanted=['swsh4.5-21','swsh4-102','base1-4','xy12-11','cel25cc-CC002'];let sample=[...wanted,...entries.filter((_,i)=>i%431===0).map(c=>c.id)];sample=[...new Set(sample)].filter(id=>entries.some(e=>e.id===id));
 const report={referenceCount:entries.length,kind:'synthetic-reference-distortions',trials:[],negatives:[]};
 for(const id of sample){
  const file=path.join(root,'../analysis/images/fr-'+id+'.webp');if(!fs.existsSync(file))continue;
  const original=await mat(file),reference=entries.find(e=>e.id===id),base=new cv.Mat();cv.resize(original,base,new cv.Size(252,352),0,0,cv.INTER_AREA);
  const desc=V.descriptor(cv,original);assert(V.vectorDistance(desc,reference.v)<.035,'Python/JS descriptor parity '+id);
  for(const mode of ['clean','camera','glare']){
   let photo=base.clone();
   if(mode!=='clean'){
    cv.GaussianBlur(photo,photo,new cv.Size(3,3),.7);
    for(let i=0;i<photo.data.length;i+=4){photo.data[i]=Math.min(255,photo.data[i]*.85+18);photo.data[i+1]=Math.min(255,photo.data[i+1]*.92+9);photo.data[i+2]=Math.min(255,photo.data[i+2]*.8+3);}
   }
   if(mode==='glare')cv.circle(photo,new cv.Point(160,140),32,new cv.Scalar(255,255,255,255),-1);
   const corners=[{x:170,y:54},{x:405,y:72},{x:420,y:415},{x:154,y:426}];
   const src=cv.matFromArray(4,1,cv.CV_32FC2,[0,0,251,0,251,351,0,351]),dst=cv.matFromArray(4,1,cv.CV_32FC2,corners.flatMap(p=>[p.x,p.y])),H=cv.getPerspectiveTransform(src,dst),scene=new cv.Mat();cv.warpPerspective(photo,scene,H,new cv.Size(640,480),cv.INTER_LINEAR,cv.BORDER_CONSTANT,new cv.Scalar(45,55,48,255));
   const t=performance.now(),detection=V.detect(cv,scene);let query=null,result={id,mode,detected:!!detection};
   if(detection){query=V.warp(cv,scene,detection.points);const vec=V.descriptor(cv,query),short=V.rankVectors([vec],entries,16),f=V.features(cv,query);const ranked=(await Promise.all(short.map(async s=>{const c=entries[s.index],v=V.verify(cv,f,await getRef(c));return {id:c.id,distance:s.distance,...v,evidence:v.inliers*Math.min(1,v.coverage/.2)*v.ratio/(1+s.distance)}}))).sort((a,b)=>b.evidence-a.evidence);Object.assign(result,{top1:ranked[0]?.id,top3:ranked.slice(0,3).map(c=>c.id),decision:V.decision(ranked,entries.some(c=>c.id!==ranked[0]?.id&&c.name===entries.find(e=>e.id===ranked[0]?.id)?.name&&V.normaliseNumber(c.localId)===V.normaliseNumber(entries.find(e=>e.id===ranked[0]?.id)?.localId))),best:ranked[0],quality:V.quality(cv,query).sharpness});}
   result.ms=Math.round(performance.now()-t);report.trials.push(result);V.dispose(photo,src,dst,H,scene,query);
  }
  V.dispose(original,base);console.log('tested',id);
 }
 for(const value of [0,50,128,255]){let src=new cv.Mat(480,640,cv.CV_8UC4,new cv.Scalar(value,value,value,255));assert.equal(V.detect(cv,src),null);report.negatives.push({uniform:value,rejected:true});src.delete();}
 assert.equal(V.normaliseNumber('021/072'),'21/72');assert.equal(V.normaliseNumber('004/102'),'4/102');assert.equal(V.normaliseNumber('OP05-119'),'OP05-119');
 const gate=new V.StabilityGate();const d={fraction:.4,points:[{x:10,y:10},{x:80,y:10},{x:80,y:100},{x:10,y:100}]},q={brightness:120,sharpness:400,glare:0,sample:[10,20]};assert.equal(gate.update(d,q,100,120,1).ready,false);for(let i=1;i<4;i++)assert.equal(gate.update(d,q,100,120,1+i*200).ready,false);assert.equal(gate.update(d,q,100,120,1001).ready,true);assert.equal(gate.update(null,null,100,120,1201).ready,false);
 const groups={};for(const mode of ['clean','camera','glare']){let a=report.trials.filter(x=>x.mode===mode);groups[mode]={n:a.length,detected:a.filter(x=>x.detected).length,top1:a.filter(x=>x.top1===x.id).length,top3:a.filter(x=>x.top3?.includes(x.id)).length,strong:a.filter(x=>x.decision==='strong').length,falseStrong:a.filter(x=>x.decision==='strong'&&x.top1!==x.id).length,medianMs:a.map(x=>x.ms).sort((a,b)=>a-b)[Math.floor(a.length/2)]};}
 report.summary=groups;fs.writeFileSync(path.join(root,'tests/benchmark-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(groups,null,2));console.log('targets',report.trials.filter(x=>wanted.includes(x.id)).map(x=>({id:x.id,mode:x.mode,top1:x.top1,decision:x.decision,inliers:x.best?.inliers,distance:x.best?.distance})));assert(report.trials.length>60);assert.equal(report.trials.filter(x=>x.decision==='strong'&&x.top1!==x.id).length,0,'False confident identification');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
