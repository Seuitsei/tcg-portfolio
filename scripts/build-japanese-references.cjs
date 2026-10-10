// Build references from audited source bytes with the same OpenCV pipeline as the app.
// Source photos are not part of the build. Feature packs are loaded per series on demand.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),zlib=require('zlib');
const sharp=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/sharp');
const cv=require('../scanner/vendor/opencv.js'),V=require('../scanner/vision.js');
const root=path.resolve(__dirname,'..'),cache=process.argv[2],shard=Number(process.argv[3]||0),shards=Number(process.argv[4]||1);sharp.concurrency(1);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function packFeatures(rows){
 const chunks=[Buffer.from('TCGR'),Buffer.from([1,0]),Buffer.alloc(2)];chunks[2].writeUInt16LE(rows.length);
 for(const [id,f] of rows){const name=Buffer.from(id),header=Buffer.alloc(3);header.writeUInt8(name.length);header.writeUInt16LE(f.points.length,1);const points=Buffer.alloc(f.points.length*4);f.points.forEach((p,i)=>{points.writeUInt16LE(Math.round(p.x*16),i*4);points.writeUInt16LE(Math.round(p.y*16),i*4+2);});chunks.push(header,name,points,Buffer.from(f.bytes));}
 return Buffer.concat(chunks);
}
(async()=>{
 if(!cache)throw Error('Usage: node scripts/build-recovered-references.cjs /path/to/audit-cache');
 await new Promise(r=>cv.Mat?r():cv.then(()=>r()));
 const audit=JSON.parse(zlib.gunzipSync(fs.readFileSync(root+'/docs/japanese-reference-research.json.gz')));audit.cards=audit.cards.filter(c=>c.status==='verified');
 const catalog={ja:JSON.parse(fs.readFileSync(root+'/scanner/data/catalog-ja.json'))};
 const target=root+'/scanner/data/japanese-test';fs.mkdirSync(target,{recursive:true});const existingFile=target+'/recovered-references.json',existing=fs.existsSync(existingFile)?JSON.parse(fs.readFileSync(existingFile)).packs:[];
 const packs=JSON.parse(fs.readFileSync(root+'/scanner/data/recovered-references.json')).packs.filter(p=>p.lang!=='ja'),dir=target+'/recovered';fs.mkdirSync(dir,{recursive:true});
 for(const lang of ['ja']){
  const metaFile=fs.existsSync(target+'/vectors-ja.json')?target+'/vectors-ja.json':root+'/scanner/data/vectors-ja.json';const metadata=JSON.parse(fs.readFileSync(metaFile));
  const old=new Int8Array(fs.readFileSync(metaFile.replace('.json','.bin'))),vectors=[Buffer.from(old)];
  const seen=new Set(metadata.cards.map(c=>c.id)),groups=new Map();
  for(const card of audit.cards.filter(c=>c.lang===lang)){if(!groups.has(card.setId))groups.set(card.setId,[]);groups.get(card.setId).push(card);}
  let done=0;
  const chunks=[];for(const [sid,all] of groups)for(let i=0;i<all.length;i+=64)chunks.push([sid,all.slice(i,i+64),Math.floor(i/64)+1]);for(const [sid,cards,part] of chunks.filter((_,i)=>i%shards===shard)){
   const normal=[],foil=[],key=lang+'-'+sid+'-'+part;
   const oldPack=existing.find(p=>p.key===key),sourcesHash=hash(Buffer.from(JSON.stringify(cards.map(c=>[c.id,c.reference.sha256]))));
   if(oldPack?.sourcesHash===sourcesHash&&['normal','foil'].every(mode=>fs.existsSync(root+'/scanner/data/'+oldPack[mode].file))){packs.push(oldPack);done+=cards.length;continue;}
   for(const card of cards){
    const source=card.reference.file;if(!source)throw Error('Source missing: '+card.id);
    const bytes=fs.readFileSync(path.join(cache,source));if(hash(bytes)!==card.reference.sha256)throw Error('Source hash mismatch: '+card.id);
    const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const mat=cv.matFromArray(info.height,info.width,cv.CV_8UC4,data);
    try{
     const n=V.features(cv,mat),f=V.features(cv,mat,false,true);normal.push([card.id,n]);foil.push([card.id,f]);
     const entry={id:card.id,localId:card.localId,name:card.name,image:card.reference.url,referencePack:key};
     if(!seen.has(card.id)){metadata.cards.push(entry);vectors.push(Buffer.from(V.descriptor(cv,mat)));seen.add(card.id);}
     else Object.assign(metadata.cards.find(c=>c.id===card.id),entry);
     const text=catalog[lang].find(c=>c.id===card.id);if(text)Object.assign(text,{image:card.reference.url});
    }finally{mat.delete();}
    done++;if(done%100===0)console.log('BUILD',lang,done);
   }
   const record={key,lang,setId:sid,count:cards.length,sourcesHash};
   for(const [mode,rows] of [['normal',normal],['foil',foil]]){const raw=packFeatures(rows),blob=zlib.gzipSync(raw),file='japanese-test/recovered/'+key+'-'+mode+'.bin.gz';fs.writeFileSync(root+'/scanner/data/'+file,blob);record[mode]={file,bytes:blob.length,rawBytes:raw.length,sha256:hash(blob)};}
   packs.push(record);
  }
  fs.writeFileSync(target+'/vectors-'+lang+'-shard'+shard+'.json',JSON.stringify({...metadata,built:'2026-10-10',failed:metadata.failed.filter(id=>!seen.has(id))})+'\n');
  fs.writeFileSync(target+'/vectors-'+lang+'-shard'+shard+'.bin',Buffer.concat(vectors));
  console.log('DONE',lang,done,'indexed',metadata.cards.length);
 }
 fs.writeFileSync(target+'/catalog-ja-shard'+shard+'.json',JSON.stringify(catalog.ja)+'\n');
 fs.writeFileSync(target+'/recovered-references-shard'+shard+'.json',JSON.stringify({version:1,created:'2026-10-10',packs})+'\n');
 console.log('PACKS',packs.length,'bytes',packs.reduce((n,p)=>n+p.normal.bytes+p.foil.bytes,0));
})().catch(e=>{console.error(e);process.exit(1)});
