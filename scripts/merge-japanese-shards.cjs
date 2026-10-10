const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'../scanner/data'),target=root+'/japanese-test';
const count=Number(process.argv[2]||4),meta=JSON.parse(fs.readFileSync(root+'/vectors-ja.json')),original=fs.readFileSync(root+'/vectors-ja.bin'),catalog=JSON.parse(fs.readFileSync(root+'/catalog-ja.json'));
const seen=new Set(meta.cards.map(c=>c.id)),vectors=[original],packs=JSON.parse(fs.readFileSync(root+'/recovered-references.json')).packs.filter(p=>p.lang!=='ja');
for(let s=0;s<count;s++){
 const part=JSON.parse(fs.readFileSync(target+'/vectors-ja-shard'+s+'.json')),bytes=fs.readFileSync(target+'/vectors-ja-shard'+s+'.bin');
 if(bytes.length!==part.cards.length*216||!bytes.subarray(0,original.length).equals(original))throw Error('Original descriptor prefix changed');
 for(let i=0;i<part.cards.length;i++){const c=part.cards[i];if(seen.has(c.id))continue;seen.add(c.id);meta.cards.push(c);vectors.push(bytes.subarray(i*216,(i+1)*216));const old=catalog.find(e=>e.id===c.id);if(!old)throw Error('Unknown card');old.image=c.image;}
 packs.push(...JSON.parse(fs.readFileSync(target+'/recovered-references-shard'+s+'.json')).packs.filter(p=>p.lang==='ja'));
}
if(new Set(packs.map(p=>p.key)).size!==packs.length)throw Error('Duplicate reference pack');
meta.built='2026-10-10';meta.failed=meta.failed.filter(id=>!seen.has(id));
fs.writeFileSync(target+'/vectors-ja.json',JSON.stringify(meta)+'\n');fs.writeFileSync(target+'/vectors-ja.bin',Buffer.concat(vectors));fs.writeFileSync(target+'/catalog-ja.json',JSON.stringify(catalog)+'\n');fs.writeFileSync(target+'/recovered-references.json',JSON.stringify({version:1,created:'2026-10-10',packs})+'\n');
for(let s=0;s<count;s++)for(const file of ['vectors-ja-shard'+s+'.json','vectors-ja-shard'+s+'.bin','catalog-ja-shard'+s+'.json','recovered-references-shard'+s+'.json'])fs.unlinkSync(target+'/'+file);
console.log('Merged',meta.cards.length,'cards',packs.filter(p=>p.lang==='ja').length,'JP packs');
