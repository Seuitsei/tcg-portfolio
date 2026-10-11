const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'www');
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
for(const dir of ['scanner','interface-reference','docs'])fs.cpSync(path.join(root,dir),path.join(out,dir),{recursive:true});
fs.copyFileSync(path.join(root,'THIRD_PARTY_NOTICES.md'),path.join(out,'THIRD_PARTY_NOTICES.md'));
const html=fs.readFileSync(path.join(root,'test-photo.html'),'utf8');
fs.writeFileSync(path.join(out,'index.html'),html);fs.writeFileSync(path.join(out,'test-photo.html'),html);
require('./patch-native-web.cjs')(out);
console.log('Bundled test-photo application; original browser storage and web files untouched.');
