/* Audited local references. Coordinates share the logical 252 × 352 frame. */
(function(root){
 'use strict';
 function decodeReferencePack(buffer){
  const bytes=new Uint8Array(buffer),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(bytes.length<8||String.fromCharCode(...bytes.subarray(0,4))!=='TCGR'||view.getUint16(4,true)!==1)throw Error('Pack de références invalide.');
  const count=view.getUint16(6,true),rows={},decoder=new TextDecoder();let offset=8;
  for(let i=0;i<count;i++){
   if(offset+3>bytes.length)throw Error('Pack de références incomplet.');
   const length=bytes[offset],n=view.getUint16(offset+1,true);offset+=3;
   if(!length||offset+length+n*36>bytes.length)throw Error('Pack de références incomplet.');
   const id=decoder.decode(bytes.subarray(offset,offset+length));offset+=length;
   if(Object.hasOwn(rows,id)||id==='__proto__')throw Error('Référence dupliquée.');
   const points=Array.from({length:n},(_,j)=>({x:view.getUint16(offset+j*4,true)/16,y:view.getUint16(offset+j*4+2,true)/16}));offset+=n*4;
   rows[id]={width:252,height:352,points,bytes:bytes.subarray(offset,offset+n*32)};offset+=n*32;
  }
  if(offset!==bytes.length)throw Error('Pack de références incohérent.');
  return rows;
 }
 root.ScannerReferencePacks={decodeReferencePack};
 if(typeof module!=='undefined')module.exports=root.ScannerReferencePacks;
})(globalThis);
