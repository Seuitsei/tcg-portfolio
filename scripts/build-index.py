#!/usr/bin/env python3
"""Build reproducible visual packs. pip install aiohttp pillow numpy opencv-python-headless.
No secret, backend, or proprietary application component. Resumes cached thumbnails.
Run: python scripts/build-index.py --cache /path/to/cache --metadata /path/to/metadata
"""
import argparse,asyncio,json,time,hashlib
from pathlib import Path
import aiohttp, cv2, numpy as np
from PIL import Image
from io import BytesIO
ROOT=Path(__file__).resolve().parents[1]
SEEDS=['base1','base2','basep','neo1','ex3','xy12','swsh4','swsh4.5','swsh4.5sv','cel25','cel25cc','sv03.5']
# Same block geometry/normalisation as scanner/vision.js; no hashes used as identity.
def vector(rgb):
 out=[]
 for x,y,w,h in [(0,0,1,1),(.07,.13,.86,.43)]:
  height,width=rgb.shape[:2];a=cv2.resize(rgb[round(y*height):round((y+h)*height),round(x*width):round((x+w)*width)],(48,48),interpolation=cv2.INTER_AREA).astype(np.float32)
  v=a.reshape(6,8,6,8,3).mean(axis=(1,3));v-=v.mean(axis=(0,1));v/=np.sqrt(np.mean(v*v))+1e-6
  out.extend(np.clip(np.floor(v.flatten()*31+.5),-127,127).astype(np.int8).tolist())
 return out
async def main():
 p=argparse.ArgumentParser();p.add_argument('--cache',default='.index-cache');p.add_argument('--metadata',default=None);p.add_argument('--sets',nargs='*',default=SEEDS);p.add_argument('--concurrency',type=int,default=8);args=p.parse_args()
 cache=Path(args.cache);cache.mkdir(parents=True,exist_ok=True);data=ROOT/'scanner/data';data.mkdir(parents=True,exist_ok=True)
 connector=aiohttp.TCPConnector(limit=args.concurrency)
 async with aiohttp.ClientSession(connector=connector,timeout=aiohttp.ClientTimeout(total=40),trust_env=True) as session:
  async def get(url):
   for attempt in range(3):
    try:
     async with session.get(url) as r:
      if r.status==404:return None
      r.raise_for_status();return await r.read()
    except Exception:
     if attempt==2:return None
     await asyncio.sleep(1+attempt)
  catalogs={};sets={}
  for lang in ['fr','en']:
   for typ in ['cards','sets']:
    file=Path(args.metadata)/f'{lang}-{typ}.json' if args.metadata else cache/f'{lang}-{typ}.json'
    if not file.exists():file.write_bytes(await get(f'https://api.tcgdex.net/v2/{lang}/{typ}'))
    j=json.loads(file.read_text());(catalogs if typ=='cards' else sets)[lang]=j
  (data/'sets.json').write_text(json.dumps(sets,ensure_ascii=False,separators=(',',':')))
  # Entire searchable metadata is small; visual packs only contain prepared sets.
  (data/'catalog.json').write_text(json.dumps(catalogs,ensure_ascii=False,separators=(',',':')))
  manifest={'version':1,'created':'2026-10-07','packs':[]};total=0;t=time.monotonic()
  sem=asyncio.Semaphore(args.concurrency)
  async def build(card,lang,setinfo):
   async with sem:
    image=card.get('image')
    if not image:return None
    f=cache/(lang+'-'+card['id']+'.webp')
    if not f.exists():
     b=await get(image+'/low.webp')
     if not b:return None
     f.write_bytes(b)
    try:
     rgb=np.array(Image.open(f).convert('RGB'));v=vector(rgb)
     gray=cv2.cvtColor(cv2.resize(rgb,(252,352),interpolation=cv2.INTER_AREA),cv2.COLOR_RGB2GRAY)
     orb=cv2.ORB_create(nfeatures=350);kp,desc=orb.detectAndCompute(gray,None)
     # Compact base64 binary ORB data, little-endian uint16 point coordinates.
     import base64
     coords=np.array([[round(k.pt[0]*16),round(k.pt[1]*16)] for k in kp],dtype='<u2')
     return {**card,'lang':lang,'setId':setinfo['id'],'setName':setinfo['name'],'total':setinfo['cardCount']['official'],'v':v,'orb':base64.b64encode(desc.tobytes()).decode() if desc is not None else '', 'points':base64.b64encode(coords.tobytes()).decode()}
    except Exception as e:print('FAIL',card['id'],str(e),flush=True);return None
  for sid in args.sets:
   for lang in ['fr','en']:
    info=next((s for s in sets[lang] if s['id']==sid),None)
    if not info:continue
    cards=[c for c in catalogs[lang] if c['id'].rsplit('-',1)[0]==sid]
    entries=[c for c in await asyncio.gather(*(build(c,lang,info) for c in cards)) if c]
    pack=f'{lang}-{sid}.json';raw=json.dumps(entries,ensure_ascii=False,separators=(',',':')).encode();(data/pack).write_bytes(raw)
    manifest['packs'].append({'file':pack,'lang':lang,'setId':sid,'name':info['name'],'count':len(entries),'available':sum('image' in c for c in cards),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()});total+=len(entries)
    (data/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
    print(pack,len(entries),'/',len(cards),'total',total,'seconds',round(time.monotonic()-t),flush=True)
if __name__=='__main__':asyncio.run(main())
