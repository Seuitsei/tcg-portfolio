#!/usr/bin/env python3
"""Local ORB-word retrieval, independent of card borders and image colours.
Words nominate references only; the worker still verifies full-card homography.
Requires opencv-python-headless, numpy and pillow. Source images remain outside git.
"""
import argparse,concurrent.futures,gzip,hashlib,json,struct
from pathlib import Path
import cv2,numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
BANDS=[(0,10,20),(5,15,25),(8,18,28),(3,13,23)]
cv2.setNumThreads(1)
def words(desc):
    return np.concatenate([d[:,a].astype(np.uint32)|(d[:,b].astype(np.uint32)<<8)|((d[:,c].astype(np.uint32)&15)<<16)|(i<<20) for i,(a,b,c) in enumerate(BANDS) for d in [desc]])
def main():
    p=argparse.ArgumentParser();p.add_argument('--images',required=True);p.add_argument('--audit-cache',required=True);p.add_argument('--langs',nargs='+',default=['fr','en']);a=p.parse_args()
    data=ROOT/'scanner/data';audit=json.loads((ROOT/'docs/reference-image-audit.json').read_text());source={(c['lang'],c['id']):c['reference']['sha256'] for c in audit['cards']}
    cache={f.stem:f for f in Path(a.audit_cache).iterdir() if f.suffix in ['.png','.jpeg','.jpg','.webp']}
    manifest={'version':1,'bands':BANDS,'packs':[]};word_cache=Path(a.audit_cache)/'detail-words-v1';word_cache.mkdir(exist_ok=True)
    for lang in a.langs:
        cards=json.loads((data/f'vectors-{lang}.json').read_text())['cards']
        if len(cards)>65535:raise ValueError('Too many card IDs for the compact index')
        def run(item):
            i,c=item;f=cache.get(source.get((lang,c['id']))) or Path(a.images)/(lang+'-'+c['id']+'.webp')
            checkpoint=word_cache/(hashlib.sha256((lang+':'+c['id']).encode()).hexdigest()+'.npy')
            if checkpoint.exists():return (np.load(checkpoint).astype(np.uint64)<<16)|i
            if not f.exists():return np.empty(0,dtype=np.uint64)
            try:rgb=np.array(Image.open(f).convert('RGB'))
            except (OSError,ValueError):return np.empty(0,dtype=np.uint64)
            gray=cv2.cvtColor(cv2.resize(rgb,(252,352),interpolation=cv2.INTER_AREA),cv2.COLOR_RGB2GRAY)
            kp,desc=cv2.ORB_create(350).detectAndCompute(gray,None)
            if desc is None:return np.empty(0,dtype=np.uint64)
            eligible=[j for j,k in enumerate(kp) if 15<k.pt[0]<237 and 42<k.pt[1]<240]
            eligible=sorted(eligible,key=lambda j:kp[j].response,reverse=True)[:128]
            w=np.unique(words(desc[eligible]));np.save(checkpoint,w);w=w.astype(np.uint64)
            return (w<<16)|i
        rows=[]
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            for i,row in enumerate(pool.map(run,enumerate(cards))):
                rows.append(row)
                if (i+1)%2000==0:print(lang,i+1,'/',len(cards),flush=True)
        pairs=np.unique(np.concatenate(rows));keys=(pairs>>16).astype(np.uint32);ids=(pairs&65535).astype(np.uint16)
        unique,starts,counts=np.unique(keys,return_index=True,return_counts=True)
        # Shared text/logos are poor identity evidence and inflate the download.
        keep_words=counts<=64;keep=np.repeat(keep_words,counts)
        unique=unique[keep_words];counts=counts[keep_words];ids=ids[keep]
        offsets=np.concatenate([np.zeros(1,dtype=np.uint32),np.cumsum(counts,dtype=np.uint32)])
        raw=b'TCHI'+struct.pack('<III',1,len(unique),len(ids))+unique.astype('<u4').tobytes()+offsets.astype('<u4').tobytes()+ids.astype('<u2').tobytes()
        blob=gzip.compress(raw,compresslevel=6,mtime=0);file=f'detail-index-{lang}.bin.gz'
        files=[]
        for i,start in enumerate(range(0,len(blob),4*1024*1024)):
            name=file+'.part'+str(i+1);part=blob[start:start+4*1024*1024];(data/name).write_bytes(part);files.append({'file':name,'bytes':len(part),'sha256':hashlib.sha256(part).hexdigest()})
        manifest['packs'].append({'lang':lang,'file':file,'files':files,'bytes':len(blob),'rawBytes':len(raw),'sha256':hashlib.sha256(blob).hexdigest(),'cards':len(cards),'ids':[c['id'] for c in cards]})
        print('DONE',lang,'words',len(unique),'postings',len(ids),'bytes',len(blob),flush=True)
    (data/'detail-index.json').write_text(json.dumps(manifest,ensure_ascii=False,separators=(',',':'))+'\n')
if __name__=='__main__':main()
