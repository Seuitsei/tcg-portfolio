// Uses external user photos locally; these photos are not committed.
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm'),sharp=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/sharp'),cv=require('../scanner/vendor/opencv.js'),V=require('../scanner/vision.js'),D=require('../scanner/detail-index.js'),P=require('../scanner/reference-packs.js'),zlib=require('node:zlib');
(async()=>{await new Promise(r=>cv.Mat?r():cv.onRuntimeInitialized=r);const root=path.resolve(__dirname,'..'),images=process.env.TCG_TEST_IMAGES,global=JSON.parse(fs.readFileSync(root+'/scanner/data/vectors-fr.json')),vec=new Int8Array(fs.readFileSync(root+'/scanner/data/vectors-fr.bin'));let result,tested=0;
const dm=JSON.parse(fs.readFileSync(root+'/scanner/data/detail-index.json')).packs.find(p=>p.lang==='fr'),db=zlib.gunzipSync(Buffer.concat(dm.files.map(p=>fs.readFileSync(root+'/scanner/data/'+p.file)))),detail=D.decode(db.buffer.slice(db.byteOffset,db.byteOffset+db.byteLength),dm.ids);const ctx={ScannerDetailIndex:D,ScannerReferencePacks:P,ScannerVision:V,self:{cv},importScripts(){},postMessage:r=>result=r,setTimeout,clearTimeout,performance,atob:s=>Buffer.from(s,'base64').toString('binary')};vm.createContext(ctx);vm.runInContext(fs.readFileSync(root+'/scanner/worker.js','utf8'),ctx);
const entries=global.cards.map((c,i)=>({...c,lang:'fr',setId:c.id.slice(0,c.id.lastIndexOf('-')),v:Array.from(vec.subarray(i*216,(i+1)*216))}));
entries.push(...JSON.parse(fs.readFileSync(root+'/scanner/data/fr-cel25-extra.json')));
vm.runInContext('entries='+JSON.stringify(entries)+';allCards='+JSON.stringify(JSON.parse(fs.readFileSync(root+'/scanner/data/catalog.json')).fr)+';sets='+fs.readFileSync(root+'/scanner/data/sets.json')+'.fr',ctx);
ctx.detail=detail;vm.runInContext('loadDetailIndex=async()=>detail;',ctx);const packManifest=JSON.parse(fs.readFileSync(root+'/scanner/data/recovered-references.json'));const packed=new Map();const cache=new Map();ctx.ref=async (c,enhance=false)=>{if(cache.has(c.id+enhance))return cache.get(c.id+enhance);if(c.referencePack){const spec=packManifest.packs.find(p=>p.key===c.referencePack)[enhance?'foil':'normal'];if(!packed.has(spec.file)){const b=zlib.gunzipSync(fs.readFileSync(root+'/scanner/data/'+spec.file));packed.set(spec.file,P.decodeReferencePack(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)));}return packed.get(spec.file)[c.id];}if(c.id==='cel25-25'){const f=enhance?{...c.foil,bytes:Uint8Array.from(c.foil.bytes)}:(()=>{const raw=Buffer.from(c.points,'base64'),points=[];for(let i=0;i<raw.length;i+=4)points.push({x:raw.readUInt16LE(i)/16,y:raw.readUInt16LE(i+2)/16});return {points,bytes:Uint8Array.from(Buffer.from(c.orb,'base64'))};})();cache.set(c.id+enhance,f);return f;}const f=images+'/fr-'+c.id+'.webp';const {data,info}=await sharp(f).ensureAlpha().raw().toBuffer({resolveWithObject:true});const src=cv.matFromArray(info.height,info.width,cv.CV_8UC4,data),feats=V.features(cv,src,false,enhance);src.delete();cache.set(c.id+enhance,feats);return feats;};vm.runInContext('referenceFeatures=ref;',ctx);
for(const [file,id] of [['13.16.28 (1).jpeg','swsh7-192'],['13.16.28.jpeg','swsh7-218'],['13.16.29 (2).jpeg','swsh7-117'],['13.16.29.jpeg','swsh7-111'],['14.20.17.jpeg','cel25-25'],['14.20.17 (1).jpeg','swsh7-65'],['14.20.17 (2).jpeg','swsh7-191'],['16.24.51.jpeg','swsh9-029'],['16.24.51 (1).jpeg','swsh9-016'],['16.24.51 (2).jpeg','swsh9-022'],['16.24.51 (3).jpeg','swsh9-123'],['16.24.52.jpeg','swsh9-185'],['16.24.52 (1).jpeg','swsh9tg-TG02'],['16.24.52 (2).jpeg','swsh9tg-TG05'],['16.24.52 (3).jpeg','swsh9tg-TG07'],['16.24.53.jpeg','swsh9tg-TG14']]){
if(process.env.TCG_TEST_ONLY&&!process.env.TCG_TEST_ONLY.split(',').includes(id))continue;
const {data,info}=await sharp(path.join(process.env.TCG_TEST_PHOTOS,'WhatsApp Image 2026-10-09 at '+file),{failOn:'none'}).resize({width:1200,withoutEnlargement:true}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const image={width:info.width,height:info.height,data:new Uint8ClampedArray(data)};const start=performance.now();
await ctx.self.onmessage({data:{id:1,type:'analyse',image,manual:true}});
assert.equal(result.type,'result');assert.equal(result.result.candidates[0]?.id,id);assert.notEqual(result.result.kind,'reject',id+' visible candidate');tested++;console.log(id,JSON.stringify({type:result.type,reason:result.error||result.result.reason,kind:result.result?.kind,candidates:result.result?.candidates?.map(c=>({id:c.id,inliers:c.inliers,ratio:c.ratio,coverage:c.coverage,referenceCoverage:c.referenceCoverage,distance:c.distance})),ms:Math.round(performance.now()-start)}));
if(process.env.TCG_MANUAL_ONLY)continue;
await ctx.self.onmessage({data:{id:2,type:'reset'}});
const small=await sharp(data,{raw:{width:info.width,height:info.height,channels:4}}).resize({width:480}).raw().toBuffer({resolveWithObject:true});
let auto;for(let i=0;i<14;i++){await ctx.self.onmessage({data:{id:3,type:'frame',image:{width:small.info.width,height:small.info.height,data:new Uint8ClampedArray(small.data)},now:performance.now()}});auto=result.result;if(auto.ready)break;await new Promise(r=>setTimeout(r,150));}
assert(auto.ready,id+' automatic stability');assert(['contours','details'].includes(auto.method));
await ctx.self.onmessage({data:{id:4,type:'analyse',image,points:auto.points}});
assert.equal(result.result.candidates[0]?.id,id,id+' automatic identity');
console.log('AUTO',id,result.result.kind);console.log('AUTO',id,JSON.stringify({ready:auto.ready,method:auto.method,hint:auto.hint,quality:auto.quality}));

}
// No card: a piece of the textured fabric and plain white must not be confidently identified.
for(const negative of ['fabric','white']){
let bytes,width,height;
if(negative==='fabric'){const r=await sharp(path.join(process.env.TCG_TEST_PHOTOS,'WhatsApp Image 2026-10-09 at 13.16.28.jpeg')).extract({left:0,top:0,width:160,height:180}).resize(640,480).ensureAlpha().raw().toBuffer({resolveWithObject:true});bytes=r.data;width=r.info.width;height=r.info.height;}
else{width=640;height=480;bytes=Buffer.alloc(width*height*4,255);}
await ctx.self.onmessage({data:{id:5,type:'analyse',manual:true,image:{width,height,data:new Uint8ClampedArray(bytes)}}});
assert.equal(result.type,'result');assert.equal(result.result.kind,'reject',negative+' not a card');console.log('PASS negative',negative);
}
console.log('PASS real protected photos: '+tested+' correct manual identities'+(process.env.TCG_MANUAL_ONLY?'':', with automatic recognition')+' and two no-card rejections.');

})().catch(e=>{console.error(e.message);process.exit(1)});
