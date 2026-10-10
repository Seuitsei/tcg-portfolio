#!/usr/bin/env python3
"""Build the Japanese TEST retrieval index from prepared OpenCV reference packs.
Preserves FR/EN and legacy Japanese data; only detail nomination, no confidence change.
"""
import json,gzip,struct,hashlib
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[1]/'scanner/data'
TARGET=ROOT/'japanese-test'
BANDS=[(0,10,20),(5,15,25),(8,18,28),(3,13,23)]
manifest=json.loads((TARGET/'recovered-references.json').read_text())
ids=[];pairs=[]
for pack in manifest['packs']:
 if pack['lang']!='ja':continue
 raw=gzip.decompress((ROOT/pack['normal']['file']).read_bytes());assert raw[:4]==b'TCGR'
 count=struct.unpack_from('<H',raw,6)[0];offset=8
 for _ in range(count):
  length,n=struct.unpack_from('<BH',raw,offset);offset+=3
  cid=raw[offset:offset+length].decode();offset+=length
  points=np.frombuffer(raw,dtype='<u2',count=n*2,offset=offset).reshape(n,2)/16;offset+=n*4
  orb=np.frombuffer(raw,dtype='uint8',count=n*32,offset=offset).reshape(n,32);offset+=n*32
  ix=np.flatnonzero((points[:,0]>15)&(points[:,0]<237)&(points[:,1]>42)&(points[:,1]<240))[:128]
  index=len(ids);ids.append(cid)
  for band,(a,b,c) in enumerate(BANDS):
   keys=orb[ix,a].astype('uint32')|(orb[ix,b].astype('uint32')<<8)|((orb[ix,c].astype('uint32')&15)<<16)|(band<<20)
   pairs.append((keys.astype('uint64')<<16)|index)
 assert offset==len(raw)
 assert count==pack['count']
pairs=np.unique(np.concatenate(pairs));keys=(pairs>>16).astype('uint32');unique,starts,counts=np.unique(keys,return_index=True,return_counts=True)
keep=counts<=64;unique=unique[keep];starts=starts[keep];counts=counts[keep]
postings=np.concatenate([(pairs[int(s):int(s+c)]&65535).astype('<u2') for s,c in zip(starts,counts)])
offsets=np.concatenate(([0],np.cumsum(counts))).astype('<u4')
raw=b'TCHI'+struct.pack('<III',1,len(unique),len(postings))+unique.astype('<u4').tobytes()+offsets.tobytes()+postings.tobytes()
blob=gzip.compress(raw,mtime=0);files=[]
for i,start in enumerate(range(0,len(blob),4*1024*1024),1):
 file='japanese-test/detail-index-ja.bin.gz.part'+str(i);part=blob[start:start+4*1024*1024];(ROOT/file).write_bytes(part);files.append({'file':file,'bytes':len(part)})
assert len(ids)==len(set(ids))
spec={'lang':'ja','file':'japanese-test/detail-index-ja.bin.gz','files':files,'bytes':len(blob),'rawBytes':len(raw),'sha256':hashlib.sha256(blob).hexdigest(),'cards':len(ids),'ids':ids}
old=json.loads((ROOT/'detail-index.json').read_text());old['packs']=[p for p in old['packs'] if p['lang']!='ja']+[spec]
(TARGET/'detail-index.json').write_text(json.dumps(old,separators=(',',':'))+'\n')
print(json.dumps({'cards':len(ids),'keys':len(unique),'postings':len(postings),'bytes':len(blob)}))
