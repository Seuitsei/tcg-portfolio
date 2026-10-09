/* Detail-based retrieval nominates candidates; it never determines confidence. */
(function(root){
 'use strict';
 const BANDS=[[0,10,20],[5,15,25],[8,18,28],[3,13,23]];
 function decode(buffer,ids){
  const view=new DataView(buffer);if(buffer.byteLength<20||view.getUint32(0,true)!==0x49484354||view.getUint32(4,true)!==1)throw Error('Index de détails invalide.');
  const n=view.getUint32(8,true),count=view.getUint32(12,true),end=16+n*4+(n+1)*4+count*2;if(end!==buffer.byteLength)throw Error('Index de détails incomplet.');
  const keys=new Uint32Array(buffer,16,n),offsets=new Uint32Array(buffer,16+n*4,n+1),postings=new Uint16Array(buffer,16+n*4+(n+1)*4,count);
  if(offsets[0]!==0||offsets[n]!==count)throw Error('Index de détails incohérent.');
  for(let i=0;i<n;i++)if(i&&keys[i]<=keys[i-1]||offsets[i]>offsets[i+1]||offsets[i+1]-offsets[i]>64)throw Error('Index de détails incohérent.');
  if(postings.some(i=>i>=ids.length))throw Error('Identifiants de détails incohérents.');
  return {keys,offsets,postings,ids};
 }
 function rank(index,features,limit=32){
  const {keys,offsets,postings,ids}=index,votes=new Float32Array(ids.length),seen=new Set();
  for(const f of features)for(let i=0;i<f.bytes.length;i+=32)for(let band=0;band<BANDS.length;band++){
   const [a,b,c]=BANDS[band],key=f.bytes[i+a]|(f.bytes[i+b]<<8)|((f.bytes[i+c]&15)<<16)|(band<<20);if(seen.has(key))continue;seen.add(key);
   let lo=0,hi=keys.length;while(lo<hi){const mid=(lo+hi)>>>1;if(keys[mid]<key)lo=mid+1;else hi=mid;}
   if(keys[lo]!==key)continue;const start=offsets[lo],end=offsets[lo+1],weight=1/Math.sqrt(end-start);
   for(let j=start;j<end;j++)votes[postings[j]]+=weight;
  }
  return Array.from(votes,(score,i)=>({id:ids[i],score})).filter(x=>x.score>=2).sort((a,b)=>b.score-a.score).slice(0,limit);
 }
 root.ScannerDetailIndex={decode,rank};if(typeof module!=='undefined')module.exports=root.ScannerDetailIndex;
})(globalThis);
