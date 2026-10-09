// Build references from audited source bytes with the same OpenCV pipeline as the app.
// Source photos are not part of the build. Feature packs are loaded per series on demand.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),zlib=require('zlib');
const sharp=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/sharp');
const cv=require('../scanner/vendor/opencv.js'),V=require('../scanner/vision.js');
const root=path.resolve(__dirname,'..'),cache=process.argv[2];
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function packFeatures(rows){
 const chunks=[Buffer.from('TCGR'),Buffer.from([1,0]),Buffer.alloc(2)];chunks[2].writeUInt16LE(rows.length);
 for(const [id,f] of rows){const name=Buffer.from(id),header=Buffer.alloc(3);header.writeUInt8(name.length);header.writeUInt16LE(f.points.length,1);const points=Buffer.alloc(f.points.length*4);f.points.forEach((p,i)=>{points.writeUInt16LE(Math.round(p.x*16),i*4);points.writeUInt16LE(Math.round(p.y*16),i*4+2);});chunks.push(header,name,points,Buffer.from(f.bytes));}
 return Buffer.concat(chunks);
}
(async()=>{
 if(!cache)throw Error('Usage: node scripts/build-recovered-references.cjs /path/to/audit-cache');
 await new Promise(r=>cv.Mat?r():cv.onRuntimeInitialized=r);
 const audit=JSON.parse(fs.readFileSync(root+'/docs/reference-image-audit.json'));
 const catalog=JSON.parse(fs.readFileSync(root+'/scanner/data/catalog.json'));
 const existingFile=root+'/scanner/data/recovered-references.json',existing=fs.existsSync(existingFile)?JSON.parse(fs.readFileSync(existingFile)).packs:[];
 const packs=[],dir=root+'/scanner/data/recovered';fs.mkdirSync(dir,{recursive:true});
 for(const lang of ['fr','en']){
  const metadata=JSON.parse(fs.readFileSync(root+'/scanner/data/vectors-'+lang+'.json'));
  const old=new Int8Array(fs.readFileSync(root+'/scanner/data/vectors-'+lang+'.bin')),vectors=[Buffer.from(old)];
  const seen=new Set(metadata.cards.map(c=>c.id)),groups=new Map();
  for(const card of audit.cards.filter(c=>c.lang===lang)){if(!groups.has(card.setId))groups.set(card.setId,[]);groups.get(card.setId).push(card);}
  let done=0;
  for(const [sid,cards] of groups){
   const normal=[],foil=[],key=lang+'-'+sid;
   const oldPack=existing.find(p=>p.key===key),sourcesHash=hash(Buffer.from(JSON.stringify(cards.map(c=>[c.id,c.reference.sha256]))));
   if(oldPack?.sourcesHash===sourcesHash&&['normal','foil'].every(mode=>fs.existsSync(root+'/scanner/data/'+oldPack[mode].file))){packs.push(oldPack);done+=cards.length;continue;}
   for(const card of cards){
    const source=fs.readdirSync(cache).find(f=>f.startsWith(card.reference.sha256+'.'));if(!source)throw Error('Source missing: '+card.id);
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
   for(const [mode,rows] of [['normal',normal],['foil',foil]]){const raw=packFeatures(rows),blob=zlib.gzipSync(raw),file='recovered/'+key+'-'+mode+'.bin.gz';fs.writeFileSync(root+'/scanner/data/'+file,blob);record[mode]={file,bytes:blob.length,rawBytes:raw.length,sha256:hash(blob)};}
   packs.push(record);
  }
  fs.writeFileSync(root+'/scanner/data/vectors-'+lang+'.json',JSON.stringify({...metadata,built:'2026-10-09',failed:metadata.failed.filter(id=>!seen.has(id))})+'\n');
  fs.writeFileSync(root+'/scanner/data/vectors-'+lang+'.bin',Buffer.concat(vectors));
  console.log('DONE',lang,done,'indexed',metadata.cards.length);
 }
 fs.writeFileSync(root+'/scanner/data/catalog.json',JSON.stringify(catalog)+'\n');
 fs.writeFileSync(root+'/scanner/data/recovered-references.json',JSON.stringify({version:1,created:'2026-10-09',packs})+'\n');
 console.log('PACKS',packs.length,'bytes',packs.reduce((n,p)=>n+p.normal.bytes+p.foil.bytes,0));
})().catch(e=>{console.error(e);process.exit(1)});
