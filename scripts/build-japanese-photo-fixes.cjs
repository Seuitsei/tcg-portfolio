// Append verified official GO cards and prepare existing foil references.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),zlib=require('zlib');
const sharp=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/sharp'),cv=require('../scanner/vendor/opencv.js'),V=require('../scanner/vision.js');
const root=path.resolve(__dirname,'..'),data=root+'/scanner/data',target=data+'/japanese-test';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function pack(rows){const chunks=[Buffer.from('TCGR'),Buffer.from([1,0]),Buffer.alloc(2)];chunks[2].writeUInt16LE(rows.length);for(const [id,f] of rows){const name=Buffer.from(id),header=Buffer.alloc(3),pts=Buffer.alloc(f.points.length*4);header.writeUInt8(name.length);header.writeUInt16LE(f.points.length,1);f.points.forEach((p,i)=>{pts.writeUInt16LE(Math.round(p.x*16),i*4);pts.writeUInt16LE(Math.round(p.y*16),i*4+2)});chunks.push(header,name,pts,Buffer.from(f.bytes));}return Buffer.concat(chunks);}
(async()=>{
 await new Promise(r=>cv.Mat?r():cv.then(()=>r()));sharp.concurrency(1);
 const cache=process.argv[2],legacy=process.argv[3],legacyCache=process.argv[4];if(!legacyCache)throw Error('Usage: build-japanese-photo-fixes.cjs GO-cache legacy-metadata legacy-cache');
 const fresh=JSON.parse(fs.readFileSync(cache+'/verified.json'));
 const old=JSON.parse(fs.readFileSync(legacy)).map(c=>{const url=c.image+'/low.webp',file=hash(Buffer.from(url)),b=fs.readFileSync(legacyCache+'/'+file);return {...c,lang:'ja',setId:'S12a',reference:{url,file,sha256:hash(b),source:'existing TCGdex catalogue reference'}};});
 const meta=JSON.parse(fs.readFileSync(target+'/vectors-ja.json')),catalog=JSON.parse(fs.readFileSync(target+'/catalog-ja.json')),manifest=JSON.parse(fs.readFileSync(target+'/recovered-references.json')),vectors=[fs.readFileSync(target+'/vectors-ja.bin')],sources=[];
 const groups=[['S10b',fresh,cache],['S12a-detail',old,legacyCache]];
 for(const [sid,cards,sourceCache] of groups)for(let i=0;i<cards.length;i+=64){const batch=cards.slice(i,i+64),key='ja-'+sid+'-photo-'+(i/64+1),n=[],f=[];
  for(const c of batch){const b=fs.readFileSync(sourceCache+'/'+c.reference.file);if(hash(b)!==c.reference.sha256)throw Error('Source mismatch '+c.id);const decoded=await sharp(b).ensureAlpha().raw().toBuffer({resolveWithObject:true}),mat=cv.matFromArray(decoded.info.height,decoded.info.width,cv.CV_8UC4,decoded.data);
   try{n.push([c.id,V.features(cv,mat)]);f.push([c.id,V.features(cv,mat,false,true)]);const entry={id:c.id,localId:c.localId,name:c.name,image:c.reference.url,referencePack:key},existing=meta.cards.find(x=>x.id===c.id);if(existing)Object.assign(existing,entry);else{meta.cards.push(entry);vectors.push(Buffer.from(V.descriptor(cv,mat)));}const text=catalog.find(x=>x.id===c.id);if(text)Object.assign(text,{image:entry.image});else catalog.push({id:c.id,localId:c.localId,name:c.name,image:entry.image});sources.push({id:c.id,...c.reference});}finally{mat.delete();}
  }
  const record={key,lang:'ja',setId:sid==='S12a-detail'?'S12a':sid,count:batch.length,sourcesHash:hash(Buffer.from(JSON.stringify(batch.map(c=>[c.id,c.reference.sha256]))))};
  for(const [mode,rows] of [['normal',n],['foil',f]]){const raw=pack(rows),blob=zlib.gzipSync(raw),file='japanese-test/recovered/'+key+'-'+mode+'.bin.gz';fs.writeFileSync(data+'/'+file,blob);record[mode]={file,bytes:blob.length,rawBytes:raw.length,sha256:hash(blob)};}
  manifest.packs=manifest.packs.filter(p=>p.key!==key);manifest.packs.push(record);console.log('BUILT',key,batch.length);
 }
 meta.built='2026-10-10-photo-fixes';fs.writeFileSync(target+'/vectors-ja.json',JSON.stringify(meta)+'\n');fs.writeFileSync(target+'/vectors-ja.bin',Buffer.concat(vectors));fs.writeFileSync(target+'/catalog-ja.json',JSON.stringify(catalog)+'\n');fs.writeFileSync(target+'/recovered-references.json',JSON.stringify(manifest)+'\n');
 const sets=JSON.parse(fs.readFileSync(data+'/sets-ja.json'));sets.find(s=>s.id==='S10b').cardCount={official:71,total:fresh.length};fs.writeFileSync(target+'/sets-ja.json',JSON.stringify(sets)+'\n');
 fs.writeFileSync(root+'/docs/japanese-photo-reference-sources.json',JSON.stringify({created:'2026-10-10',unnumberedEnergiesExcluded:8,sources},null,2)+'\n');console.log('TOTAL',meta.cards.length,catalog.length);
})().catch(e=>{console.error(e);process.exitCode=1});
